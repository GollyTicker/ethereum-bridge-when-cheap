#!/bin/bash

set -e

cd server 2>/dev/null || true

# Set this variable on developer machines to avoid this statement.
if [[ "$DEACTIVATE_SWAP" == "" ]]; then
  sudo swapon /swapfile || true
fi

if [[ "$(swapon -s)" == "" ]]; then
  echo "OS must use Swap of at least 1g. Otherwise OS will get OOM issues!"
  echo "Check: https://linuxize.com/post/create-a-linux-swap-file/"
  exit 1
fi

./0-prepare.sh

docker build -t bwc-server:latest .

docker rm -f bwc-server || true

docker run \
  -d --name bwc-server \
  -v "./data:/wd/data" \
  --cpus="1" \
  --memory="500m" \
  --memory-swap="1.2g" \
  --restart="unless-stopped" \
  "bwc-server:latest"
