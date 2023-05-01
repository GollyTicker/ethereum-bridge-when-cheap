import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { BridgeExecutionSubmittedEventObject, BridgeRequestWithdrawnEventObject, BridgeRequestedEventObject } from "../typechain-types/contracts/BridgeWhenCheap.sol/BridgeWhenCheap";
import { BridgeRequest, GetEventByName, allRequestsEmpty, fixturePreconfigured, heldFeePerRequest, initialAccountTokenBalance, initialAllowance, isEmpty, l2GasfeeDeposit, nativeEther, serviceFee, toStructOutput, totalPaidGasFeesOfTx } from "./shared";


interface DepositTestCase {
  desc?: string;
  id: BigNumberish;
  amount: BigNumber;
  tokenTransfer: boolean;
  wantedL1GasFee: BigNumberish;
  minOutAmount: BigNumberish;
  followUp: { bonderFee: BigNumberish; } | 'withdraw';
  expectDepositFailure?: RegExp;
  expectExecFailure?: RegExp;
}

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


describe("Deposits", function () {
  it("initially empty", async function () {
    const { bwc, owner, accounts } = await loadFixture(fixturePreconfigured);
    allRequestsEmpty(bwc, [owner].concat(accounts));
  });

  for (const tc of testPermutations()) {

    it("end2end workflow " + (tc.expectDepositFailure && tc.expectExecFailure ? "success" : "failure") + " " + tc.desc, async () => {
      const { bwc, owner, accounts, initialNativeBalance, token, fakeL2AmmWrapper} = await loadFixture(fixturePreconfigured);
      const [sender, receiver] = accounts;


      // ======================== deposit

      const { id, amount, tokenTransfer, minOutAmount, wantedL1GasFee, followUp, expectDepositFailure, expectExecFailure } = tc;

      if (tokenTransfer) {
        expect(await token.balanceOf(sender.address)).to.equal(initialAccountTokenBalance);
      }

      const nativeEtherAmount = tokenTransfer ? serviceFee : amount;
      const tokenAmount = tokenTransfer ? amount : 0;
      const whichTokenAddr = tokenTransfer ? token.address : nativeEther;

      const expectedRequest: BridgeRequest = {
        source: sender.address,
        destination: receiver.address,
        amount: BigNumber.from(amount).sub(tokenTransfer ? 0 : serviceFee),
        amountOutMin: BigNumber.from(minOutAmount),
        token: whichTokenAddr,
        isTokenTransfer: tokenTransfer,
        l2execGasFeeDeposit: BigNumber.from(l2GasfeeDeposit),
        wantedL1GasPrice: BigNumber.from(wantedL1GasFee)
      };

      const depositP = bwc
        .connect(sender)
        .deposit(id, whichTokenAddr, tokenAmount, receiver.address, wantedL1GasFee, minOutAmount, { value: nativeEtherAmount });
      
      if (expectDepositFailure !== undefined) {
        await expect(depositP).to.be.revertedWith(expectDepositFailure);
        return;
      }

      const deposit = await depositP;

      // Check event correctly emitted
      // ideally, we want to use waffles' expect(...).to.emit(...), but that fails for some hard to dicern reason. hence we check manually.
      const actualBridgeRequestedEvent = await GetEventByName<BridgeRequestedEventObject>("BridgeRequested", deposit);
      expect(actualBridgeRequestedEvent.requestId).to.equal(id);
      expect(actualBridgeRequestedEvent.request).to.deep.equal(toStructOutput(expectedRequest));
      // ====================== ^^^^^^ getting this all right was difficult !! ^^^^^ ================================

      expect(await sender.getBalance()).to.equal(
        initialNativeBalance.sub(nativeEtherAmount).sub(await totalPaidGasFeesOfTx(deposit))
      );

      if (tokenTransfer) {
        expect(await token.balanceOf(sender.address)).to.equal(BigNumber.from(initialAccountTokenBalance).sub(tokenAmount));
      }

      expect(await bwc.collectedServiceFeeExcludingGas()).equal(serviceFee - l2GasfeeDeposit);

      const request: BridgeRequest = await bwc.pendingRequests(sender.address, id);

      expect(request.source).equal(expectedRequest.source);
      expect(request.destination).equal(expectedRequest.destination);
      expect(request.amount).equal(expectedRequest.amount);
      expect(request.amountOutMin).equal(expectedRequest.amountOutMin);
      expect(request.isTokenTransfer).equal(expectedRequest.isTokenTransfer);
      expect(request.token).equal(expectedRequest.token);
      expect(request.l2execGasFeeDeposit).equal(expectedRequest.l2execGasFeeDeposit);
      expect(request.wantedL1GasPrice).equal(expectedRequest.wantedL1GasPrice);

      expect(isEmpty(await bwc.pendingRequests(sender.address, BigNumber.from(id).add(1)))).to.be.true;

      allRequestsEmpty(bwc, [owner].concat(...accounts.slice(1)));


      if (followUp === "withdraw") {
        // ======================== withdraw

        const requestorNativeBalance = await sender.getBalance();
        const requestorTokenBalance = await token.balanceOf(sender.address);

        const withdraw = await bwc.connect(sender).withdraw(id);

        // Check event correctly emitted
        const actualBridgeRequestWithdrawnEvent = await GetEventByName<BridgeRequestWithdrawnEventObject>("BridgeRequestWithdrawn", withdraw);
        expect(actualBridgeRequestWithdrawnEvent.requestId).to.equal(id);
        expect(actualBridgeRequestWithdrawnEvent.request).to.deep.equal(toStructOutput(expectedRequest));

        const expectedNativeEtherBalance = requestorNativeBalance
          .add(tokenTransfer ? 0 : request.amount)
          .add(l2GasfeeDeposit)
          .sub(await totalPaidGasFeesOfTx(withdraw));
        const expectedTokenBalance = requestorTokenBalance.add(tokenTransfer ? request.amount : 0);

        expect(await sender.getBalance()).to.equal(expectedNativeEtherBalance);
        expect(await token.balanceOf(sender.address)).to.equal(expectedTokenBalance);

        expect(isEmpty(await bwc.pendingRequests(sender.address, id))).to.be.true;
      }
      else {
        // ======================== execute request

        const ownerBalanceBeforeExec = await owner.getBalance();
        const nativeEtherSent = tokenTransfer ? BigNumber.from(0) : request.amount;

        const requestorNativeBalance = await sender.getBalance();
        const requestorTokenBalance = await token.balanceOf(sender.address);

        const execP = bwc.executeRequest(sender.address, id, followUp.bonderFee, 0);

        if (expectExecFailure !== undefined) {
          await expect(execP).to.be.revertedWith(expectExecFailure);
          return;
        }

        await expect(execP).to.changeEtherBalances(
            [bwc, fakeL2AmmWrapper, owner],
            [nativeEtherSent.add(l2GasfeeDeposit).mul(-1),nativeEtherSent, l2GasfeeDeposit]
          );
        // fakeL2AmmWrapper doesn't retrieve the tokens it would take in the real world.

        const exec = await execP;
        
        // todo. DECODE EVENT DATA AND CHECK IT's CORRECT.
        // const swapAndSendEvent = await GetEventByName<SwapAndSendEventObject>("SwapAndSend", exec, fakeL2AmmWrapper.address);
        // const abi = new ethers.utils.AbiCoder();
        // console.log("abi encoded", abi.encode(["swapAndSend(uint256)"],[BigNumber.from(0)]));
        // (new ethers.utils.AbiCoder()).decode(["uint256","address","uint256","uint256","uint256","uint256","uint256","uint256"],"0x000000000000000000000000a513e6e4b8f2a923d98304ec87f64353c4d5c8530000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc000000000000000000000000000000000000000000000000000000000000000900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000000")

        // expect(swapAndSendEvent.sender).to.equal(owner.address);
        // expect(swapAndSendEvent.paidAmount).to.equal(nativeEtherSent);
        // expect(swapAndSendEvent.chainId).to.equal(chainId);
        // expect(swapAndSendEvent.recipient).to.equal(receiver.address);
        // expect(swapAndSendEvent.amount).to.equal(request.amount);
        // expect(swapAndSendEvent.bonderFee).to.equal(followUp.bonderFee);
        // expect(swapAndSendEvent.amountOutMin).to.equal(0);
        // expect(swapAndSendEvent.deadline).to.equal(0);
        // expect(swapAndSendEvent.destAmountOutMin).to.equal(minOutAmount);
        // expect(swapAndSendEvent.destDeadline).to.equal(0);

        const actualBridgeExecutionSubmittedEvent = await GetEventByName<BridgeExecutionSubmittedEventObject>("BridgeExecutionSubmitted", exec);
        expect(actualBridgeExecutionSubmittedEvent.requestId).to.equal(id);
        expect(actualBridgeExecutionSubmittedEvent.request).to.deep.equal(toStructOutput(expectedRequest));

        expect(isEmpty(await bwc.pendingRequests(sender.address, id))).to.be.true;

        expect(await owner.getBalance()).to.equal(ownerBalanceBeforeExec.add(l2GasfeeDeposit).sub(await totalPaidGasFeesOfTx(exec)));

        // requestor balances don't change.
        expect(await sender.getBalance()).equal(requestorNativeBalance);
        expect(await token.balanceOf(sender.address)).equal(requestorTokenBalance);

        // =========== owner withdraws fees
        expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(heldFeePerRequest);
        await expect(bwc.ownerWithdraw(heldFeePerRequest+1)).to.be.revertedWith(/Cannot withdraw more funds than the collected non gas service fees/);
        expect(await bwc.ownerWithdraw(heldFeePerRequest));
      }
    });
  }
});



