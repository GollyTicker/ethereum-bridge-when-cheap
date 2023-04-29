import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish, ContractTransaction, constants } from "ethers";
import { ethers } from "hardhat";
import { BridgeWhenCheap } from "../typechain-types";
import { BridgeRequestStructOutput, BridgeRequestedEventObject, BridgeRequestWithdrawnEventObject, BridgeExecutionSubmittedEventObject } from "../typechain-types/contracts/BridgeWhenCheap.sol/BridgeWhenCheap";
import { SwapAndSendEventObject } from "../typechain-types/contracts/test/Fake_L2_AmmWrapper";
import { parseUnits } from "ethers/lib/utils";

const addressZero = constants.AddressZero;

interface BridgeRequest {
  source: string;
  destination: string;
  isTokenTransfer: boolean;
  token: string;
  amount: BigNumber;
  amountOutMin: BigNumber;
  wantedL1GasPrice: BigNumber;
  l2execGasFeeDeposit: BigNumber;
};

// transform simple object types to the output type from hardhat JS framework.
function toStructOutput(simpleObject: BridgeRequest): BridgeRequestStructOutput {
  const keys = ["source", "destination", "isTokenTransfer", "token", "amount", "amountOutMin", "wantedL1GasPrice", "l2execGasFeeDeposit" ];
  const array: any = keys.map(k => (simpleObject as any)[k]);
  return Object.assign(array, simpleObject);
}

const nativeEther = addressZero;

function isEmpty(request: BridgeRequest): boolean {
  return request.source === addressZero &&
    request.destination === addressZero &&
    request.amount.eq(0) &&
    request.wantedL1GasPrice.eq(0)
}

async function allRequestsEmpty(bwc: BridgeWhenCheap, accounts: { address: string }[]) {
  for (const acc of accounts) {
    for (let i = 0; i < 3; i++) {
      const request: BridgeRequest = await bwc.pendingRequests(acc.address, i);
      expect(isEmpty(request)).to.be.true
    }
  }
}

async function totalPaidGasFeesOfTx(tx: ContractTransaction): Promise<BigNumber> {
  const receipt = ethers.provider.getTransactionReceipt(tx.hash);
  return (await receipt).gasUsed.mul((await receipt).effectiveGasPrice);
}

const l2GasfeeDeposit = 3;
const serviceFee = 10;
const heldFeePerRequest = serviceFee - l2GasfeeDeposit;
const nAccountsIncludingOwner = 4;
const initialAccountTokenBalance = 1000;
const initialAllowance = 3000;


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

async function GetEventByName<T>(name: string, tx: ContractTransaction): Promise<T> {
  return (await tx.wait()).events?.filter((x) => x.event === name)[0].args as T;
}


