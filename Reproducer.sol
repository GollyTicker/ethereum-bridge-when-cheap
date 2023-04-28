// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Reproducer is Ownable, ReentrancyGuard {
    function deposit(
        address token,
        uint256 wantedL1GasPrice
    ) external payable nonReentrant {
        // CHECKS
        require(msg.sender != address(0), "Sender may not be 0 address");
        require(
            wantedL1GasPrice > 0,
            "Wanted L1 gas price must be strictly positive"
        );
        require(
            msg.value >= 0,
            "Not enough funds to pay for delayed execution"
        );

        bool isTokenTransfer = true;
        uint256 sentAmount;
        if (!isTokenTransfer) {
            sentAmount = msg.value - 0;
        }

        require(IERC20(token).transferFrom(msg.sender, address(this), 0));
    }
}
