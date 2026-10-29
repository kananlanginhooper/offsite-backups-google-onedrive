#!/bin/bash
# Google Drive queue: runs the batches in PUSH_GDRIVE_QUEUE in order until nothing is left,
# resuming an hour later after Google's daily upload cap.
# Order rule (owner, 2026-09-27): documents first, then projects, video last; video only when tagged.
# Each queue entry is "batch:<name>" (a batch in PUSH_BATCHES_FILE) or "project:<name>".
set -u
cd "$(dirname "$0")"
eval "$(python3 config.py PUSH_GDRIVE_QUEUE PUSH_BATCHES_FILE)"
mkdir -p logs
LOG=logs/offsite-push.log
while pgrep -f "python3 gdrive_push.py" > /dev/null; do sleep 120; done

IFS=';' read -ra QUEUE <<< "$PUSH_GDRIVE_QUEUE"
while true; do
  left=0
  for entry in "${QUEUE[@]}"; do
    kind=${entry%%:*}; name=${entry#*:}
    if [ "$kind" = batch ] && python3 -c "import json,os,sys; b=json.load(open(os.environ['PUSH_BATCHES_FILE']))[sys.argv[1]]; sys.exit(0 if b.get('paused') else 1)" "$name"; then
      echo "$(date -Is) skip $entry (paused in the batches file)" >> $LOG
      continue
    fi
    out="logs/gdrive-$kind-$name.log"
    echo "$(date -Is) run $entry" >> $LOG
    if [ "$kind" = project ]; then
      nice -n 10 python3 gdrive_push.py --batch "project-$name" --project "$name" >> "$out" 2>&1
    else
      nice -n 10 python3 gdrive_push.py --batch "$name" --batch-def "$name" >> "$out" 2>&1
    fi
    n=$(grep -E "hashes, .* GB to push" "$out" | tail -1 | sed -E 's/.*: ([0-9]+) hashes.*/\1/')
    echo "$(date -Is) $entry started with ${n:-?} hashes left" >> $LOG
    [ "${n:-1}" != "0" ] && left=1
  done
  [ $left = 0 ] && { echo "$(date -Is) all pushed" >> $LOG; break; }
  sleep 3600
done