describe("BridgeWhenCheap", function () {

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

  async function fixture(addTokensSupport: boolean, addTokenApprovals: boolean) {
    const accountsAndOwner = await ethers.getSigners();
    const accounts = accountsAndOwner.slice(1, nAccountsIncludingOwner) // i = 1,2,3 = 3 test accounts
    
    const fakeL2AmmWrapper = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();
    const bwc = await (await ethers.getContractFactory("BridgeWhenCheap")).deploy(l2GasfeeDeposit, serviceFee, 123);
    const token = await (await ethers.getContractFactory("TestToken")).deploy();

    if (addTokensSupport) {
      await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
      await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);
    }

    for (const acc of accounts) {
      await token.connect(acc).mint(initialAccountTokenBalance);
      addTokenApprovals && await token.connect(acc).approve(bwc.address, initialAllowance);
    }

    const initialNativeBalance = await accounts[0].getBalance();

    return { bwc: bwc, owner: accountsAndOwner[0], accounts, initialNativeBalance, token, fakeL2AmmWrapper };
  }

  const fixtureBarebone = () => fixture(false, false)
  const fixtureWithTokenSupportAndApprovals = () => fixture(true, true)

  describe("Deposits", function () {
    it("initially empty", async function () {
      const { bwc, owner, accounts } = await loadFixture(fixtureWithTokenSupportAndApprovals);
      allRequestsEmpty(bwc, [owner].concat(accounts));
    });

    for (const tc of testPermutations()) {

      it("end2end workflow " + (tc.expectDepositFailure && tc.expectExecFailure ? "success" : "failure") + " " + tc.desc, async () => {
        const { bwc, owner, accounts, initialNativeBalance, token, fakeL2AmmWrapper} = await loadFixture(fixtureWithTokenSupportAndApprovals);
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
          const nativeEtherSent = tokenTransfer ? 0 : request.amount;

          const requestorNativeBalance = await sender.getBalance();
          const requestorTokenBalance = await token.balanceOf(sender.address);

          const execP = bwc.executeRequest(sender.address, id, followUp.bonderFee, 0, 0, minOutAmount, 0);

          if (expectExecFailure !== undefined) {
            await expect(execP).to.be.revertedWith(expectExecFailure);
            return;
          }
          const exec = await execP;
          
          // Check events correctly emitted
          await expect(exec)
            .to.emit(fakeL2AmmWrapper, "SwapAndSend")
            .withArgs(owner.address,nativeEtherSent,0,receiver.address,request.amount,followUp.bonderFee,0,0,request.amountOutMin,0);

          const actualBridgeExecutionSubmittedEvent = await GetEventByName<BridgeExecutionSubmittedEventObject>("BridgeExecutionSubmitted", exec);
          expect(actualBridgeExecutionSubmittedEvent.requestId).to.equal(id);
          expect(actualBridgeExecutionSubmittedEvent.request).to.deep.equal(toStructOutput(expectedRequest));

          expect(isEmpty(await bwc.pendingRequests(sender.address, id))).to.be.true;

          expect(await owner.getBalance()).to.equal(ownerBalanceBeforeExec.add(l2GasfeeDeposit).sub(await totalPaidGasFeesOfTx(exec)));

          // requestor balances don't change.
          expect(await sender.getBalance()).equal(requestorNativeBalance);
          expect(await token.balanceOf(sender.address)).equal(requestorTokenBalance);

        }
      });
    }

    // todo. product arguments test. test, that all combinations of valid and invalid arguments don't break the system.

    // todo. how do we test for werid interactions and specific edge hard-to-imagine cases?

  });

  describe("Diverse Workflows", async () => {
    it("supports an example workflow of user txs and owner mgmt txs", async () => {
      const { bwc, accounts: [acc1, acc2], fakeL2AmmWrapper, initialNativeBalance, owner, token } = await loadFixture(fixtureBarebone);

      // user txs fail before tokens are supported
      await expect( bwc.connect(acc1).deposit(0, nativeEther, 0, acc2.address, 10, 0, {value: 100}) ).to.be.reverted;
      await expect( bwc.connect(acc1).withdraw(0) ).to.be.reverted;

      // owner adds tokens
      await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
      await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);

      // owner cant withdraw anything.
      expect(await bwc.collectedServiceFeeExcludingGas()).to.equal(0);
      await expect(bwc.ownerWithdraw(1)).to.be.revertedWith(/Cannot withdraw more funds than the collected non gas service fees/);

      // users cannot transact before approval.
      await expect(bwc.connect(acc1).deposit(0, token.address, 100, acc2.address, 10, 0, {value: serviceFee}) ).to.be.revertedWith(/ERC20.*allowance/);

      // but ether can already be deposited
      await expect(
          bwc.connect(acc1).deposit(0, nativeEther, 0, acc2.address, 10, 400, { value: 500 })
        ).to.changeEtherBalances([acc1, bwc], [-500, 500]);

      await expect(
          bwc.connect(acc2).deposit(5, nativeEther, 0, acc2.address, 10, 900, { value: 1000 })
        ).to.changeEtherBalances([acc2, bwc], [-1000, 1000]);

      // and withdrawn
      await expect(bwc.connect(acc2).withdraw(0)).to.be.reverted;
      await expect(
          bwc.connect(acc2).withdraw(5)
        ).to.changeEtherBalances([acc2, bwc], [1000 - heldFeePerRequest, -(1000 - heldFeePerRequest)]);

      // and let's approve the tokens now
      token.connect(acc1).approve(bwc.address,initialAllowance);
      token.connect(acc2).approve(bwc.address,initialAllowance);

      // now all kinds of deposits can be made.
      await expect(
          bwc.connect(acc1).deposit(1, nativeEther, 0, acc2.address, 30, 0, { value: 5000 })
        ).to.changeEtherBalances([acc1, bwc], [-5000, 5000]);

      await expect(
          bwc.connect(acc2).deposit(5, token.address, 200, acc1.address, 40, 190, { value: serviceFee })
        ).to.changeEtherBalances([acc2, bwc], [-serviceFee, serviceFee])
        .to.changeTokenBalances(token, [acc2, bwc], [-200, 200]);

      // todo. continue with token-withdraw, executions, owner-withdraws, change both fees,
      // more deposits and withdraws and executions (some which were submitted before fee change).
    });

  });
});
