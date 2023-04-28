#!/bin/bash

set -eu

# based on: https://docs.soliditylang.org/en/v0.8.17/using-the-compiler.html#input-description

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
