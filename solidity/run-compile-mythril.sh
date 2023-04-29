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
    #solc --base-path . --include-path node_modules contracts/BridgeWhenCheap.sol --abi
    #echo "=================="
    myth -v 4 \
      analyze \
      --solc-args "--base-path . --include-path node_modules" \
      --solv 0.8.19 \
      contracts/BridgeWhenCheap.sol \
      -t 4 --parallel-solving -b 3
  '

#analyze \
#--solc-args "--base-path /wd/contracts/ --include-path /#wd/node_modules/" \
#--solv 0.8.19 \
#BridgeWhenCheap.sol
