#!/bin/bash
# push-ctl.sh gdrive|onedrive start|stop|status
# Starts or stops one provider's push queue. Starting needs the job lock: the owner file
# $PUSH_JOB_LOCK_DIR/<job>/owner must match $PUSH_JOB_OWNER_PATTERN (one owner per job).
set -u
cd "$(dirname "$0")"
eval "$(python3 config.py GDRIVE_REMOTE ONEDRIVE_REMOTE PUSH_JOB_LOCK_DIR PUSH_JOB_OWNER_PATTERN)"

provider=${1:-}; action=${2:-}
case "$provider" in
  gdrive) job=offsite-push; queue=./push-queue.sh; py=gdrive_push.py; remote=${GDRIVE_REMOTE%:}: ;;
  onedrive) job=onedrive-push; queue=./onedrive-queue.sh; py=onedrive_push.py; remote=${ONEDRIVE_REMOTE%:}: ;;
  *) echo "usage: push-ctl.sh gdrive|onedrive start|stop|status"; exit 2 ;;
esac
mkdir -p logs

# never match this script's own process (pkill -f would)
pids() { ps -eo pid=,args= | awk -v me=$$ -v q="${queue#./}" -v py="$py" -v r="$remote" \
  '$1 != me && (index($0, "bash " q) || index($0, "python3 " py) || (index($0, "rclone ") && index($0, r))) {print $1}'; }

case "$action" in
  stop) p=$(pids); [ -n "$p" ] && kill $p; sleep 2; echo "stopped: ${p:-none}" ;;
  start)
    owner_file="$PUSH_JOB_LOCK_DIR/$job/owner"
    grep -qE "$PUSH_JOB_OWNER_PATTERN" "$owner_file" 2>/dev/null || { echo "$job is not owned by this runner:"; cat "$owner_file" 2>/dev/null || echo FREE; exit 3; }
    rclone lsd "$remote" > /dev/null 2>&1 || { echo "$remote is not configured or not signed in"; exit 4; }
    [ -n "$(pids)" ] && { echo "already running"; exit 1; }
    setsid -f bash -c "$queue" < /dev/null > /dev/null 2>&1; echo started ;;
  status) p=$(pids | paste -sd, -); [ -n "$p" ] && ps -o pid=,etime=,args= -p "$p" | cut -c1-120; tail -3 "logs/$job.log" 2>/dev/null ;;
  *) echo "usage: push-ctl.sh gdrive|onedrive start|stop|status"; exit 2 ;;
esac
