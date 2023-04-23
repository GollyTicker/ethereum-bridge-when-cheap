// SPDX-License-Identifier: MIT
        
pragma solidity ^0.8.19.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "solidity/contracts/BridgeWhenCheap.sol";

contract Deposit {
    IERC20 constant nativeEther = IERC20(address(0));

    /// #sender: account-1
    /// #value: 400
    function depositSuccessNativeSane() public {
        new BridgeWhenCheap(10, 50, 1);
        // assert(bwc.bridgeContractOf(nativeEther) == msg.sender);
        //bwc.deposit(0, token, tokenAmount, destination, wantedL1GasPrice, amountOutMin);
    }

    /*
    /// 'beforeAll' runs before all other tests
    /// More special functions are: 'beforeEach', 'beforeAll', 'afterEach' & 'afterAll'
    function beforeAll() public {
        // <instantiate contract>
        Assert.equal(uint(1), uint(1), "1 should be equal to 1");
    }

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
    