function testPermutations(): DepositTestCase[] {
  const ids: BigNumberish[] = [0, 1, parseUnits("10000", "ether")];
  const amounts: BigNumber[] = [0, serviceFee - 1, serviceFee, 300, initialAccountTokenBalance, initialAccountTokenBalance+1, parseUnits("9999", "ether")].map(BigNumber.from);
  const tokenTransfers = [true, false];
  const wantedL1GasFees = [1, parseUnits("1", "ether")];

  const tcs: DepositTestCase[] = [];

  for (const id of ids) {
    for (const amount of amounts) {
      for (const tokenTransfer of tokenTransfers) {
        let expectDepositFailure = undefined;
        // amount == 0 implies that it's a nativeEther transfer. so token transfer is excluded then.
        if (amount.eq(0) && tokenTransfer) continue; // zero amount will be misinterpreted and isn't relevant

        const bonderFees = [0, amount.div(10), amount.div(2), amount];
        for (const bonderFee of bonderFees) {

          let minOutAmount: BigNumberish;
          if (tokenTransfer) {
            if (amount.gt(initialAllowance)) expectDepositFailure = expectDepositFailure ?? /ERC20: insufficient allowance/;
            if (amount.gt(initialAccountTokenBalance)) expectDepositFailure = expectDepositFailure ?? /ERC20: transfer amount exceeds balance/;
            minOutAmount = amount.sub(bonderFee);
          }
          else {
            if (amount.lt(serviceFee)) expectDepositFailure = expectDepositFailure ?? /Not enough funds to pay for delayed execution/;
            minOutAmount = BigNumber.from(amount).sub(serviceFee).sub(bonderFee);
          }
          if (minOutAmount.lt(0)) continue; // tx cannot be sent

          let expectExecFailure = undefined;
          if (amount.sub(bonderFee).lt(minOutAmount)) expectExecFailure = /Bonder fee cannot exceed amount/;
          if (BigNumber.from(bonderFee).gt(amount)) expectExecFailure = /Guaranteed destination amount cannot be more than the to-be-bridged-amount after fees/;

          for (const wantedL1GasFee of wantedL1GasFees) {
            for (const execRequest of [true, false]) {
              tcs.push({
                desc: "depGood" + expectDepositFailure + " execGood" + expectExecFailure + " a" + amount.toString() + " i" + id.toString() + " tt"+tokenTransfer + " wl1" + wantedL1GasFee.toString() + (execRequest ? " bf"+bonderFee.toString() : " wd"),
                amount, id, minOutAmount, tokenTransfer, wantedL1GasFee, expectDepositFailure, expectExecFailure,
                followUp: execRequest ? { bonderFee } : "withdraw"
              })
            }
          }
        }
      }
    }
  }

  return tcs;
}