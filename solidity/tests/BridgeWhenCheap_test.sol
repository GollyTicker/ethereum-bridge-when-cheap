// SPDX-License-Identifier: MIT
        
pragma solidity ^0.8.19.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/BridgeWhenCheap.sol";

contract DepositSuccess is BridgeWhenCheap(1, 10, 123) {

    IERC20 nativeEther = IERC20(address(0));
    IERC20 DAI = IERC20(TestsAccounts.getAccount(9));

    address acc0;
    address acc1;
    address acc2;
    address acc3;

    function beforeAll() public {
        acc0 = TestsAccounts.getAccount(0);
        acc1 = TestsAccounts.getAccount(1);
        acc2 = TestsAccounts.getAccount(2);
        acc3 = TestsAccounts.getAccount(3);
    }

    function depositsEmptyInitially() public {
        Assert.ok(address(this).balance == 0, "");
        for (uint i = 0; i < 3; i++) {
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(this, acc1, i)) , "");
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(this, acc2, i)) , "");
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(this, acc3, i)) , "");
        }
    }
    
    /// #sender: account-1
    /// #value: 300
    function depositSuccessNativeSane() public payable {
        Assert.equal(msg.sender, acc1, "");
        // we cannot have the tx sent from acc1 here.... solidity is quite limited
        this.deposit{ value: msg.value }(0, nativeEther, 0, acc2, 10, 200);
        
        // service fee collected
        Assert.equal(collectedServiceFeeExcludingGas, serviceFee - l2execGasFeeDeposit, "8");

        BridgeRequest memory request = pendingRequests[address(this)][0];

        Assert.equal(address(request.token), address(nativeEther), "7");
        Assert.equal(request.isTokenTransfer, false, "6");
        Assert.equal(request.wantedL1GasPrice, 10, "5");
        Assert.equal(request.amount, 300 - serviceFee, "4");
        Assert.equal(request.amountOutMin, 200, "3");
        Assert.equal(request.wantedL1GasPrice, 10, "2");
        Assert.equal(request.l2execGasFeeDeposit, l2execGasFeeDeposit, "1");
        /*
        Assert.equal(request.source, acc1, "");
        Assert.ok(request.destination == acc2, "");
        */
    }
}

contract Deposit {
    IERC20 nativeEther = IERC20(address(0));
    IERC20 DAI = IERC20(TestsAccounts.getAccount(9));

    BridgeWhenCheap bwc;
    uint256 serviceFee;
    uint256 l2execGasFeeDeposit;

    address acc0 = TestsAccounts.getAccount(0);
    address acc1 = TestsAccounts.getAccount(1);
    address acc2 = TestsAccounts.getAccount(2);
    address acc3 = TestsAccounts.getAccount(3);

    function beforeEach() public {
        serviceFee = 50;
        l2execGasFeeDeposit = 10;
        bwc = new BridgeWhenCheap(l2execGasFeeDeposit, serviceFee, 123);
        bwc.addSupportForNewToken(nativeEther, TestsAccounts.getAccount(7));
        bwc.addSupportForNewToken(DAI, TestsAccounts.getAccount(8));
    }

    function depositsEmptyInitially() public {
        Assert.ok(address(bwc).balance == 0, "");
        for (uint i = 0; i < 3; i++) {
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(bwc, acc1, i)) , "");
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(bwc, acc2, i)) , "");
            Assert.ok( Utils.isEmpty(Utils.getPendingRequest(bwc, acc3, i)) , "");
        }
    }

    /*
    function checkSuccess() public {
        // Use 'Assert' methods: https://remix-ide.readthedocs.io/en/latest/assert_library.html
        Assert.ok(2 == 2, 'should be true');
        Assert.greaterThan(uint(2), uint(1), "2 should be greater than to 1");
        Assert.lesserThan(uint(2), uint(3), "2 should be lesser than to 3");
    }

    function checkSuccess2() public pure returns (bool) {
        // Use the return value (true or false) to test the contract
        return true;
    }
    
    function checkFailure() public {
        Assert.notEqual(uint(1), uint(2), "1 should not be equal to 1");
    }

    /// Custom Transaction Context: https://remix-ide.readthedocs.io/en/latest/unittesting.html#customization
    /// #sender: account-1
    /// #value: 100
    function checkSenderAndValue() public payable {
        // account index varies 0-9, value is in wei
        Assert.equal(msg.sender, TestsAccounts.getAccount(1), "Invalid sender");
        Assert.equal(msg.value, 100, "Invalid value");
    }
    */
}


library Utils {
    function isEmpty(BridgeRequest memory request) public returns (bool) {
        return request.source == address(0) && request.destination == address(0) && request.amount == 0;
    }

    function getPendingRequest(BridgeWhenCheap bwc, address addr, uint256 id) public returns (BridgeRequest memory) {
        BridgeRequest memory request;
        (
            request.source,
            request.destination,
            request.isTokenTransfer,
            request.token,
            request.amount,
            request.amountOutMin,
            request.wantedL1GasPrice,
            request.l2execGasFeeDeposit
        ) = bwc.pendingRequests(addr, id);
        return request;
    }
}