// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ReentrancyExecutor.sol";

contract TestToken is ERC20("TestToken", "T"), ReentrancyExecutor {
    constructor() {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        attemptReentrancyAttack();
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        attemptReentrancyAttack();
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }
}
