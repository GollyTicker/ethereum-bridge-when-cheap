import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { addressZero, fixtureBarebone, fixturePreconfigured, initialAllowance, nativeEther, serviceFee } from "./shared";
import { ethers, network } from "hardhat";
import { parseUnits } from "ethers/lib/utils";


/*
!! HOW TO WRITE ASSERTIONS HERE !!

test that a `value: Promise<T>` equals expected:
  expect(await value).to.equal(expected);

test that a `tx: Promise<T>` reverts with some error:
  await expect(tx)
    .to.be.revertedWith(<reg-exp or string>);

test that a `tx: Promise<T>` satisfies some property:
  await expect(tx)
    .to.be.<verify-property>;

Ensure that two things happen:
  * EVERY `EXPECT` ASSERTIONS HAS TO HAVE AT LEAST ONE `AWAIT` (unless purely synchronous functions)
  * `EXPECT` CAN ONLY PROCESS VALUES or PROMISES, BUT NOT FUNCTIONS ()) => { ... promise ... }!

*/


describe("Function Unit", function () {


  describe("deposit", () => {
    
    // we only test edge cases here, because the workflows already cover the success cases.

    it("invalid preconditions", async () => {
      const { bwc, accounts: [acc1, acc2], token, addressZeroSigner } = await loadFixture(fixturePreconfigured);

      await expect(bwc.deposit(0,nativeEther,0,addressZero,1,0,{value: 100}))
        .to.be.revertedWith(/Destination address may not be 0 address/);

      await expect(bwc.deposit(0,nativeEther,0,acc1.address,0,0,{value: 100}))
        .to.be.revertedWith(/Wanted L1 gas price must be strictly positive/);

      await expect(bwc.deposit(0,nativeEther,0,acc1.address,1,0,{value: serviceFee-1}))
        .to.be.revertedWith(/Not enough funds to pay for delayed execution/);

      expect(await bwc.deposit(1,nativeEther,0,acc1.address,1,0,{value: serviceFee}));

      await expect(bwc.deposit(0,token.address,100,acc1.address,1,0,{value: serviceFee+1}))
        .to.be.revertedWith(/For token deposits, pay the service fee exactly/);

      await expect(bwc.deposit(0,token.address,0,acc1.address,1,0,{value: 100}))
        .to.be.revertedWith(/Token must be 0 address, when depositing native ether/);

      await expect(bwc.deposit(0,nativeEther,0,acc1.address,1,100-serviceFee+1,{value: 100}))
        .to.be.revertedWith(/Calculated sent amount must be larger than the desired minimum amount arriving at destination/);

      expect(await bwc.deposit(2,nativeEther,0,acc1.address,1,100-serviceFee,{value: 100}));

      await expect(bwc.deposit(2,nativeEther,0,acc1.address,1,100-serviceFee,{value: 100}))
        .to.be.revertedWith(/Request with the same id for the requestor already exists/);

      await token.connect(acc2).decreaseAllowance(bwc.address,initialAllowance);

      // failed transfer
      await expect(bwc.connect(acc2).deposit(0,token.address,100,acc2.address,1,0,{value: serviceFee}))
        .to.be.revertedWith(/ERC20: insufficient allowance/);

      // impersonate zero address
      await expect(bwc.connect(addressZeroSigner).deposit(0,nativeEther,0,acc1.address,10,0)).to.be.revertedWith(/Sender may not be 0 address/);
    });

    it("uninitialized bridge", async () => {
      const { bwc, accounts: [acc1]} = await loadFixture(fixtureBarebone);

      await expect(bwc.deposit(0,nativeEther,0,acc1.address,1,0, {value: 100}))
        .to.be.revertedWith(/Token\/Ether-bridging is not supported\/initialized/);
    });

  });


  describe("withdraw", () => {
    
    // we only test edge cases here, because the workflows already cover the success cases.

    it("invalid preconditions", async () => {
      const { bwc, accounts: [acc1, acc2], token } = await loadFixture(fixturePreconfigured);
      for (let i=0;i < 4; i++) {
        expect(await bwc.connect(acc1).deposit(
          i,
          i % 2 == 0 ? nativeEther : token.address,
          i % 2 == 0 ? 0 : 100,
          acc1.address,
          10,
          30,
          {value: i % 2 == 0 ? 200 : serviceFee})
        );
      }

      await expect(bwc.connect(acc2).withdraw(0)).to.be.revertedWith(/No request to withdraw/);
      
      for (let i=0;i < 4; i++) {
        expect(await bwc.connect(acc1).withdraw(i));
      }
    });
  });

  // todo. add tests for each function testing all edge-cases.
  // executeRequest, ownerDeposit (non-owner), ownerWithdraw (non-owner)
  // setL2execGasFeeDeposit (non-owner)
  // setserviceFee (non-owner)
  // setL2execGasFeeDeposit (non-owner)
});
