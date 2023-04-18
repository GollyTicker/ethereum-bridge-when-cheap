// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
// pragma abicoder v2;
// ^ We don't need this explicitly here. Solidity v0.8 onwards v2 already.
// Explicit adding of this only causes deployment issues. 

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
} 

/// @custom:security-contact bridge-when-cheap@gmail.com
contract BridgeWhenCheap is Ownable, ReentrancyGuard {

    // The amount of total gas required to execute a single L2 -> L1 Hop Bridge.
    // This amount is deducted from requestors to pay for the gas fees of the delayed execution.
    uint256 executionGasRequirement;

    // address of the deloyed hop bridge to interact with to bridge funds.
    L2_AmmWrapper public l2HopBridgeAmmWrapper;
    // goerli arbitrum hop L2 AMM Wrapper: 0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF
    // goerli arbitrum fake l2 amm warpper: 0x1Eb7c70da731F41122f3E4fDcf7E6f723018c369

    // For each requestor, it stores a struct with the request details for the briding.
    mapping(address => BridgeRequest) requests;

    // todo. make it possible to have multiple requests per address.

    constructor(
        uint256 _executionGasRequirement, // 0.00015 ether recommended
        L2_AmmWrapper _l2HopBridgeAmmWrapper
    ) {
        executionGasRequirement = _executionGasRequirement;
        l2HopBridgeAmmWrapper = _l2HopBridgeAmmWrapper;
    }

    // View any pending requests belonging to the caller
    function pendingRequests()
        public
        view
        returns (BridgeRequest memory, bool)
    {
        BridgeRequest memory request = requests[msg.sender]; // Copy, not reference.
        return (request, isDefined(request));
    }

    // Deposit funds which will be bridged to destination via Hop Bridge
    // when the L1 gas fees are at wantedL1GasPrice or lower.
    // The request is recorded in the smart contract and executed lateron,
    // by the owner of the contract, when the gas fees are low.
    function deposit(
        address destination,
        uint256 wantedL1GasPrice,
        uint256 amountOutMin
    ) public payable {
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
            msg.value >= executionGasRequirement,
            "Not enough funds to pay for delayed execution"
        );

        uint256 sentAmount = msg.value - executionGasRequirement; // keep some funds for ourselves for execution + service fee

        require(
            sentAmount >= amountOutMin,
            "Calculated sent amount must be larger than the required minimum amount arriving at destination."
        );

        requests[msg.sender] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            amount: sentAmount,
            amountOutMin: amountOutMin,
            wantedL1GasPrice: wantedL1GasPrice
        });
    }

    // Cancel any request and withdraw the funds.
    function withdraw() public nonReentrant {
        BridgeRequest memory obsoleteRequest = requests[msg.sender]; // This is a copy, not a reference.
        require(isDefined(obsoleteRequest), "No request to withdraw");

        delete requests[msg.sender];

        assert(obsoleteRequest.source == msg.sender);

        // todo. also recover gas fee requirement here?
        bool success = payable(msg.sender).send(obsoleteRequest.amount);
        require(success, "Failed to withdraw funds to msg.sender");
    }

    // Execute the request for the given requestor address.
    // The execution gas is refunded to the caller and the bridging
    // is executed via the Hop Bridge.
    function executeRequest(
        address requestor,
        // these fields are calculated just before executing the request to find these parameters via "populateSendTx"
        uint256 bonderFee,
        SwapData memory swapData,
        SwapData memory destinationSwapData,
        address bonder
    )
        public onlyOwner nonReentrant
    {
        BridgeRequest memory toBeBridgedRequest = requests[requestor];
        require(isDefined(toBeBridgedRequest), "No request to process");
        require(
            toBeBridgedRequest.amount >= bonderFee,
            "Bonder fee cannot exceed amount."
        );

        delete requests[requestor];

        // refund execution gas to caller
        bool success = payable(msg.sender).send(executionGasRequirement);
        require(success, "Failed to refund executor");

        l2HopBridgeAmmWrapper.swapAndSend{ value: toBeBridgedRequest.amount }(
            1, // destination always mainnet
            toBeBridgedRequest.destination,
            toBeBridgedRequest.amount,
            bonderFee,
            swapData,
            destinationSwapData,
            bonder
        );
    }

    // If the L2 network gas prices rise for a longer duration, we can adapt the gas deposit the users have to make.
    function setExecutionGasRequirement(uint256 amount) public onlyOwner {
        executionGasRequirement = amount;
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
        SwapData memory swapData,
        SwapData memory destinationSwapData,
        address bonder
    ) external payable;
}

struct SwapData {
    uint8 tokenIndex;
    uint256 amountOutMin;
    uint256 deadline;
}
