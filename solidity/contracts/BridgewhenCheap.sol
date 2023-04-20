// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

struct BridgeRequest {
    address source;
    address destination;
    uint256 amount;
    uint256 amountOutMin; // this is calculated in the UI and shown to the user as a guarantee of what will definitely arrive.
    // todo. we need to decrease this by our estimated amount of what changes due differing situations between submit-time and execution time.
    uint256 wantedL1GasPrice;
    // todo. support tokens and not only native ether
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

    // address of the deloyed hop bridge to interact with to bridge funds.
    address public l2HopBridgeAmmWrapper;
    // goerli arbitrum hop L2 AMM Wrapper: 0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF
    // goerli arbitrum fake l2 amm warpper: 0x1Eb7c70da731F41122f3E4fDcf7E6f723018c369

    // For each requestor, it stores a struct with the request details for the briding.
    mapping(address => mapping(uint256 => BridgeRequest)) public requests;

    uint256 public layer1ChainId; // mainnet = 1, goerli = 5

    constructor(
        uint256 _executionGasRequirement, // 0.00015 ether recommended
        uint256 _serviceFee,
        address _l2HopBridgeAmmWrapper,
        uint256 _layer1ChainId
    ) {
        executionGasRequirement = _executionGasRequirement;
        serviceFee = _serviceFee;
        l2HopBridgeAmmWrapper = _l2HopBridgeAmmWrapper;
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
        address destination,
        uint256 wantedL1GasPrice,
        uint256 amountOutMin
    ) external payable {
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

        uint256 sentAmount = msg.value - serviceFee; // keep some funds for ourselves for service (delayed execution gas, infrastructure, etc.) 

        require(
            sentAmount >= amountOutMin,
            "Calculated sent amount must be larger than the required minimum amount arriving at destination."
        );

        require(
            !isDefined(requests[msg.sender][requestId]),
            "request with the same id for the requestor already exists."
        );

        collectNonGasServiceFee();

        requests[msg.sender][requestId] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            amount: sentAmount,
            amountOutMin: amountOutMin,
            wantedL1GasPrice: wantedL1GasPrice,
            depositedL2gasFund: executionGasRequirement
        });
    }

    // Cancel any request and withdraw the funds.
    function withdraw(uint256 requestId) external nonReentrant {
        BridgeRequest memory obsoleteRequest = requests[msg.sender][requestId]; // This is a copy, not a reference.
        require(isDefined(obsoleteRequest), "No request to withdraw");
        assert(obsoleteRequest.source == msg.sender);

        uint256 withdrawAmount = obsoleteRequest.amount + obsoleteRequest.depositedL2gasFund;
        delete requests[msg.sender][requestId];

        require( payable(msg.sender).send(withdrawAmount) );
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
        BridgeRequest memory toBeBridgedRequest = requests[requestor][requestId];
        require(isDefined(toBeBridgedRequest), "No request to process");
        require(
            toBeBridgedRequest.amount >= bonderFee,
            "Bonder fee cannot exceed amount."
        );

        delete requests[requestor][requestId];

        // refund execution gas to caller
        require( payable(msg.sender).send(toBeBridgedRequest.depositedL2gasFund) );

        L2_AmmWrapper(l2HopBridgeAmmWrapper).swapAndSend{ value: toBeBridgedRequest.amount } (
            layer1ChainId,
            toBeBridgedRequest.destination,
            toBeBridgedRequest.amount,
            bonderFee,
            amountOutMin,
            deadline,
            destAmountOutMin,
            destDeadline
        );
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

    // ====================== HELPER FUNCTIONS

    function checkFeeInvariants() internal view {
        require(serviceFee >= executionGasRequirement, "service fee must cover at least the execution gas requirement");
    }

    function collectNonGasServiceFee() internal {
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

interface L2_AmmWrapper {
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

