#!/bin/bash

set -eu

npx hardhat coverage "$@"

(xdg-open coverage/index.html >/dev/null 2>&1) || true
