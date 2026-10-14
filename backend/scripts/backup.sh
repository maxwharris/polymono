#!/bin/bash
# Postgres backups for Polymono, on the box. Reads DB_* from backend/.env and writes pg_dump custom-format
# files (restore: pg_restore --clean --if-exists --no-owner -d <db> <file>) to ~/backups/polymono (BACKUP_DIR).
#
#   backup.sh                   nightly-<utc time>.dump; deletes nightly dumps older than 14 days
#   backup.sh predeploy <sha>   predeploy-<utc time>-<sha>.dump; keeps the newest 10. deploy.sh runs this, and
#                               it only warns (exit 0) when pg_dump is not installed
#
# Nightly: install as /etc/cron.d/polymono-backup (root:root, mode 644). Logs: sudo journalctl -t polymono-backup
#   NTFY_TOPIC=<topic>
#   30 4 * * * ubuntu /var/www/polymono/backend/scripts/backup.sh 2>&1 | logger -t polymono-backup
# NTFY_TOPIC is optional: when set, a failed nightly backup posts a short alert to https://ntfy.sh/<topic>.
# BACKUP_S3_URI (in backend/.env, e.g. s3://bucket/polymono) is optional: each dump is also copied there with the
# AWS CLI, using the box's instance role (upload-only; the bucket deletes copies after 90 days).

set -euo pipefail
umask 077

MODE=${1:-nightly}
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
DIR=${BACKUP_DIR:-$HOME/backups/polymono}
STAMP=$(date -u +%Y%m%d-%H%M%S)

alert() {
  [ "$MODE" = nightly ] && [ -n "${NTFY_TOPIC:-}" ] || return 0
  curl -fsS -m 15 -H "Title: Polymono backup failed" -H "Tags: warning" \
    -d "The nightly database backup failed at $(date -u '+%Y-%m-%d %H:%M') UTC. Logs: journalctl -t polymono-backup" \
    "https://ntfy.sh/$NTFY_TOPIC" >/dev/null || echo "backup: could not send the ntfy alert" >&2
}
fail() { echo "backup: $*" >&2; [ -z "${FILE:-}" ] || rm -f "$FILE.partial"; alert; exit 1; }
trap 'fail "failed at line $LINENO"' ERR

case "$MODE" in
  nightly) FILE="$DIR/nightly-$STAMP.dump" ;;
  predeploy) FILE="$DIR/predeploy-$STAMP-${2:?usage: backup.sh predeploy <sha>}.dump" ;;
  *) echo "usage: backup.sh [predeploy <sha>]" >&2; exit 2 ;;
esac

if ! command -v pg_dump >/dev/null; then
  [ "$MODE" = predeploy ] && { echo "backup: WARNING pg_dump not installed, deploying without a backup" >&2; exit 0; }
  fail "pg_dump not installed (sudo apt install postgresql-client-16)"
fi
[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found"

# DB_* from .env without executing it: last KEY=value wins, surrounding quotes dropped.
envval() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"; }
DB_NAME=$(envval DB_NAME)
[ -n "$DB_NAME" ] || fail "DB_NAME is not set in $ENV_FILE"
export PGHOST=$(envval DB_HOST) PGPORT=$(envval DB_PORT) PGUSER=$(envval DB_USER) PGPASSWORD=$(envval DB_PASSWORD)
[ -n "$PGHOST" ] || unset PGHOST
[ -n "$PGPORT" ] || unset PGPORT

mkdir -p "$DIR"
# Written under a temporary name and checked, so a file with the final name is always a complete dump.
pg_dump --format=custom --dbname="$DB_NAME" --file="$FILE.partial" || fail "pg_dump of $DB_NAME failed"
pg_restore --list "$FILE.partial" >/dev/null || fail "the dump does not read back"
mv "$FILE.partial" "$FILE"
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"

# Offsite copy. A failed upload fails (and alerts) the nightly run; before a deploy it only warns.
S3_URI=$(envval BACKUP_S3_URI)
if [ -n "$S3_URI" ]; then
  AWS=$(command -v aws || echo /snap/bin/aws)
  if "$AWS" s3 cp "$FILE" "${S3_URI%/}/$(basename "$FILE")" --only-show-errors; then
    echo "backup: copied to ${S3_URI%/}/"
  elif [ "$MODE" = nightly ]; then
    fail "the offsite copy to $S3_URI failed"
  else
    echo "backup: WARNING the offsite copy to $S3_URI failed" >&2
  fi
fi

if [ "$MODE" = nightly ]; then
  find "$DIR" -maxdepth 1 -name 'nightly-*.dump' -mtime +13 -delete
else
  ls -1t "$DIR"/predeploy-*.dump | tail -n +11 | while read -r old; do rm -f -- "$old"; done
fi
