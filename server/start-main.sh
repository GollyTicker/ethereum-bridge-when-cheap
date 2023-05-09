#!/bin/bash

set -eu

cd server 2>/dev/null || true

docker build -t bwc-server:latest .
docker rm -f bwc-server || true
docker run \
  --name bwc-server \
  -v "./data:/wd/data" \
  --cpus="1" \
  --memory="400m" \
  "bwc-server:latest"
