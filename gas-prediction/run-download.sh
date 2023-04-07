#!/bin/bash

ENDPOINT="$(cat .endpoint)"

python3 download.py "$ENDPOINT"
