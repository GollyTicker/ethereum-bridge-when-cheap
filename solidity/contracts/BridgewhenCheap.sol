// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

struct BridgeRequest {
    address source;
    address destination;
    uint amount;
    uint wantedL1GasPrice;
    // todo. need more arguments here to be able to call hop's L2_AMMWrapper's swapAndSend
    // todo. support tokens and not only native ether
}

/// @custom:security-contact bridge-when-cheap@gmail.com
contract BridgeWhenCheap is Ownable, ReentrancyGuard {
    // The amount of total gas required to execute a single L2 -> L1 Hop Bridge.
    // This amount is deducted from requestors to pay for the gas fees of the delayed execution.
    uint executionGasRequirement;

    // address of the deloyed hop bridge to interact with to bridge funds.
    address l2HopBridgeAmmWrapper;

    // For each requestor, it stores a struct with the request details for the briding.
    mapping(address => BridgeRequest) requests;
    // todo. make it possible to have multiple requests per address.

    constructor(
        uint _executionGasRequirement, /* 0.00015 ether recommended*/
        address _l2HopBridgeAmmWrapper
    ) {
        executionGasRequirement = _executionGasRequirement;
        l2HopBridgeAmmWrapper = _l2HopBridgeAmmWrapper;
    }

    // View any pending requests belonging to the caller
    function pendingRequests() public view returns (BridgeRequest memory, bool) {
        BridgeRequest memory request = requests[msg.sender]; // Copy, not reference.
        return (request, isDefined(request));
    }

    // Deposit funds which will be bridged to destination via Hop Bridge
    // when the L1 gas fees are at wantedL1GasPrice or lower.
    // The request is recorded in the smart contract and executed lateron,
    // by the owner of the contract, when the gas fees are low.
    function deposit(address destination, uint wantedL1GasPrice) public payable {
        require(msg.sender != address(0), "Sender may not be 0 address");
        require(destination != address(0), "Destination address may not be 0 address");
        require(wantedL1GasPrice > 0, "Wanted L1 gas price must be strictly positive");
        require(msg.value >= executionGasRequirement, "Not enough funds to pay for delayed execution");
        
        uint sentAmount = msg.value - executionGasRequirement; // keep some funds for ourselves for execution + service fee
        // payable(this.address).send(executionGasRequirement); // we don't need to actually send the funds to ourselves, right?

        requests[msg.sender] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            amount: sentAmount,
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
    function executeRequest(address requestor) public onlyOwner nonReentrant {
        BridgeRequest memory toBeBridgedRequest = requests[requestor];
        require(isDefined(toBeBridgedRequest), "No request to process");

        delete requests[requestor];

        // refund execution gas to caller
        bool success = payable(msg.sender).send(executionGasRequirement);
        require(success, "Failed to refund executor");

        // todo. we need to test the sending here as well.
        // todo. actually use request arguments
        success = payable(l2HopBridgeAmmWrapper).send(toBeBridgedRequest.amount);
        require(success, "Failed to submit bridge request to Hop Bridge");
    }

    // If the L2 network gas prices rise for a longer duration, we can adapt the gas deposit the users have to make.
    function setExecutionGasRequirement(uint amount) public onlyOwner {
        executionGasRequirement = amount;
    }

    // Returns true iff the request is not it's default zero-value.
    function isDefined(BridgeRequest memory request) pure internal returns (bool) {
        return request.source != address(0);
    }
}