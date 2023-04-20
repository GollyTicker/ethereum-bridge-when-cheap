// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct BridgeRequest {
    address source;
    address destination;
    
    bool isTokenTransfer;
    IERC20 token;

    uint256 amount;
    uint256 amountOutMin;
    
    uint256 wantedL1GasPrice;
    uint256 depositedL2gasFund;
}

/// @custom:security-contact bridge-when-cheap@gmail.com
contract BridgeWhenCheap is Ownable, ReentrancyGuard {
    // The amount of total gas required to execute a single L2 -> L1 Hop Bridge.
    // This amount is deducted from requestors to pay for the gas fees of the delayed execution.
    uint256 public executionGasRequirement;

    // the service fee deducted for each request.
    // It must be larger than the executionGasRequirement.
    // Service fee includes infrastructure hosting and development costs.
    uint256 public serviceFee;

    // the amount of service fee collected excluding execution gas fees.
    // Only this amount is allowed to be deducted by the contract owner to pay for infrastructure/development/etc.
    uint256 public collectedNonGasServiceFee;

    // For each requestor, it stores a struct with the request details for the briding.
    mapping(address => mapping(uint256 => BridgeRequest)) public requests;

    // destination layer 1 chain id: mainnet = 1, goerli = 5
    uint256 public layer1ChainId;

    // Supported ERC20 tokens. We use a mapping, so that we can extend the implementation with additional tokens lateron.
    // Each mapping points to the Hop Bridge L2AmmWrapper for that token for L2 -> L1.
    // This needs to be manually populated after contract deploment for each token.
    mapping(IERC20 => address) public bridgeContractOf;
    // Native Ether: token = address(0)
    // goerli arbitrum hop L2 AMM Wrapper: 0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF
    // goerli arbitrum fake l2 amm warpper: 0x1Eb7c70da731F41122f3E4fDcf7E6f723018c369

    constructor(
        uint256 _executionGasRequirement, // 0.00015 ether recommended
        uint256 _serviceFee,
        uint256 _layer1ChainId
    ) {
        executionGasRequirement = _executionGasRequirement;
        serviceFee = _serviceFee;
        layer1ChainId = _layer1ChainId;
        checkFeeInvariants();
    }

    // constraints:
    // changes in servicefee + exec-gas should only influence new deposits but not withdrawals of previous deposits
    // request executions. also, checkFeeInvariants is always true before and after txs.
    // Also, we want to make sure, that whatever happens, the deposits cannot be drained. currently, with servicefee changes
    // this might be possible. We have that the sum of all this.balance >= sum(request[*].amount) + gasstuff

    // methods are external, because they'll not be called by this contract itself. (except for helper functions).

    // Deposit funds which will be bridged to destination via Hop Bridge
    // when the L1 gas fees are at wantedL1GasPrice or lower.
    // The request is recorded in the smart contract and executed lateron,
    // by the owner of the contract, when the gas fees are low.
    function deposit(
        uint256 requestId,
        IERC20 token, // if native ETH payment, then token must be 0 address.
        // if tokenAmount == 0, then a native ETH payment is expected.
        // if tokenAmount > 0, then native ETH = gas fee requirement and tokenAmount is the amount of transfered tokens.
        uint256 tokenAmount,
        address destination,
        uint256 wantedL1GasPrice,
        uint256 amountOutMin
    ) external payable nonReentrant {
        // CHECKS
        require(msg.sender != address(0), "Sender may not be 0 address");
        require(
            destination != address(0),
            "Destination address may not be 0 address"
        );
        require(
            wantedL1GasPrice > 0,
            "Wanted L1 gas price must be strictly positive"
        );
        require(
            msg.value >= serviceFee,
            "Not enough funds to pay for delayed execution"
        );

        bool isTokenTransfer = tokenAmount != 0;
        uint256 sentAmount;

        if (isTokenTransfer) {
            require(bridgeContractOf[token] != address(0), "Token is not supported.");
            require(msg.value == serviceFee, "For token deposits, pay the service fee exactly.");
            sentAmount = tokenAmount;
        }
        else {
            require(address(token) == address(0), "Token must be 0 address, when depositing native ether.");
            // keep some funds for ourselves for service (delayed execution gas, infrastructure, etc.) 
            sentAmount = msg.value - serviceFee;
        }

        require(
            sentAmount >= amountOutMin,
            "Calculated sent amount must be larger than the required minimum amount arriving at destination."
        );

        require(
            !isDefined(requests[msg.sender][requestId]),
            "request with the same id for the requestor already exists."
        );

        // CHANGES
        recordCollectedNonGasServiceFee();

        requests[msg.sender][requestId] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            isTokenTransfer: isTokenTransfer,
            token: token,
            amount: sentAmount,
            amountOutMin: amountOutMin,
            wantedL1GasPrice: wantedL1GasPrice,
            depositedL2gasFund: executionGasRequirement
        });

        // INTERACTIONS
        // receive deposit. native ether happens automatically. token transfer needs to be done explicitly.
        if (isTokenTransfer) {
            require( token.transferFrom(msg.sender, address(this), sentAmount) );
        }
    }

    // Cancel any request and withdraw the funds.
    function withdraw(uint256 requestId) external nonReentrant {
        // CHECKS
        BridgeRequest memory obsoleteRequest = requests[msg.sender][requestId]; // This is a copy, not a reference.
        require(isDefined(obsoleteRequest), "No request to withdraw");
        assert(obsoleteRequest.source == msg.sender);

        uint256 withdrawAmount;
        uint256 nativeEtherAmount = obsoleteRequest.depositedL2gasFund;

        if (obsoleteRequest.isTokenTransfer) {
            withdrawAmount += obsoleteRequest.amount;
        } else {
            nativeEtherAmount += obsoleteRequest.amount;
        }

        // CHANGES
        delete requests[msg.sender][requestId];

        // INTERACTIONS
        require( payable(msg.sender).send(nativeEtherAmount) );
        require( obsoleteRequest.token.transferFrom(address(this), msg.sender, withdrawAmount) );
    }

    // Execute the request for the given requestor address.
    // The execution gas is refunded to the caller and the bridging
    // is executed via the Hop Bridge.
    function executeRequest(
        address requestor,
        uint256 requestId,
        // these fields are calculated just before executing the request to find these parameters via "populateSendTx"
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destAmountOutMin,
        uint256 destDeadline
    )
        external onlyOwner nonReentrant
    {
        // CHECKS
        BridgeRequest memory toBeBridgedRequest = requests[requestor][requestId];
        require(isDefined(toBeBridgedRequest), "No request to process");
        require(
            toBeBridgedRequest.amount >= bonderFee,
            "Bonder fee cannot exceed amount."
        );
        uint256 nativeEtherSent = toBeBridgedRequest.isTokenTransfer ? 0 : toBeBridgedRequest.amount;
        address bridgeContract = bridgeContractOf[toBeBridgedRequest.token];

        // CHANGES
        delete requests[requestor][requestId];

        // INTERACTIONS
        HopL2AmmWrapper(bridgeContract).swapAndSend{ value: nativeEtherSent } (
            layer1ChainId,
            toBeBridgedRequest.destination,
            toBeBridgedRequest.amount,
            bonderFee,
            amountOutMin,
            deadline,
            destAmountOutMin,
            destDeadline
        );
        // refund execution gas to caller
        require( payable(msg.sender).send(toBeBridgedRequest.depositedL2gasFund) );
    }

    // ====================== OWNER MANAGEMENT FUNCTIONS

    // allow the owner to fund, if somehow the gas prices rise a lot and gas deposits aren't enough
    function ownerDeposit() external payable onlyOwner { }

    function ownerWithdraw(uint256 amount) external onlyOwner nonReentrant {
        require(collectedNonGasServiceFee >= amount, "Cannot withdraw more funds than the collected non gas service fees.");
        require( payable(msg.sender).send(amount) );
    }

    // If the L2 network gas prices rise for a longer duration, we can adapt the gas deposit the users have to make.
    function setExecutionGasRequirement(uint256 amount) external onlyOwner {
        executionGasRequirement = amount;
        checkFeeInvariants();
    }

    function setserviceFee(uint256 amount) external onlyOwner {
        serviceFee = amount;
        checkFeeInvariants();
    }

    // If hop bridge is extended, we can add new tokens here. We always want to point to the L2_AmmWrapper contract
    function addSupportForNewToken(IERC20 token, address tokenHopBridge) external onlyOwner {
        require(bridgeContractOf[token] == address(0), "Token already supported.");
        bridgeContractOf[token] = tokenHopBridge;
    }

    // ====================== HELPER FUNCTIONS

    function checkFeeInvariants() internal view {
        require(serviceFee >= executionGasRequirement, "service fee must cover at least the execution gas requirement");
    }

    function recordCollectedNonGasServiceFee() internal {
        collectedNonGasServiceFee += serviceFee - executionGasRequirement;
    }

    // Returns true iff the request is not it's default zero-value.
    function isDefined(BridgeRequest memory request)
        internal
        pure
        returns (bool)
    {
        return request.source != address(0);
    }
}

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

