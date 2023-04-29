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
      \"engine\": \"all\",
      \"timeout\": 10000,
      \"showUnproved\": true,
      \"contracts\": {
        \"BridgeWhenCheap.sol\": [\"BridgeWhenCheap\"]
      },
      \"targets\": [\"assert\", \"underflow\", \"balance\"],
      \"invariants\": [\"contract\", \"reentrancy\"]
    }
  }
}"

echo " ============= Output will be saved into out.log/out.err =============="
echo "$JSON" |
  solc --standard-json --base-path . --include-path .deps/npm --include-path node_nodules >out.log 2>out.err

cat out.log | jq "."

echo "============ formatted ============="

cat out.log | jq -r ".errors[].formattedMessage"
