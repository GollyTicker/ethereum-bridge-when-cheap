#!/bin/bash

set -eu

npx hardhat coverage

(xdg-open coverage/index.html) || true
