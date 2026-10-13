// "+$200" / "-$350" labels that rise over a space when money changes hands (from game events).
import { memo } from 'react';
import { Html } from '@react-three/drei';
import useBoardAnim from '../../store/boardAnim';
import { SPACES } from './layout';
import css from './board.module.css';

const LABELS = { salary: 'salary', rent: 'rent', tax: 'tax', fine: 'fine', debt: 'debt' };

function Floaters() {
  const floaters = useBoardAnim(s => s.floaters);
  return floaters.map((f) => {
    const space = SPACES[f.position];
    if (!space) return null;
    const gain = f.amount > 0;
    return (
      <Html key={f.id} position={[space.x, 1.2, space.z]} center pointerEvents="none" zIndexRange={[25, 0]}>
        <div className={`${css.floater} ${gain ? css.gain : css.loss}`}>
          {gain ? '+' : '−'}${Math.abs(f.amount).toLocaleString()}
          {LABELS[f.label] && <span>{LABELS[f.label]}</span>}
        </div>
      </Html>
    );
  });
}

export default memo(Floaters);
