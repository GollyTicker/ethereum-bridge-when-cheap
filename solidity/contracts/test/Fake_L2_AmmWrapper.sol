// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;


contract Fake_L2_AmmWrapper {
    constructor() {}

    event SwapAndSend(
        address sender,
        uint256 paidAmount,
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destAmountOutMin,
        uint256 destDeadline
    );

    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destAmountOutMin,
        uint256 destDeadline
    ) external payable {
        emit SwapAndSend(msg.sender, msg.value, chainId, recipient, amount, bonderFee, amountOutMin, deadline, destAmountOutMin, destDeadline);
    }
}
