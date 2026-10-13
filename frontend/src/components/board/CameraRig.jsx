// Camera: frames the whole board (steeper on portrait screens), follows a walking token, then flies back.
// The target is clamped to the board so it can't be lost; a user drag pauses following for a while.
//
// frameloop="demand" means the clock's next delta is the whole idle gap, and camera-controls would finish
// most of a smooth move in that one frame: every programmatic move from rest restarts the clock first.
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import useBoardAnim from '../../store/boardAnim';
import { SLAB_BOX } from './layout';
import { tokens } from './registry';

const deg = THREE.MathUtils.degToRad;
const PORTRAIT_ASPECT = 0.8;
const PAUSE_AFTER_USER_MS = 6000;
const RETURN_AFTER_MS = 1500;
const FOLLOW_PULL = 0.7;
const AIM_STEP = 1; // re-aim at the walking token once it moved this far (each smooth moveTo costs a promise)
const BOUNDARY = new THREE.Box3(new THREE.Vector3(-16, 0, -16), new THREE.Vector3(16, 0, 16));
const MARGIN_X = 0.04; // of the half-width, in normalized device coordinates
const MARGIN_Y = 0.06;

// The slab's corners (plus a little height for tokens), for framing.
const CORNERS = [];
for (const x of [SLAB_BOX.min.x, SLAB_BOX.max.x]) {
  for (const y of [SLAB_BOX.min.y, SLAB_BOX.max.y]) {
    for (const z of [SLAB_BOX.min.z, SLAB_BOX.max.z]) CORNERS.push(new THREE.Vector3(x, y, z));
  }
}
const _probe = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const isPortrait = (width, height) => width / Math.max(1, height) < PORTRAIT_ASPECT;

/**
 * Overview framing for a tilted view: the distance and target (on the board's centre line) at which the
 * whole board fits, centred, seen from `polar` radians off vertical at azimuth 0. camera-controls'
 * fitToBox snaps angles to 90 degrees, so it can't frame a tilted view; this searches instead.
 */
function frameBoard(fov, aspect, polar) {
  _probe.fov = fov;
  _probe.aspect = aspect;
  _probe.near = 0.1;
  _probe.far = 2000;
  _probe.updateProjectionMatrix();
  const place = (d, tz) => {
    _probe.position.set(0, d * Math.cos(polar), tz + d * Math.sin(polar));
    _probe.lookAt(0, 0, tz);
    _probe.updateMatrixWorld();
  };
  const extent = () => {
    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = 0;
    for (const c of CORNERS) {
      _v.copy(c).project(_probe);
      minY = Math.min(minY, _v.y);
      maxY = Math.max(maxY, _v.y);
      maxX = Math.max(maxX, Math.abs(_v.x));
    }
    return { minY, maxY, maxX };
  };
  const fits = (d, tz) => {
    place(d, tz);
    const { minY, maxY, maxX } = extent();
    return maxX <= 1 - MARGIN_X && maxY <= 1 - MARGIN_Y && minY >= -1 + MARGIN_Y;
  };
  let tz = 0;
  let distance = 60;
  for (let pass = 0; pass < 4; pass++) {
    let lo = 5;
    let hi = 600;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid, tz)) hi = mid;
      else lo = mid;
    }
    distance = hi;
    // Perspective draws the near edge bigger: slide the target until the board sits mid-screen.
    place(distance, tz);
    const { minY, maxY } = extent();
    const visibleHalf = distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    tz -= ((minY + maxY) / 2) * visibleHalf / Math.max(0.2, Math.cos(polar));
  }
  return { distance, tz };
}

