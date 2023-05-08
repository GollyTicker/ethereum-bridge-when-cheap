#!/bin/bash

set -eu

cd server 2>/dev/null || true

docker build -t bwc-server:latest .
docker run \
  -d --rm --name bwc-server \
  -v "./data:/wd/data" \
  --cpus="0.25" \
  "bwc-server:latest"
