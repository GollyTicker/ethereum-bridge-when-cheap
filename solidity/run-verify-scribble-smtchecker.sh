#!/bin/bash

set -eu

COMMAND="scribble contracts/BridgeWhenCheap.sol \
  --output-mode files \
  --instrumentation-metadata-file scrible.metadata.json"

npx $COMMAND --disarm || true

npx $COMMAND --arm

./run-compile-smtchecker.sh
