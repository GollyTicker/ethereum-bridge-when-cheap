// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./IBridgeWhenCheap.sol";

// todo. create a contact email
/// @custom:security-contact bridge-when-cheap@gmail.com
contract BridgeWhenCheap is IBridgeWhenCheap, Ownable, ReentrancyGuard {
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
    // We have requestor x nonce => BridgeRequest. Each nonce will be used exactly once and it'll
    // increment starting at 0.
    mapping(address => mapping(uint256 => BridgeRequest))
        public pendingRequests;

    // The next, yet unused, nonce for each requestor.
    mapping(address => uint256) public nextNonceOf;

    // destination layer 1 chain id: mainnet = 1, goerli = 5
    uint256 public layer1ChainId;

    // Supported ERC20 tokens and the Hop Bridge for them.
    // We use a mapping, so that we can extend the implementation with additional tokens lateron.
    // Each mapping points to the Hop Bridge L2AmmWrapper for that token for L2 -> L1.
    // This needs to be manually populated after contract deploment for each to-be-supported token.
    mapping(IERC20 => address) public bridgeContractOf;

    // Native Ether: token = address(0)
    // arbitrum: goerli hop L2 AMM Wrapper: 0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF
    // arbitrum: goerli fake l2 amm warpper: 0x98de918e05d45d53fc6c85b15b4db853ddc6e0f9

    // solhint-disable-next-line
    constructor(
        uint256 _l2execGasFeeDeposit,
        uint256 _serviceFee,
        uint256 _layer1ChainId
    ) {
        l2execGasFeeDeposit = _l2execGasFeeDeposit;
        serviceFee = _serviceFee;
        layer1ChainId = _layer1ChainId;
        checkFeeInvariants();
    }

    /*
    ============== INVARIANTS ==============

    * each deposit() will leave (serviceFee-l2execGasFeeDeposit) in the smart contract which can be withdrawn by the contract owner.
        * the owner cannot withdraw anymore than that.
        * the remaining l2exexGasFeeDeposit will be refunded to the executeRequest caller (also owner) when the execute a request.
        * If the request is withdrawn, the gas fee will be refunded to the original requestor.
    * a deposit() populates a BridgeRequest into the smart contract. They can only be
        (a) withdrawn by the requestor (receiving all funds except (serviceFee-l2execGasFeeDeposit) in ether back) or
        (b) bridged to L1 via the Hop Bridge L2AmmWrapper where at least amountOutMit will be transferred.
    * serviceFee - l2execGasFeeDeposit >= 0
    * When the serviceFee or l2execGasFeeDeposit is changed, previous requests are not influenced and they'll be executed with the fees
      acknowledged at that time.
    */

    // ===================== ESSENTIAL FUNCTIONS

    // Deposit funds which will be bridged to destination via Hop Bridge
    // when the L1 gas fees are at wantedL1GasPrice or lower.
    // The request is recorded in the smart contract and executed lateron by the owner of the contract.
    function deposit(
        // if native ETH payment, then token must be 0 address.
        IERC20 tokenOrEtherAddr,
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
            "Destination address may not be 0 address."
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
                address(tokenOrEtherAddr) == address(0),
                "Token must be 0 address, when depositing native ether."
            );
            sentAmount = msg.value - serviceFee;
        }

        require(
            bridgeContractOf[tokenOrEtherAddr] != address(0),
            "Token/Ether-bridging is not supported/initialized."
        );

        require(
            sentAmount >= amountOutMin,
            "Calculated sent amount must be larger than the desired minimum amount arriving at destination."
        );

        uint256 nonce = nextNonceOf[msg.sender];
        nextNonceOf[msg.sender]++;

        assert(!isDefined(pendingRequests[msg.sender][nonce]));

        // CHANGES
        recordCollectedServiceFeeExcludingGas();

        pendingRequests[msg.sender][nonce] = BridgeRequest({
            source: msg.sender,
            destination: destination,
            isTokenTransfer: isTokenTransfer,
            token: tokenOrEtherAddr,
            amount: sentAmount,
            amountOutMin: amountOutMin,
            wantedL1GasPrice: wantedL1GasPrice,
            l2execGasFeeDeposit: l2execGasFeeDeposit
        });

        emit BridgeRequested(
            msg.sender,
            nonce,
            pendingRequests[msg.sender][nonce]
        );

        // INTERACTIONS
        // Receive deposit. Native ether happens automatically. Token transfer needs to be done explicitly and requires approval.
        if (isTokenTransfer) {
            require(
                tokenOrEtherAddr.transferFrom(
                    msg.sender,
                    address(this),
                    sentAmount
                )
            );
        }
    }

    // Cancel any request belonging to the caller and withdraw the funds.
    function withdraw(uint256 nonce) external nonReentrant {
        // CHECKS
        // This is a copy, not a reference.
        BridgeRequest memory obsoleteRequest = pendingRequests[msg.sender][
            nonce
        ];
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
        delete pendingRequests[msg.sender][nonce];

        // INTERACTIONS
        Address.sendValue(payable(msg.sender), withdrawNativeEtherAmount);
        if (obsoleteRequest.isTokenTransfer) {
            require(
                obsoleteRequest.token.transfer(msg.sender, withdrawTokenAmount)
            );
        }
        emit BridgeRequestWithdrawn(msg.sender, nonce, obsoleteRequest);
    }

    // Execute the request for the given requestor address and request id.
    // The execution gas is refunded to the caller (contract owner) and the bridging
    // is executed via the Hop Bridge. The remaining parameters are calculated on-demand
    // using the HOP v1 SDK.
    function executeRequest(
        address requestor,
        uint256 nonce,
        // bonder fee is calculated via Hop SDK v1 "populateSendTx" just before initiating this tx.
        // We only need the bonder fee and we only have limited
        // room there, as the minimum amoutOut has already been promised to the user.
        uint256 bonderFee,
        uint256 destAmmDeadline
    ) external nonReentrant onlyOwner {
        // CHECKS
        BridgeRequest memory toBeBridgedRequest = pendingRequests[requestor][
            nonce
        ];
        require(isDefined(toBeBridgedRequest), "No request to process");
        require(
            toBeBridgedRequest.amount >= bonderFee,
            "Bonder fee cannot exceed amount."
        );
        require(
            toBeBridgedRequest.amount - bonderFee >=
                toBeBridgedRequest.amountOutMin,
            "Guaranteed destination amount cannot be more than the to-be-bridged-amount after fees."
        );

        uint256 nativeEtherSent = toBeBridgedRequest.isTokenTransfer
            ? 0
            : toBeBridgedRequest.amount;
        address bridgeContract = bridgeContractOf[toBeBridgedRequest.token];

        // CHANGES
        delete pendingRequests[requestor][nonce];

        // INTERACTIONS
        HopL2AmmWrapper(bridgeContract).swapAndSend{value: nativeEtherSent}(
            layer1ChainId,
            toBeBridgedRequest.destination,
            toBeBridgedRequest.amount,
            bonderFee,
            0 /* amountOutMin */,
            0 /* ammDeadline */,
            toBeBridgedRequest.amountOutMin,
            destAmmDeadline
        );
        // refund execution gas to caller
        Address.sendValue(
            payable(msg.sender),
            toBeBridgedRequest.l2execGasFeeDeposit
        );

        emit BridgeExecutionSubmitted(requestor, nonce, toBeBridgedRequest);
    }

    // ====================== OWNER MANAGEMENT FUNCTIONS

    // Allow the owner to fund ether for gas fees, if somehow the L2 gas prices rise a lot and user gas deposits aren't enough.
    /* solhint-disable */
    function ownerDeposit() external payable onlyOwner {}

    /* solhint-enable */

    // Collect service fee.
    function ownerWithdraw(
        uint256 amount
    )
        external
        onlyOwner
    /* no eentrancy check here, because function is resillient to it and becaue this couldn't be tested in coverage. */
    {
        require(
            collectedServiceFeeExcludingGas >= amount,
            "Cannot withdraw more funds than the collected non gas service fees."
        );
        collectedServiceFeeExcludingGas -= amount;
        Address.sendValue(payable(msg.sender), amount);
    }

    // If the L2 network gas prices rise/fall for a longer duration, we can increase/decrease the gas deposit the users have to make.
    function setL2execGasFeeDeposit(uint256 amount) external onlyOwner {
        l2execGasFeeDeposit = amount;
        checkFeeInvariants();
    }

    // Change service fee for future deposits in case dapp hosting costs change etc.
    function setServiceFee(uint256 amount) external onlyOwner {
        serviceFee = amount;
        checkFeeInvariants();
    }

    // If Hop Bridge is extended, we can add new tokens here.
    // We always want to point to the L2_AmmWrapper contract for the given L2 and token.
    function addSupportForNewToken(
        IERC20 token,
        address tokenHopBridge
    ) external onlyOwner {
        require(
            tokenHopBridge != address(0),
            "Hop bridge contract address must not be 0 address."
        );
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
    function isDefined(
        BridgeRequest memory request
    ) internal pure returns (bool) {
        return request.source != address(0);
    }
}
