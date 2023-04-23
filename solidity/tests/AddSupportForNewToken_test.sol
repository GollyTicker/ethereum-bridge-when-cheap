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

    BridgeWhenCheap bwc;
    
    /// #sender: account-9
    function beforeEach() public {
        DAI = IERC20(msg.sender);
        bwc = new BridgeWhenCheap(10, 50, 1);
        assert(bwc.bridgeContractOf(nativeEther) == address(0));
        assert(bwc.bridgeContractOf(DAI) == address(0));
    }

    function testme() public {
        assert(true);
    }

    /// #sender: account-1
    function supportNativeSuccess() public {
        bwc.addSupportForNewToken(nativeEther, msg.sender);
        assert(bwc.bridgeContractOf(nativeEther) == msg.sender);
    }

    /// #sender: account-1
    function supportNativeAlreadySet() public {
        bwc.addSupportForNewToken(nativeEther, msg.sender);
        try bwc.addSupportForNewToken(nativeEther, msg.sender) {
            assert(false);
        } catch Error(string memory reason) {
            assert(keccak256(bytes(reason)) == keccak256(bytes('Token already supported.')));
        }
    }

    /// #sender: account-1
    function supportNativeFailTargetZero() public {
        try bwc.addSupportForNewToken(nativeEther, address(0)) {
            assert(false);
        } catch Error(string memory reason) {
            assert(keccak256(bytes(reason)) == keccak256(bytes('Hop bridge contract address must not be 0 address.')));
        }
    }
}