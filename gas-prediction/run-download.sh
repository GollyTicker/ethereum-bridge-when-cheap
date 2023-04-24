#!/bin/bash

ENDPOINT="$(cat .endpoint)"

BLOCKNR="$1"

DURATION="5m"

while true; do
  echo "$(date) - Running script..."
  python3 -u download.py "$ENDPOINT" "$BLOCKNR" && echo "$(date) - Done. Waiting for a $DURATION before downloading again..." && sleep "$DURATION" && continue
  echo "$(date) - Error. Aborting."
  break
done
