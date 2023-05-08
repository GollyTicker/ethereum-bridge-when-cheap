#!/bin/bash

set -eu

cd server 2>/dev/null || true

docker build -t bwc-server:latest .
docker run \
  -d --rm --name bwc-server \
  -v "./data:/wd/data" \
  "bwc-server:latest"
