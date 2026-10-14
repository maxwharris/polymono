import s from './Login.module.css';

// A low night skyline for the login page: stepped masses, the Empire State and Chrysler spires (the crown's
// arches picked out in brass) and sparse lit windows. Drawn once, deterministically, on a 1440-unit strip
// with the two landmarks in the middle 390 units, so a phone (which sees the centre slice) gets both.
const W = 1440;
const BASE = 300;
const TOP = 96; // the tallest spire reaches y 98
const MID = (W - 390) / 2;

function build() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // [x, width, height, kind]: the mockup's phone skyline in the middle, generated blocks on either side.
  const centre = [[0, 34, 120], [30, 40, 170], [66, 30, 140], [92, 46, 250, 'empire'], [134, 36, 160], [166, 30, 205],
    [192, 40, 150], [228, 34, 300, 'chrysler'], [258, 38, 185], [292, 30, 135], [318, 44, 220], [356, 34, 160]]
    .map(([x, w, h, kind]) => [x + MID, w, h, kind]);
  const sides = [];
  for (let x = MID - 4; x > -40;) {
    const w = 26 + Math.round(rnd() * 22);
    x -= w - 4;
    sides.push([x, w, 100 + Math.round(rnd() * 140)]);
  }
  for (let x = MID + 390 - 4; x < W + 40;) {
    const w = 26 + Math.round(rnd() * 22);
    sides.push([x, w, 100 + Math.round(rnd() * 140)]);
    x += w - 4;
  }

  let masses = '';
  let arches = '';
  const windows = [];
  for (const [x, w, h, kind] of [...sides, ...centre]) {
    const y = BASE - Math.round(h * 0.56);
    if (kind === 'empire') {
      masses += `M${x} ${BASE}V${y + 40}h6v-14h8v-18h6v-8h6v8h6v18h8v14h6V${BASE}z M${x + 22} ${y - 30}h2v34h-2z `;
    } else if (kind === 'chrysler') {
      const c = x + w / 2;
      masses += `M${x} ${BASE}V${y + 50}h4v-10h${w - 8}v10h4V${BASE}z `;
      masses += `M${c - 12} ${y + 42}C${c - 12} ${y + 20} ${c - 6} ${y + 6} ${c} ${y - 4}C${c + 6} ${y + 6} ${c + 12} ${y + 20} ${c + 12} ${y + 42}z `;
      masses += `M${c - 0.8} ${y - 34}h1.6v34h-1.6z `;
      for (let k = 0; k < 4; k++) {
        arches += `M${c - 10 + k * 2.4} ${y + 40 - k * 8}Q${c} ${y + 26 - k * 9} ${c + 10 - k * 2.4} ${y + 40 - k * 8} `;
      }
    } else {
      const step = Math.round(w * 0.2);
      masses += `M${x} ${BASE}V${y + 10}h${step}v-10h${w - 2 * step}v10h${step}V${BASE}z `;
    }
    for (let wy = y + 22; wy < BASE - 4; wy += 9) {
      for (let wx = x + 5; wx < x + w - 5; wx += 7) {
        if (rnd() < 0.09) windows.push({ x: wx, y: wy, o: (0.35 + rnd() * 0.5).toFixed(2) });
      }
    }
  }
  return { masses, arches, windows };
}

const SKY = build();

export default function Skyline({ className = '' }) {
  return (
    <svg
      className={`${s.sky} ${className}`}
      viewBox={`0 ${TOP} ${W} ${BASE - TOP}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <path className={s.skyMass} d={SKY.masses} />
      <path className={s.skyArch} d={SKY.arches} />
      <g className={s.skyLit}>
        {SKY.windows.map((w, i) => <rect key={i} x={w.x} y={w.y} width="2.4" height="3.6" opacity={w.o} />)}
      </g>
      <rect className={s.skyMass} x="0" y={BASE - 4} width={W} height="4" />
    </svg>
  );
}
