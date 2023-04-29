#!/bin/bash

set -eu

docker run \
  -v "$PWD:/wd" \
  --entrypoint bash \
  mythril/myth \
  -c '
    set -eu
    cd /wd
    echo "Running in $PWD ..."
    myth -v 4 \
      analyze \
      --solc-args "--base-path . --include-path node_modules" \
      --solc-json /wd/mythril.solc.json \
      --solv 0.8.19 \
      contracts/BridgeWhenCheap.sol \
      -t 1 --parallel-solving -b 10 --execution-timeout 120
    # --transaction-sequences "[[0xa191078a]]" \
  '

#analyze \
#--solc-args "--base-path /wd/contracts/ --include-path /#wd/node_modules/" \
#--solv 0.8.19 \
#BridgeWhenCheap.sol
