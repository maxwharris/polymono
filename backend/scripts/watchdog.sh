#!/bin/bash
# Ops alerts for Polymono, on the box, every 5 minutes from cron. Posts to https://ntfy.sh/$NTFY_TOPIC when the
# backend is down, crash-looping or failing its health check, or the disk is nearly full; and once more when it
# recovers. Silent while nothing changes. Install as /etc/cron.d/polymono-watchdog (root:root, mode 644):
#   NTFY_TOPIC=<topic>
#   */5 * * * * ubuntu /var/www/polymono/backend/scripts/watchdog.sh 2>&1 | logger -t polymono-watchdog

set -uo pipefail
APP=${WATCHDOG_APP:-monop-backend}
HEALTH_URL=${HEALTH_URL:-http://localhost:3002/api/health}
STATE=${WATCHDOG_STATE:-$HOME/.polymono-watchdog}
[ -n "${NTFY_TOPIC:-}" ] || { echo "watchdog: NTFY_TOPIC not set" >&2; exit 2; }

problems=()

# pm2: online, and not restarting over and over (3+ restarts since the last check).
read -r status restarts < <(pm2 jlist 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    try { const a = JSON.parse(s).find(p => p.name === process.argv[1]);
          console.log(a ? `${a.pm2_env.status} ${a.pm2_env.restart_time}` : "missing 0"); }
    catch { console.log("unknown 0"); } });' "$APP")
last_restarts=$(sed -n 's/^restarts=//p' "$STATE" 2>/dev/null)
[ "$status" = online ] || problems+=("the backend is $status")
[ -n "$last_restarts" ] && [ "$restarts" -ge $((last_restarts + 3)) ] && problems+=("the backend restarted $((restarts - last_restarts)) times in 5 minutes")

# Health: the API answers, the database is reachable and migrated.
curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1 || problems+=("the health check fails")

# Disk.
used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$used" -ge 90 ] && problems+=("the disk is ${used}% full")

if [ ${#problems[@]} -eq 0 ]; then now="ok"; else now=$(IFS='; '; echo "${problems[*]}"); fi
before=$(sed -n 's/^status=//p' "$STATE" 2>/dev/null)
printf 'status=%s\nrestarts=%s\n' "$now" "$restarts" > "$STATE"

post() { curl -fsS -m 15 -H "Title: $1" -d "$2" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null || echo "watchdog: ntfy post failed" >&2; }
if [ "$now" != "${before:-ok}" ]; then
  if [ "$now" = ok ]; then
    post "Polymono recovered" "The game backend is healthy again."
  else
    post "Polymono needs attention" "Problem: $now. Logs: pm2 logs $APP"
  fi
fi
echo "watchdog: $now"
