#!/bin/bash

set -eu

cp ../solidity/artifacts/contracts/IBridgeWhenCheap.sol/IBridgeWhenCheap.json pre-built/IBridgeWhenCheap.json ||
  (echo "Please build the solidity project first" && exit 1)

cp -r ../solidity/typechain-types pre-built/ ||
  (echo "Please build the solidity project tests first" && exit 1)
