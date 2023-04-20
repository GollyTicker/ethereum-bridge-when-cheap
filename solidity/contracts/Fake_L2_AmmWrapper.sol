// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;


/// @custom:security-contact bridge-when-cheap@gmail.com
contract Fake_L2_AmmWrapper {
    constructor() {}

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
    }
}
