#!/bin/bash

set -eu

# based on: https://docs.soliditylang.org/en/v0.8.17/using-the-compiler.html#input-description

JSON="{
  \"language\": \"Solidity\",
  \"sources\": {
    \"BridgeWhenCheap.sol\": { \"content\": $(cat contracts/BridgeWhenCheap.sol | jq -Rs .) }
  },
  \"settings\": {
    \"modelChecker\": {
      \"engine\": \"chc\",
      \"showUnproved\": true,
      \"contracts\": {
        \"BridgeWhenCheap.sol\": [\"BridgeWhenCheap\"]
      },
      \"targets\": [\"assert\", \"underflow\", \"balance\"],
      \"invariants\": [\"contract\", \"reentrancy\"]
    }
  }
}"

rm -rf out/* || true
echo "$JSON" |
  npx solc --verbose --standard-json --base-path . --include-path .deps/npm --include-path node_nodules |
  jq
