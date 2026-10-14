import useGameStore from '../store/gameStore';
import { timeLeft } from '../lib/format';
import useNow from './useNow';

const MINUTE = 60 * 1000;

/**
 * Time left until `deadline` on the server's clock: { label: '19h 12m' | 'overdue' | null, ms, tone }.
 * tone is 'ok' (slate), 'soon' (brass, under 3 hours) or 'urgent' (stop-red, under 30 minutes): urgency
 * without a new accent, and it never blinks. No deadline (turn_hours 0) = label null.
 */
export default function useCountdown(deadline) {
  const now = useNow(30000);
  const offset = useGameStore(s => s.serverOffsetMs);
  if (!deadline) return { label: null, ms: null, tone: 'ok' };
  const serverNow = now + offset;
  const ms = new Date(deadline).getTime() - serverNow;
  const tone = ms < 30 * MINUTE ? 'urgent' : ms < 180 * MINUTE ? 'soon' : 'ok';
  return { label: timeLeft(deadline, serverNow), ms, tone };
}
