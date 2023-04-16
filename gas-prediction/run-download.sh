#!/bin/bash

ENDPOINT="$(cat .endpoint)"

python3 -u download.py "$ENDPOINT"