function CameraRig() {
  const ref = useRef();
  const get = useThree(s => s.get);
  const width = useThree(s => s.size.width);
  const height = useThree(s => s.size.height);
  const portrait = isPortrait(width, height);
  const walking = useBoardAnim(s => s.walking);
  const follow = useBoardAnim(s => s.follow);
  const recenterNonce = useBoardAnim(s => s.recenterNonce);
  const following = useRef(null); // player id the camera is tracking
  const aimed = useRef(null); // where the camera was last told to look while following
  const atOverview = useRef(false); // showing the overview: not following, not moved by the user
  const framedPortrait = useRef(null); // the orientation the board was last framed for at once
  const pausedUntil = useRef(0);
  const returnTimer = useRef(null);

  // The overview for the canvas as it is now; also how far out the user may zoom.
  const framing = useCallback(() => {
    const c = ref.current;
    const { width: w, height: h } = get().size;
    const polar = deg(isPortrait(w, h) ? 15 : 35);
    const { distance, tz } = frameBoard(c.camera.fov, w / Math.max(1, h), polar);
    c.maxDistance = Math.max(90, distance * 1.3);
    return { polar, distance, tz };
  }, [get]);

  const overview = useCallback((smooth) => {
    const c = ref.current;
    if (!c) return;
    const { polar, distance, tz } = framing();
    following.current = null;
    atOverview.current = true;
    if (smooth) get().clock.getDelta(); // see the top of the file
    c.moveTo(0, 0, tz, smooth);
    c.rotateTo(0, polar, smooth);
    c.dollyTo(distance, smooth);
  }, [framing, get]);

  useLayoutEffect(() => {
    ref.current?.setBoundary(BOUNDARY);
  }, []);

  // The user took the camera: stop following for a while.
  const onControlStart = useCallback(() => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_USER_MS;
    following.current = null;
    atOverview.current = false;
    clearTimeout(returnTimer.current);
  }, []);

  // Wheel zooms only send 'control' (no 'controlstart').
  const onControl = useCallback(() => {
    atOverview.current = false;
  }, []);

  // Mount, or the screen turned: frame the board at once. Other size changes (the action panel, the phone
  // keyboard) refit the overview smoothly if it is showing, and leave a follow or the user's own view alone.
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (framedPortrait.current !== portrait) {
      framedPortrait.current = portrait;
      overview(false);
    } else if (atOverview.current) overview(true);
    else framing();
  }, [width, height, portrait, overview, framing]);

  useEffect(() => {
    if (recenterNonce) overview(true);
  }, [recenterNonce, overview]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    clearTimeout(returnTimer.current);
    if (!follow) {
      if (following.current != null) overview(true); // switched off mid-walk: stop chasing the token
    } else if (walking != null && Date.now() >= pausedUntil.current) {
      if (following.current == null) {
        atOverview.current = false;
        aimed.current = null;
        get().clock.getDelta(); // see the top of the file
        c.rotatePolarTo(deg(portrait ? 28 : 42), true);
        c.dollyTo(portrait ? 30 : 24, true);
      }
      following.current = walking;
    } else if (walking == null && following.current != null) {
      returnTimer.current = setTimeout(() => {
        if (Date.now() >= pausedUntil.current) overview(true);
        else following.current = null;
      }, RETURN_AFTER_MS);
    }
  }, [walking, follow, portrait, overview, get]);

  useEffect(() => () => clearTimeout(returnTimer.current), []);

  useFrame(() => {
    const id = following.current;
    if (id == null || walking == null) return;
    const object = tokens.get(id)?.object;
    if (!object) return;
    // Look a little inwards of the token, so the frame shows board rather than table.
    _aim.set(object.position.x * FOLLOW_PULL, 0, object.position.z * FOLLOW_PULL);
    if (aimed.current && aimed.current.distanceToSquared(_aim) < AIM_STEP * AIM_STEP) return;
    aimed.current = (aimed.current ?? new THREE.Vector3()).copy(_aim);
    ref.current.moveTo(_aim.x, 0, _aim.z, true);
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={9}
      maxDistance={90}
      maxPolarAngle={deg(70)}
      dollyToCursor
      smoothTime={0.3}
      onControlStart={onControlStart}
      onControl={onControl}
    />
  );
}

export default memo(CameraRig);
