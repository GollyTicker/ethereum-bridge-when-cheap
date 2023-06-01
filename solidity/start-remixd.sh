#!/bin/bash

pkill -9 "remixd -s"

(
  (
    cd solidity
    remixd -s "$PWD"
  ) >>remixd.log 2>&1
) &
