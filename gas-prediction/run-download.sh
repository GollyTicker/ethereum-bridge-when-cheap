#!/bin/bash

ENDPOINT="$(cat .endpoint)"

BLOCKNR="$1"

python3 -u download.py "$ENDPOINT" "$BLOCKNR"
