// SPDX-License-Identifier: MIT
        
pragma solidity ^0.8.19.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "solidity/contracts/BridgeWhenCheap.sol";

// can have more than oe test contract
contract Constructor {

    function constructorSuccessSane() public {
        BridgeWhenCheap bwc = new BridgeWhenCheap(100, 1000, 1);
        Assert.equal(bwc.l2execGasFeeDeposit(), uint256(100), "");
        Assert.equal(bwc.serviceFee(), uint256(1000), "");
        Assert.equal(bwc.layer1ChainId(), uint256(1), "");
    }

    function constructorSuccessFeesEqual() public {
        BridgeWhenCheap bwc = new BridgeWhenCheap(10, 10, 1);
        Assert.equal(bwc.l2execGasFeeDeposit(), uint256(10), "");
        Assert.equal(bwc.serviceFee(), uint256(10), "");
        Assert.equal(bwc.layer1ChainId(), uint256(1), "");
    }

    function constructorSuccessFeesSmall() public {
        BridgeWhenCheap bwc = new BridgeWhenCheap(1, 2, 1);
        Assert.equal(bwc.l2execGasFeeDeposit(), uint256(1), "");
        Assert.equal(bwc.serviceFee(), uint256(2), "");
        Assert.equal(bwc.layer1ChainId(), uint256(1), "");
    }

    function constructorSuccessFeesZeroAllowed() public {
        BridgeWhenCheap bwc = new BridgeWhenCheap(0, 0, 1);
        Assert.equal(bwc.l2execGasFeeDeposit(), uint256(0), "");
        Assert.equal(bwc.serviceFee(), uint256(0), "");
        Assert.equal(bwc.layer1ChainId(), uint256(1), "");
    }

    function constructorInvalidFees() public {
        try new BridgeWhenCheap(1, 0, 1) {
            assert(false);
        } catch {
            Assert.ok(true, "");
        }
    }
}
