#!/bin/bash

set -eu

npx hardhat test "$@"
