// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../IBridgeWhenCheap.sol";
import "./ReentrancyExecutor.sol";

contract Adversary is ReentrancyExecutor {
    // this contract doesn't have a payable function to actually receive ether and hence allows for testing failed sends

    IBridgeWhenCheap bwc;

    constructor(IBridgeWhenCheap _bwc) {
        bwc = _bwc;
    }

    function callOwnerWithdraw() external {
        bwc.ownerWithdraw(1);
    }

    function callExecuteRequest(address requestor) external {
        bwc.executeRequest(requestor, 0, 0, 0);
    }

    function callDepositAndWithdraw() external payable {
        bwc.deposit{value: 100}(0, IERC20(address(0)), 0, msg.sender, 1, 0);
        bwc.withdraw(0);
    }
}
