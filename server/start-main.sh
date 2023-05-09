#!/bin/bash

set -eu

cd server 2>/dev/null || true

if [[ "$(swapon -s)" == "" ]]; then
  echo "OS must use Swap of at least 1g. Otherwise OS will get OOM issues!"
  echo "Check: https://linuxize.com/post/create-a-linux-swap-file/"
  exit 1
fi

docker build -t bwc-server:latest .
docker rm -f bwc-server || true
docker run \
  --name bwc-server \
  -v "./data:/wd/data" \
  --cpus="1" \
  --memory="400m" \
  "bwc-server:latest"
