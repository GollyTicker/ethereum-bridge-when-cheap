// SPDX-License-Identifier: MIT
        
pragma solidity ^0.8.19.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "solidity/contracts/BridgeWhenCheap.sol";

contract SupportNewTokens {
    IERC20 constant nativeEther = IERC20(address(0));
    IERC20 DAI;

    IERC20[2] tokensToTest;

    BridgeWhenCheap bwc;
    
    /// #sender: account-9
    function beforeEach() public {
        DAI = IERC20(msg.sender);
        tokensToTest = [nativeEther, DAI];
        bwc = new BridgeWhenCheap(10, 50, 1);
    }

    function initiallyUnset() public {
        Assert.ok(bwc.bridgeContractOf(nativeEther) == address(0), "");
        Assert.ok(bwc.bridgeContractOf(DAI) == address(0), "");
    }


    /// #sender: account-1
    function supportSuccess() public {
        for (uint i=0; i < tokensToTest.length; i++) {
            IERC20 token = tokensToTest[i];

            bwc.addSupportForNewToken(token, msg.sender);
            Assert.ok(bwc.bridgeContractOf(token) == msg.sender, "");
        }
    }

    /// #sender: account-1
    function supportAlreadySet() public {
        for (uint i=0; i < tokensToTest.length; i++) {
            IERC20 token = tokensToTest[i];

            bwc.addSupportForNewToken(token, msg.sender);
            try bwc.addSupportForNewToken(token, msg.sender) {
                Assert.ok(false, "");
            } catch Error(string memory reason) {
                Assert.ok(keccak256(bytes(reason)) == keccak256(bytes('Token already supported.')), "");
            }
        }
    }

    /// #sender: account-1
    function supportNativeFailTargetZero() public {
        for (uint i=0; i < tokensToTest.length; i++) {
            IERC20 token = tokensToTest[i];
        
            try bwc.addSupportForNewToken(token, address(0)) {
                Assert.ok(false, "");
            } catch Error(string memory reason) {
                Assert.ok(keccak256(bytes(reason)) == keccak256(bytes('Hop bridge contract address must not be 0 address.')), "");
            }
        }
    }
}
