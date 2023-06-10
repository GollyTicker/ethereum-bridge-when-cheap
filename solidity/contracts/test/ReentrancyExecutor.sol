// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../IBridgeWhenCheap.sol";

// If this order is changed, then the typescript code needs to be adapted as well.
enum ReentrancyFunction {
    none,
    deposit,
    withdraw,
    executeRequest,
    ownerWithdraw
}

abstract contract ReentrancyExecutor {
    ReentrancyFunction public reentrancyFunction = ReentrancyFunction.none;
    IBridgeWhenCheap reentrancyTarget;

    function attemptReentrancyAttack() public {
        if (reentrancyFunction == ReentrancyFunction.none) {
            // do nothing
        } else if (reentrancyFunction == ReentrancyFunction.deposit) {
            reentrancyTarget.deposit{value: 0}(
                IERC20(address(0)),
                0,
                msg.sender,
                10,
                0
            );
        } else if (reentrancyFunction == ReentrancyFunction.withdraw) {
            reentrancyTarget.withdraw(0);
        } else if (reentrancyFunction == ReentrancyFunction.executeRequest) {
            reentrancyTarget.executeRequest(msg.sender, 0, 0, 0);
        } else if (reentrancyFunction == ReentrancyFunction.ownerWithdraw) {
            reentrancyTarget.ownerWithdraw(0);
        }
    }

    function setReentrancy(ReentrancyFunction func, address target) public {
        reentrancyFunction = func;
        reentrancyTarget = IBridgeWhenCheap(target);
    }
}
