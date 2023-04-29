// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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

// todo. add events. What should be emitted as an event in the first place.
// Is it sufficient to only emit on deposit, withdraw and executeReques?

// todo. creat a contact email
/// @custom:security-contact bridge-when-cheap@gmail.com
contract BridgeWhenCheap is Ownable, ReentrancyGuard {
    // The amount of total gas required to execute a single L2 -> L1 Hop Bridge via the executeRequest function.
    // This amount is deducted from requestors to pay for the gas fees of the delayed execution.
    uint256 public l2execGasFeeDeposit;

    // The service fee deducted for each request.
    // Service fee includes infrastructure hosting, execution gas fee, development, etc.
    // It must be larger than the l2execGasFeeDeposit.
    // ZERO fees are allowed in case we want to make it free for future users.
    uint256 public serviceFee;

    // The amount total service fees collected until now. Excludes execution gas fees.
    // Only this amount is allowed to be withdrawn by the contract owner to pay for infrastructure/development/etc.
    uint256 public collectedServiceFeeExcludingGas;

    // For each requestor, we store a list of pending requests.
    mapping(address => mapping(uint256 => BridgeRequest))
        public pendingRequests;

    // destination layer 1 chain id: mainnet = 1, goerli = 5
    uint256 public layer1ChainId;

    // Supported ERC20 tokens and the Hop Bridge for them.
    // We use a mapping, so that we can extend the implementation with additional tokens lateron.
    // Each mapping points to the Hop Bridge L2AmmWrapper for that token for L2 -> L1.
    // This needs to be manually populated after contract deploment for each to-be-supported token.
    mapping(IERC20 => address) public bridgeContractOf;

    // Native Ether: token = address(0)
    // arbitrum: goerli hop L2 AMM Wrapper: 0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF
    // arbitrum: goerli fake l2 amm warpper: 0x1Eb7c70da731F41122f3E4fDcf7E6f723018c369

    // solhint-disable-next-line
    constructor(
        uint256 _l2execGasFeeDeposit, // todo. find out what a reasonable initial value should be.
        uint256 _serviceFee,
        uint256 _layer1ChainId
    ) {
        l2execGasFeeDeposit = _l2execGasFeeDeposit;
        serviceFee = _serviceFee;
        layer1ChainId = _layer1ChainId;
        checkFeeInvariants();
    }

    // some constraints:
    // changes in servicefee + exec-gas should only influence new deposits but not withdrawals of previous deposits
    // request executions. also, checkFeeInvariants is always true before and after txs.
    // Also, we want to make sure, that whatever happens, the deposits cannot be drained. currently, with servicefee changes
    // this might be possible. We have that the sum of all this.balance >= sum(request[*].amount) + gasstuff
    // We want to prove at least those via formal verification.

    // ===================== ESSENTIAL FUNCTIONS

    event BridgeRequested(uint256 requestId, BridgeRequest request);

    // Deposit funds which will be bridged to destination via Hop Bridge
    // when the L1 gas fees are at wantedL1GasPrice or lower.
    // The request is recorded in the smart contract and executed lateron by the owner of the contract.
    function deposit(
        uint256 requestId,
        // if native ETH payment, then token must be 0 address.
        IERC20 token,
        // if tokenAmount == 0, then a native ETH payment is expected.
        // if tokenAmount > 0, then native ETH must equal serviceFee and tokenAmount is the desired amount of transfered tokens.
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
            require(
                msg.value == serviceFee,
                "For token deposits, pay the service fee exactly."
            );
            sentAmount = tokenAmount;
        } else {
            require(
                address(token) == address(0),
                "Token must be 0 address, when depositing native ether."
            );
            sentAmount = msg.value - serviceFee;
        }

        require(
            bridgeContractOf[token] != address(0),
            "Token/Ether-bridging is not supported/initialized."
        );

        require(
            sentAmount >= amountOutMin,
            "Calculated sent amount must be larger than the desired minimum amount arriving at destination."
        );

        require(
            !isDefined(pendingRequests[msg.sender][requestId]),
            "Request with the same id for the requestor already exists."
        );

        // CHANGES
        recordCollectedServiceFeeExcludingGas();

        pendingRequests[msg.sender][requestId] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            isTokenTransfer: isTokenTransfer,
            token: token,
            amount: sentAmount,
            amountOutMin: amountOutMin,
            wantedL1GasPrice: wantedL1GasPrice,
            l2execGasFeeDeposit: l2execGasFeeDeposit
        });

        emit BridgeRequested(requestId, pendingRequests[msg.sender][requestId]);

        // INTERACTIONS
        // Receive deposit. Native ether happens automatically. Token transfer needs to be done explicitly and requires approval.
        if (isTokenTransfer) {
            require(token.transferFrom(msg.sender, address(this), sentAmount));
        }
    }

    // Cancel any request belonging to the caller and withdraw the funds.
    function withdraw(uint256 requestId) external nonReentrant {
        // CHECKS
        // This is a copy, not a reference.
        BridgeRequest memory obsoleteRequest = pendingRequests[msg.sender][requestId];
        require(isDefined(obsoleteRequest), "No request to withdraw.");
        assert(obsoleteRequest.source == msg.sender);

        uint256 withdrawTokenAmount = 0;
        // refund the l2 execution gas deposit, as it will not be used anymore.
        uint256 withdrawNativeEtherAmount = obsoleteRequest.l2execGasFeeDeposit;

        if (obsoleteRequest.isTokenTransfer) {
            withdrawTokenAmount += obsoleteRequest.amount;
        } else {
            withdrawNativeEtherAmount += obsoleteRequest.amount;
        }

        // CHANGES
        delete pendingRequests[msg.sender][requestId];

        // INTERACTIONS
        require(payable(msg.sender).send(withdrawNativeEtherAmount));
        if (obsoleteRequest.isTokenTransfer) {
            require(
                obsoleteRequest.token.transfer(
                    msg.sender,
                    withdrawTokenAmount
                )
            );
        }
    }

    // Execute the request for the given requestor address and request id.
    // The execution gas is refunded to the caller (contract owner) and the bridging
    // is executed via the Hop Bridge. The remaining parameters are calculated on-demand
    // using the HOP v1 SDK.
    function executeRequest(
        address requestor,
        uint256 requestId,
        // these fields are calculated just before executing the request to find these parameters via "populateSendTx"
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 destAmountOutMin,
        uint256 destDeadline
    ) external onlyOwner nonReentrant {
        // CHECKS
        BridgeRequest memory toBeBridgedRequest = pendingRequests[requestor][
            requestId
        ];
        require(isDefined(toBeBridgedRequest), "No request to process");
        require(
            toBeBridgedRequest.amount >= bonderFee,
            "Bonder fee cannot exceed amount."
        );
        require(
            toBeBridgedRequest.amount - bonderFee >= amountOutMin,
            "Guarantees destination amount cannot be more than the to-be-bridged-amount after fees."
        );

        uint256 nativeEtherSent = toBeBridgedRequest.isTokenTransfer
            ? 0
            : toBeBridgedRequest.amount;
        address bridgeContract = bridgeContractOf[toBeBridgedRequest.token];

        // CHANGES
        delete pendingRequests[requestor][requestId];

        // INTERACTIONS
        HopL2AmmWrapper(bridgeContract).swapAndSend{value: nativeEtherSent}(
            layer1ChainId,
            toBeBridgedRequest.destination,
            toBeBridgedRequest.amount,
            bonderFee,
            amountOutMin,
            deadline,
            destAmountOutMin, // todo. test against bonderFee?
            destDeadline
        );
        // refund execution gas to caller
        require(
            payable(msg.sender).send(toBeBridgedRequest.l2execGasFeeDeposit)
        );
    }

    // ====================== OWNER MANAGEMENT FUNCTIONS

    // Allow the owner to fund ether for gas fees, if somehow the L2 gas prices rise a lot and user gas deposits aren't enough.
    /* solhint-disable */
    function ownerDeposit() external payable onlyOwner {}
    /* solhint-enable */

    // Collect service fee.
    function ownerWithdraw(uint256 amount) external onlyOwner nonReentrant {
        require(
            collectedServiceFeeExcludingGas >= amount,
            "Cannot withdraw more funds than the collected non gas service fees."
        );
        collectedServiceFeeExcludingGas -= amount;
        require(payable(msg.sender).send(amount));
    }

    // If the L2 network gas prices rise/fall for a longer duration, we can increase/decrease the gas deposit the users have to make.
    function setL2execGasFeeDeposit(uint256 amount) external onlyOwner {
        l2execGasFeeDeposit = amount;
        checkFeeInvariants();
    }

    // Change service fee for future deposits in case dapp hosting costs change etc.
    function setserviceFee(uint256 amount) external onlyOwner {
        serviceFee = amount;
        checkFeeInvariants();
    }

    // If Hop Bridge is extended, we can add new tokens here.
    // We always want to point to the L2_AmmWrapper contract for the given L2 and token.
    function addSupportForNewToken(IERC20 token, address tokenHopBridge)
        external
        onlyOwner
    {
        require(tokenHopBridge != address(0), "Hop bridge contract address must not be 0 address.");
        require(
            bridgeContractOf[token] == address(0),
            "Token already supported."
        );
        bridgeContractOf[token] = tokenHopBridge;
    }

    // ====================== HELPER FUNCTIONS
    // todo. this should create an error with scribble.
    /// #if_succeeds "service fee >= l2gasFeeDeposit" serviceFee > l2execGasFeeDeposit; 
    function checkFeeInvariants() internal view {
        require(
            serviceFee >= l2execGasFeeDeposit,
            "Service fee must cover at least the execution gas requirement."
        );
    }

    function recordCollectedServiceFeeExcludingGas() internal {
        collectedServiceFeeExcludingGas += serviceFee - l2execGasFeeDeposit;
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
