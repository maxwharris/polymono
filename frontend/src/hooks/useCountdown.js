import useGameStore from '../store/gameStore';
import { timeLeft } from '../lib/format';
import useNow from './useNow';

const HOUR = 3600 * 1000;

/**
 * Time left until `deadline` on the server's clock: { label: '19h 12m' | 'overdue' | null, ms, tone }.
 * tone is 'ok', 'warn' (under 4 hours) or 'danger' (under 1 hour). No deadline (turn_hours 0) = label null.
 */
export default function useCountdown(deadline) {
  const now = useNow(30000);
  const offset = useGameStore(s => s.serverOffsetMs);
  if (!deadline) return { label: null, ms: null, tone: 'ok' };
  const serverNow = now + offset;
  const ms = new Date(deadline).getTime() - serverNow;
  const tone = ms < HOUR ? 'danger' : ms < 4 * HOUR ? 'warn' : 'ok';
  return { label: timeLeft(deadline, serverNow), ms, tone };
}
