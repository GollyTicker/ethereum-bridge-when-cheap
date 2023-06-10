import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  fixtureBarebone,
  heldFeePerRequest,
  initialAllowance,
  isEmpty,
  l2GasfeeDeposit,
  nativeEther,
  serviceFee
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

describe("Diverse Workflows", async () => {
  it("supports an example workflow of user txs and owner mgmt txs", async () => {
    const {
      bwc,
      accounts: [acc1, acc2],
      fakeL2AmmWrapper,
      owner,
      token
    } = await loadFixture(fixtureBarebone);

    // user txs fail before tokens are supported
    await expect(
      bwc
        .connect(acc1)
        .deposit(nativeEther, 0, acc2.address, 10, 0, { value: 100 })
    ).to.be.reverted;
    await expect(bwc.connect(acc1).withdraw(0)).to.be.reverted;

    // owner adds tokens
    await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
    await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);

    // owner cant withdraw anything.
    expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(0);
    await expect(bwc.ownerWithdraw(1)).to.be.revertedWith(
      /Cannot withdraw more funds than the collected non gas service fees/
    );

    // users cannot transact before approval.
    await expect(
      bwc.connect(acc1).deposit(token.address, 100, acc2.address, 10, 0, {
        value: serviceFee
      })
    ).to.be.revertedWith(/ERC20.*allowance/);

    // but ether can already be deposited
    // nonce 0
    await expect(
      bwc
        .connect(acc1)
        .deposit(nativeEther, 0, acc2.address, 10, 400, { value: 500 })
    ).to.changeEtherBalances([acc1, bwc], [-500, 500]);

    // nonce 0
    await expect(
      bwc
        .connect(acc2)
        .deposit(nativeEther, 0, acc2.address, 10, 900, { value: 1000 })
    ).to.changeEtherBalances([acc2, bwc], [-1000, 1000]);

    // and withdrawn
    await expect(bwc.connect(acc2).withdraw(1)).to.be.reverted;
    await expect(bwc.connect(acc2).withdraw(0)).to.changeEtherBalances(
      [acc2, bwc],
      [1000 - heldFeePerRequest, -(1000 - heldFeePerRequest)]
    );

    // and let's approve the tokens now
    token.connect(acc1).approve(bwc.address, initialAllowance);
    token.connect(acc2).approve(bwc.address, initialAllowance);

    // now all kinds of deposits can be made.
    // nonce 1
    await expect(
      bwc
        .connect(acc1)
        .deposit(nativeEther, 0, acc2.address, 30, 0, { value: 5000 })
    ).to.changeEtherBalances([acc1, bwc], [-5000, 5000]);

    // nonce 1
    await expect(
      bwc.connect(acc2).deposit(token.address, 200, acc1.address, 40, 190, {
        value: serviceFee
      })
    )
      .to.changeEtherBalances([acc2, bwc], [-serviceFee, serviceFee])
      .to.changeTokenBalances(token, [acc2, bwc], [-200, 200]);

    // nonce 1
    await expect(
      bwc.connect(acc2).deposit(token.address, 300, acc1.address, 40, 0, {
        value: serviceFee
      })
    )
      .to.changeEtherBalances([acc2, bwc], [-serviceFee, serviceFee])
      .to.changeTokenBalances(token, [acc2, bwc], [-300, 300]);

    // and token withdrawals
    await expect(bwc.connect(acc1).withdraw(2)).to.be.revertedWith(
      /No request/
    );
    expect(await bwc.connect(acc2).withdraw(1));
    expect(isEmpty(await bwc.pendingRequests(acc2.address, 1))).to.be.true;

    // and finally executions
    await expect(
      bwc.executeRequest(acc1.address, 0, 50, 0)
    ).to.changeEtherBalances(
      [bwc, owner, fakeL2AmmWrapper],
      [-(500 - heldFeePerRequest), l2GasfeeDeposit, 500 - serviceFee]
    );
    await expect(
      bwc.executeRequest(acc2.address, 2, 10, 0)
    ).to.changeEtherBalances(
      [bwc, owner, fakeL2AmmWrapper],
      [-l2GasfeeDeposit, l2GasfeeDeposit, 0]
    );
    // token balances don't change here, because the token transfer is done by the fakeL2AmmWrapper.

    // owner withdraws all service fee except l2gasfees.
    expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(
      heldFeePerRequest * 5
    );

    await expect(
      bwc.ownerWithdraw(heldFeePerRequest * 5)
    ).to.changeEtherBalances(
      [bwc, owner],
      [-heldFeePerRequest * 5, heldFeePerRequest * 5]
    );

    expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(0);
    await expect(bwc.ownerWithdraw(1)).to.be.revertedWith(
      /Cannot withdraw more funds than the collected non gas service fees/
    );

    const newL2ExecGasFeeDeposit = l2GasfeeDeposit * 3;
    const newServiceFee = serviceFee * 2;
    const newHeldFeePerRequest = newServiceFee - newL2ExecGasFeeDeposit;
    await expect(bwc.setL2execGasFeeDeposit(serviceFee + 1)).to.be.revertedWith(
      /Service fee must cover at least the execution gas requirement/
    );

    expect(await bwc.setL2execGasFeeDeposit(newL2ExecGasFeeDeposit));
    expect(await bwc.setServiceFee(newServiceFee));

    expect(await bwc.serviceFee()).to.equal(newServiceFee);
    expect(await bwc.l2execGasFeeDeposit()).to.equal(newL2ExecGasFeeDeposit);

    // make new deposits
    // nonce 3
    await expect(
      bwc.connect(acc2).deposit(token.address, 400, acc1.address, 20, 0, {
        value: newServiceFee
      })
    )
      .to.changeEtherBalances([acc2, bwc], [-newServiceFee, newServiceFee])
      .to.changeTokenBalances(token, [acc2, bwc], [-400, 400]);

    // execute requests. The fees are equal to whatever they were during time of deposit.
    await expect(
      bwc.executeRequest(acc1.address, 1, 30, 0)
    ).to.changeEtherBalances(
      [bwc, fakeL2AmmWrapper, owner],
      [
        -(5000 - serviceFee) - l2GasfeeDeposit,
        5000 - serviceFee,
        l2GasfeeDeposit
      ]
    );
    await expect(
      bwc.executeRequest(acc2.address, 3, 20, 0)
    ).to.changeEtherBalances(
      [bwc, fakeL2AmmWrapper, owner],
      [-newL2ExecGasFeeDeposit, 0, newL2ExecGasFeeDeposit]
    );

    // sometimes the owners want's to increase the depoit
    await expect(bwc.ownerDeposit({ value: 5 })).to.changeEtherBalances(
      [owner, bwc],
      [-5, 5]
    );

    // more deposits, withdrawals and executions
    // nonce 2
    expect(
      await bwc
        .connect(acc1)
        .deposit(token.address, 150, acc1.address, 30, 140, {
          value: newServiceFee
        })
    );
    // nonce 4
    expect(
      await bwc
        .connect(acc2)
        .deposit(token.address, 150, acc1.address, 30, 140, {
          value: newServiceFee
        })
    );
    // nonce 5
    expect(
      await bwc
        .connect(acc2)
        .deposit(nativeEther, 0, acc1.address, 30, 140, { value: 200 })
    );

    await expect(bwc.connect(acc1).withdraw(2))
      .to.changeEtherBalances(
        [bwc, acc1],
        [-newL2ExecGasFeeDeposit, newL2ExecGasFeeDeposit]
      )
      .to.changeTokenBalances(token, [bwc, acc1], [-150, 150]);

    await expect(bwc.executeRequest(acc2.address, 4, 11, 0)).to.be.revertedWith(
      /Guaranteed destination amount cannot be more than the to-be-bridged-amount after fees/
    );
    await expect(bwc.executeRequest(acc2.address, 5, 41, 0)).to.be.revertedWith(
      /Guaranteed destination amount cannot be more than the to-be-bridged-amount after fees/
    );

    expect(await bwc.executeRequest(acc2.address, 4, 10, 0));
    expect(await bwc.executeRequest(acc2.address, 5, 40, 0));

    // owner withdraws their service fee.
    expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(
      newHeldFeePerRequest * 4
    );
    await expect(
      bwc.ownerWithdraw(newHeldFeePerRequest * 4)
    ).to.changeEtherBalances(
      [bwc, owner],
      [-newHeldFeePerRequest * 4, newHeldFeePerRequest * 4]
    );
  });
});
