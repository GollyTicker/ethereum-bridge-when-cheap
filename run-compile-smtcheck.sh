#!/bin/bash

set -eu

JSON="{
  \"language\": \"Solidity\",
  \"sources\": {
    \"Reproducer.sol\": { \"content\": $(cat Reproducer.sol | jq -Rs .) }
  },
  \"settings\": {
    \"modelChecker\": {
      \"engine\": \"chc\",
      \"timeout\": 10000,
      \"showUnproved\": true,
      \"contracts\": {
        \"Reproducer.sol\": [\"Reproducer\"]
      },
      \"targets\": [\"assert\", \"underflow\", \"balance\", \"constantCondition\"],
      \"invariants\": [\"contract\", \"reentrancy\"]
    }
  }
}"

# requires solc installed as unix package.
echo "$JSON" | solc --standard-json --base-path . --include-path node_nodules > out.log 2> out.err

cat out.log | jq "."

echo "=============== formatted ==================="
cat out.log | jq -r ".errors[].formattedMessage"
