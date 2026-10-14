// Camera: frames the whole board (steeper on portrait screens), follows a walking token, then flies back.
// The target is clamped to the board so it can't be lost; a user drag pauses following for a while.
//
// Framing leaves ~10px at the sides and, when there is room, a 48px band at the top for the view controls.
// On a phone, when a tall turn panel leaves a short, wide canvas (buy or debt at 375x667, a phone on its side),
// the whole board would be tiny: the overview frames the current player's side instead, turned to face them,
// centred on their space and about eight spaces wide (more on wider canvases), so the tiles that matter stay
// readable. Never on the desktop layout: a tall floating panel there still leaves room for the whole board, and
// a side view would turn the board under the top bar. "Show the whole board" always shows all of it. With
// prefers-reduced-motion the camera cuts instead of flying.
//
// frameloop="demand" means the clock's next delta is the whole idle gap, and camera-controls would finish
// most of a smooth move in that one frame: every programmatic move from rest restarts the clock first.
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import useBoardAnim from '../../store/boardAnim';
import useGameStore, { selectCurrentPlayer } from '../../store/gameStore';
import { SLAB, SLAB_BOX, SLAB_HEIGHT, SPACES } from './layout';
import { tokens } from './registry';
import { prefersReducedMotion, useReducedMotion } from './motion';

const deg = THREE.MathUtils.degToRad;
const PORTRAIT_ASPECT = 0.8;
const PAUSE_AFTER_USER_MS = 6000;
const RETURN_AFTER_MS = 1500;
const FOLLOW_PULL = 0.7;
const AIM_STEP = 1; // re-aim at the walking token once it moved this far (each smooth moveTo costs a promise)
const BOUNDARY = new THREE.Box3(new THREE.Vector3(-16, 0, -16), new THREE.Vector3(16, 0, 16));
const SIDE_PX = 10; // margin at the sides, at least
const SIDE_MIN = 0.04; // ... and at least this share of the half-width (wide canvases)
const EDGE_PX = 12; // margin at the top and bottom
const CONTROLS_PX = 48; // band at the top for the view controls, when the board can give it up without shrinking
const SIDE_POLAR = 30; // degrees: the tilt when framing one side
const SIDE_SPAN = 20; // world units of the side to show (a space is 2.56) on a phone-shaped canvas...
const SIDE_SPAN_ASPECT = 1.6; // ... and more, up to the whole side, on canvases wider than this
const SIDE_DEPTH = 6.5; // from the board's edge inwards: the row and a strip of the centre
// A phone: the app's phone layout (under 900px wide, game.css), or a large phone on its side, which gets the
// desktop columns but is still a short touch screen. Tablets and desktop windows are neither.
const PHONE_QUERY = '(max-width: 899px), (pointer: coarse) and (max-height: 500px)';
const onPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches;
// Short and wide on a phone: a tall turn panel, or a phone on its side.
const isCramped = (w, h) => h < 440 && h < 0.72 * w && onPhone();

const box = (x0, x1, y0, y1, z0, z1) => {
  const out = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new THREE.Vector3(x, y, z));
  return out;
};
// The slab's corners (plus a little height for tokens), and `span` of the side nearest a camera on +Z
// (centred on x = 0: framing it elsewhere along the side only moves the target).
const WHOLE = box(SLAB_BOX.min.x, SLAB_BOX.max.x, SLAB_BOX.min.y, SLAB_BOX.max.y, SLAB_BOX.min.z, SLAB_BOX.max.z);
const sideBox = span => box(-span / 2, span / 2, -SLAB_HEIGHT, 0.9, SLAB / 2 - SIDE_DEPTH, SLAB / 2);
const UP = new THREE.Vector3(0, 1, 0);
const _local = new THREE.Vector3();

const _probe = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const isPortrait = (width, height) => width / Math.max(1, height) < PORTRAIT_ASPECT;
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Framing for a tilted view: the distance and target (on the centre line, z = tz) at which `points` fit inside
 * the margins (normalized device coordinates: { x, top, bottom }), seen from `polar` radians off vertical at
 * azimuth 0. `align` 'center' centres them between the margins, 'bottom' rests them on the bottom margin.
 * camera-controls' fitToBox snaps angles to 90 degrees, so it can't frame a tilted view; this searches instead.
 */
