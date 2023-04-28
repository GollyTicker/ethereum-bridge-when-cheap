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
      \"showUnproved\": true,
      \"contracts\": {
        \"Reproducer.sol\": [\"Reproducer\"]
      },
      \"targets\": [\"assert\", \"underflow\", \"balance\", \"constantCondition\"],
      \"invariants\": [\"contract\", \"reentrancy\"]
    }
  }
}"

echo "$JSON" |
  npx solc --verbose --standard-json --base-path . --include-path node_nodules |
  jq -r ".errors[].formattedMessage"
