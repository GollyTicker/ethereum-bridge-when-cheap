import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  addressZero,
  fixtureBarebone,
  fixturePreconfigured,
  initialAllowance,
  l2GasfeeDeposit,
  nativeEther,
  serviceFee,
  withReentrancy as testReentrancyAttack
} from "./shared";

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
  // we only test edge cases here, because the workflows already cover the success cases.

  describe("deposit", () => {
    it("invalid preconditions", async () => {
      const {
        bwc,
        accounts: [acc1, acc2],
        token,
        addressZeroSigner
      } = await loadFixture(fixturePreconfigured);

      await expect(
        bwc.deposit(nativeEther, 0, addressZero, 1, 0, { value: 100 })
      ).to.be.revertedWith(/Destination address may not be 0 address/);

      await expect(
        bwc.deposit(nativeEther, 0, acc1.address, 0, 0, { value: 100 })
      ).to.be.revertedWith(/Wanted L1 gas price must be strictly positive/);

      await expect(
        bwc.deposit(nativeEther, 0, acc1.address, 1, 0, {
          value: serviceFee - 1
        })
      ).to.be.revertedWith(/Not enough funds to pay for delayed execution/);

      expect(
        await bwc.deposit(nativeEther, 0, acc1.address, 1, 0, {
          value: serviceFee
        })
      );

      await expect(
        bwc.deposit(token.address, 100, acc1.address, 1, 0, {
          value: serviceFee + 1
        })
      ).to.be.revertedWith(/For token deposits, pay the service fee exactly/);

      await expect(
        bwc.deposit(token.address, 0, acc1.address, 1, 0, { value: 100 })
      ).to.be.revertedWith(
        /Token must be 0 address, when depositing native ether/
      );

      await expect(
        bwc.deposit(nativeEther, 0, acc1.address, 1, 100 - serviceFee + 1, {
          value: 100
        })
      ).to.be.revertedWith(
        /Calculated sent amount must be larger than the desired minimum amount arriving at destination/
      );

      expect(
        await bwc.deposit(nativeEther, 0, acc1.address, 1, 100 - serviceFee, {
          value: 100
        })
      );

      // failed transfer
      await token
        .connect(acc2)
        .decreaseAllowance(bwc.address, initialAllowance);
      await expect(
        bwc.connect(acc2).deposit(token.address, 100, acc2.address, 1, 0, {
          value: serviceFee
        })
      ).to.be.revertedWith(/ERC20: insufficient allowance/);

      // impersonate zero address
      await expect(
        bwc
          .connect(addressZeroSigner)
          .deposit(nativeEther, 0, acc1.address, 10, 0)
      ).to.be.revertedWith(/Sender may not be 0 address/);
    });

    it("reentrancy attack", async () => {
      const {
        bwc,
        accounts: [acc1],
        token
      } = await loadFixture(fixturePreconfigured);

      await testReentrancyAttack(token, "deposit", bwc, () =>
        bwc.connect(acc1).deposit(token.address, 1, acc1.address, 10, 0, {
          value: serviceFee
        })
      );
    });

    it("uninitialized bridge", async () => {
      const {
        bwc,
        accounts: [acc1]
      } = await loadFixture(fixtureBarebone);

      await expect(
        bwc.deposit(nativeEther, 0, acc1.address, 1, 0, { value: 100 })
      ).to.be.revertedWith(
        /Token\/Ether-bridging is not supported\/initialized/
      );
    });
  });

  describe("withdraw", () => {
    it("invalid preconditions", async () => {
      const {
        bwc,
        accounts: [acc1, acc2],
        token,
        adversary
      } = await loadFixture(fixturePreconfigured);
      for (let i = 0; i < 4; i++) {
        expect(
          await bwc
            .connect(acc1)
            .deposit(
              i % 2 == 0 ? nativeEther : token.address,
              i % 2 == 0 ? 0 : 100,
              acc1.address,
              10,
              30,
              { value: i % 2 == 0 ? 200 : serviceFee }
            )
        );
      }

      await expect(bwc.connect(acc2).withdraw(0)).to.be.revertedWith(
        /No request to withdraw/
      );

      for (let i = 0; i < 2; i++) {
        expect(await bwc.connect(acc1).withdraw(i));
      }

      // reentrancy attack
      await testReentrancyAttack(token, "withdraw", bwc, () =>
        bwc.connect(acc1).withdraw(3)
      );

      // failed receive on withdraw.
      await expect(adversary.callDepositAndWithdraw({ value: 100 })).to.be
        .revertedWithoutReason;
    });
  });

  describe("executeRequest", () => {
    it("reentrancy attack", async () => {
      const {
        bwc,
        owner,
        accounts: [acc1],
        fakeL2AmmWrapper,
        adversary
      } = await loadFixture(fixturePreconfigured);

      expect(
        await bwc.deposit(nativeEther, 0, acc1.address, 10, 0, {
          value: 200
        })
      );

      await expect(
        bwc.executeRequest(acc1.address, 0, 0, 0)
      ).to.be.revertedWith(/No request to process/);

      await testReentrancyAttack(fakeL2AmmWrapper, "executeRequest", bwc, () =>
        bwc.executeRequest(owner.address, 0, 0, 0)
      );

      await expect(
        bwc.connect(acc1).executeRequest(owner.address, 0, 0, 0)
      ).to.be.revertedWith(/Ownable: caller is not the owner/);

      await expect(
        bwc.executeRequest(owner.address, 0, 201, 0)
      ).to.be.revertedWith(/Bonder fee cannot exceed amount/);

      // failed receive gas refund
      await bwc.transferOwnership(adversary.address);
      await expect(adversary.callExecuteRequest(owner.address)).to.be
        .revertedWithoutReason;
    });
  });

  describe("owner management", () => {
    it("ownerWithdraw failed receive", async () => {
      const { bwc, owner, adversary } = await loadFixture(fixturePreconfigured);

      await bwc.deposit(nativeEther, 0, owner.address, 1, 0, { value: 100 });
      await bwc.transferOwnership(adversary.address);

      await expect(adversary.callOwnerWithdraw()).to.be.revertedWithoutReason;
    });

    it("non-owner calls", async () => {
      const {
        bwc,
        accounts: [acc1]
      } = await loadFixture(fixturePreconfigured);

      await expect(
        bwc.connect(acc1).ownerDeposit({ value: 10 })
      ).to.be.revertedWith(/Ownable: caller is not the owner/);

      await expect(bwc.connect(acc1).ownerWithdraw(0)).to.be.revertedWith(
        /Ownable: caller is not the owner/
      );

      await expect(
        bwc.connect(acc1).setL2execGasFeeDeposit(0)
      ).to.be.revertedWith(/Ownable: caller is not the owner/);

      await expect(bwc.connect(acc1).setServiceFee(0)).to.be.revertedWith(
        /Ownable: caller is not the owner/
      );
    });

    it("respects the fee invariants", async () => {
      const { bwc } = await loadFixture(fixtureBarebone);

      await expect(bwc.setServiceFee(l2GasfeeDeposit - 1)).to.be.revertedWith(
        /Service fee must cover at least the execution gas requirement/
      );

      await expect(
        bwc.setL2execGasFeeDeposit(serviceFee + 1)
      ).to.be.revertedWith(
        /Service fee must cover at least the execution gas requirement/
      );

      expect(await bwc.setServiceFee(l2GasfeeDeposit));

      expect(await bwc.setServiceFee(serviceFee));

      expect(await bwc.setL2execGasFeeDeposit(serviceFee));
    });
  });
});