function fit(points, fov, aspect, polar, margins, align = 'center') {
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
    for (const c of points) {
      _v.copy(c).project(_probe);
      minY = Math.min(minY, _v.y);
      maxY = Math.max(maxY, _v.y);
      maxX = Math.max(maxX, Math.abs(_v.x));
    }
    return { minY, maxY, maxX };
  };
  const fits = (d, tz, bottom) => {
    place(d, tz);
    const { minY, maxY, maxX } = extent();
    return maxX <= 1 - margins.x && maxY <= 1 - margins.top && (!bottom || minY >= -1 + margins.bottom);
  };
  const nearest = (tz, bottom) => {
    let lo = 3;
    let hi = 600;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid, tz, bottom)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  // Resting on the bottom margin is what the target slide does, so those passes leave the bottom out of the
  // search (with it in, the first pass stops on the bottom margin and the slide never gets a chance).
  const resting = align === 'bottom';
  let tz = 0;
  let distance = 60;
  let extentY = 0;
  for (let pass = 0; pass < (resting ? 6 : 4); pass++) {
    distance = nearest(tz, !resting);
    // Perspective draws the near edge bigger: slide the target until the points sit where they should.
    place(distance, tz);
    const { minY, maxY } = extent();
    extentY = maxY - minY;
    const want = align === 'bottom' ? -1 + margins.bottom - minY : (margins.bottom - margins.top) / 2 - (minY + maxY) / 2;
    const visibleHalf = distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    tz += want * visibleHalf / Math.max(0.2, Math.cos(polar));
  }
  if (resting) distance = nearest(tz, true); // a last fit with every margin, at the final target
  return { distance, tz, extentY };
}

/** Margins in NDC for a w x h canvas; `top` in px. */
const marginsFor = (w, h, top) => ({
  x: Math.max(SIDE_PX / (w / 2), SIDE_MIN),
  top: top / (h / 2),
  bottom: EDGE_PX / (h / 2)
});

/** The whole board, centred, leaving the controls' band at the top when the board doesn't have to shrink for it. */
function frameWhole(fov, w, h, polar) {
  const aspect = w / Math.max(1, h);
  const plain = fit(WHOLE, fov, aspect, polar, marginsFor(w, h, EDGE_PX));
  // Room the centred board leaves above itself, in px; the band takes what the bottom can spare.
  const spare = (h / 2) * (2 - plain.extentY) - 2 * EDGE_PX;
  if (spare / 2 >= CONTROLS_PX - EDGE_PX) return plain; // already clear of the controls
  const top = Math.min(CONTROLS_PX, EDGE_PX + Math.max(0, spare));
  const banded = fit(WHOLE, fov, aspect, polar, marginsFor(w, h, top));
  return banded.distance <= plain.distance * 1.001 ? banded : plain;
}

