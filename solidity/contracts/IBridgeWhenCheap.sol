// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// A request of what is to be bridged from L2 to L1
// together with the wanted L1 gas price at which this should be executed.
struct BridgeRequest {
    address source;
    address destination;
    bool isTokenTransfer;
    IERC20 token;
    uint256 amount;
    uint256 amountOutMin;
    uint256 wantedL1GasPrice;
    uint256 l2execGasFeeDeposit; // we also store this here, because the l2execGasFeeDeposit amount might change during the lifetime of the contract.
}

interface IBridgeWhenCheap {
    // ===================== ESSENTIAL FUNCTIONS

    event BridgeRequested(
        uint256 indexed requestId,
        BridgeRequest indexed request
    );
    event BridgeExecutionSubmitted(
        uint256 indexed requestId,
        BridgeRequest indexed request
    );
    event BridgeRequestWithdrawn(
        uint256 indexed requestId,
        BridgeRequest indexed request
    );

    function deposit(
        uint256 requestId,
        IERC20 tokenOrEtherAddr,
        uint256 tokenAmount,
        address destination,
        uint256 wantedL1GasPrice,
        uint256 amountOutMin
    ) external payable;

    function withdraw(uint256 requestId) external;

    function executeRequest(
        address requestor,
        uint256 requestId,
        uint256 bonderFee,
        uint256 destAmmDeadline
    ) external;

    // ====================== OWNER MANAGEMENT FUNCTIONS

    function ownerDeposit() external payable;

    function ownerWithdraw(uint256 amount) external;

    function setL2execGasFeeDeposit(uint256 amount) external;

    function setServiceFee(uint256 amount) external;

    function addSupportForNewToken(
        IERC20 token,
        address tokenHopBridge
    ) external;
}

// Sourced from: https://github.com/hop-protocol/contracts/blob/v1/contracts/bridges/L2_AmmWrapper.sol#L58
interface HopL2AmmWrapper {
    function swapAndSend(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destAmountOutMin,
        uint256 destDeadline
    ) external payable;
}