function CameraRig() {
  const ref = useRef();
  const get = useThree(s => s.get);
  const width = useThree(s => s.size.width);
  const height = useThree(s => s.size.height);
  const portrait = isPortrait(width, height);
  const cramped = isCramped(width, height);
  const walking = useBoardAnim(s => s.walking);
  const follow = useBoardAnim(s => s.follow);
  const recenterNonce = useBoardAnim(s => s.recenterNonce);
  const currentId = useGameStore(s => selectCurrentPlayer(s)?.id ?? null);
  const currentAt = useBoardAnim(s => (currentId == null ? null : s.shown[currentId] ?? null));
  const at = Number.isInteger(currentAt) && SPACES[currentAt] ? currentAt : null;
  const still = useReducedMotion();
  const following = useRef(null); // player id the camera is tracking
  const aimed = useRef(null); // where the camera was last told to look while following
  const atOverview = useRef(false); // showing the overview: not following, not moved by the user
  const framedPortrait = useRef(null); // the orientation the board was last framed for at once
  const wholeBoard = useRef(false); // the user asked for the whole board: don't swap it for one side
  const atRef = useRef(at); // for framing(), which runs from effects and timers
  const pausedUntil = useRef(0);
  const returnTimer = useRef(null);

  useLayoutEffect(() => {
    atRef.current = at; // first of the effects below, so they all frame the current player's space
  }, [at]);

  const setFollowing = useCallback((id) => {
    following.current = id;
    if (useBoardAnim.getState().tracking !== id) useBoardAnim.setState({ tracking: id });
  }, []);

  // The overview for the canvas as it is now; also how far out the user may zoom.
  const framing = useCallback(() => {
    const c = ref.current;
    const { width: w, height: h } = get().size;
    const fov = c.camera.fov;
    const whole = frameWhole(fov, w, h, deg(isPortrait(w, h) ? 15 : 35));
    c.maxDistance = Math.max(90, whole.distance * 1.3);
    const spot = atRef.current;
    if (!isCramped(w, h) || wholeBoard.current || spot == null) return { ...whole, x: 0, azimuth: 0, polar: deg(isPortrait(w, h) ? 15 : 35) };
    // Their side, turned to face the camera: along it, centre on their space but keep within the board.
    const azimuth = SPACES[Math.floor(spot / 10) * 10].yaw;
    const aspect = w / Math.max(1, h);
    const span = Math.min(SLAB, SIDE_SPAN * Math.max(1, aspect / SIDE_SPAN_ASPECT));
    const along = _local.set(SPACES[spot].x, 0, SPACES[spot].z).applyAxisAngle(UP, -azimuth).x;
    const x = THREE.MathUtils.clamp(along, -SLAB / 2 + span / 2, SLAB / 2 - span / 2);
    const polar = deg(SIDE_POLAR);
    const near = fit(sideBox(span), fov, aspect, polar, marginsFor(w, h, EDGE_PX), 'bottom');
    return { distance: near.distance, tz: near.tz, x, azimuth, polar };
  }, [get]);

  const overview = useCallback((smooth) => {
    const c = ref.current;
    if (!c) return;
    const { polar, distance, tz, x, azimuth } = framing();
    const animate = smooth && !prefersReducedMotion();
    setFollowing(null);
    atOverview.current = true;
    if (animate) get().clock.getDelta(); // see the top of the file
    _local.set(x, 0, tz).applyAxisAngle(UP, azimuth); // from the side's frame to the world
    c.moveTo(_local.x, 0, _local.z, animate);
    c.rotateTo(c.azimuthAngle + wrapAngle(azimuth - c.azimuthAngle), polar, animate); // the short way round
    c.dollyTo(distance, animate);
  }, [framing, get, setFollowing]);

  useLayoutEffect(() => {
    ref.current?.setBoundary(BOUNDARY);
  }, []);

  useEffect(() => () => {
    if (useBoardAnim.getState().tracking != null) useBoardAnim.setState({ tracking: null });
  }, []);

  // The user took the camera: stop following for a while.
  const onControlStart = useCallback(() => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_USER_MS;
    setFollowing(null);
    atOverview.current = false;
    clearTimeout(returnTimer.current);
  }, [setFollowing]);

  // Wheel zooms only send 'control' (no 'controlstart').
  const onControl = useCallback(() => {
    atOverview.current = false;
  }, []);

  // Mount, or the screen turned: frame the board at once. Other size changes (the action panel, the phone
  // keyboard) refit the overview smoothly if it is showing, and leave a follow or the user's own view alone.
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (!cramped) wholeBoard.current = false;
    if (framedPortrait.current !== portrait) {
      framedPortrait.current = portrait;
      overview(false);
    } else if (atOverview.current) overview(true);
    else framing();
  }, [width, height, portrait, cramped, overview, framing]);

  // A short canvas frames the current player's side: follow it when they move on or the turn passes.
  useEffect(() => {
    wholeBoard.current = false;
    if (cramped && atOverview.current && ref.current) overview(true);
  }, [at, cramped, overview]);

  useEffect(() => {
    if (!recenterNonce) return;
    wholeBoard.current = true;
    overview(true);
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
        if (still) {
          // Reduced motion: one cut to where the walk ends (shown[] already holds it), no chase.
          const to = SPACES[useBoardAnim.getState().shown[walking]];
          if (to) c.moveTo(to.x * FOLLOW_PULL, 0, to.z * FOLLOW_PULL, false);
        } else get().clock.getDelta(); // see the top of the file
        c.rotatePolarTo(deg(portrait ? 28 : 42), !still);
        c.dollyTo(portrait ? 30 : 24, !still);
      }
      setFollowing(walking);
    } else if (walking == null && following.current != null) {
      returnTimer.current = setTimeout(() => {
        if (Date.now() >= pausedUntil.current) overview(true);
        else setFollowing(null);
      }, RETURN_AFTER_MS);
    }
  }, [walking, follow, portrait, still, overview, get, setFollowing]);

  useEffect(() => () => clearTimeout(returnTimer.current), []);

  useFrame(() => {
    const id = following.current;
    if (id == null || walking == null || still) return;
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
