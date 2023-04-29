import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish, ContractTransaction, constants } from "ethers";
import { ethers } from "hardhat";
import { BridgeWhenCheap } from "../typechain-types";
import { parseUnits } from "ethers/lib/utils";

const addressZero = constants.AddressZero;

type BridgeRequest = {
  source: string;
  destination: string;
  isTokenTransfer: boolean;
  token: string;
  amount: BigNumber;
  amountOutMin: BigNumber;
  wantedL1GasPrice: BigNumber;
  l2execGasFeeDeposit: BigNumber;
};

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


describe("BridgeWhenCheap", function () {

  async function fixture() {
    const accountsAndOwner = await ethers.getSigners();
    const accounts = accountsAndOwner.slice(1, nAccountsIncludingOwner) // i = 1,2,3 = 3 test accounts
    
    const fakeL2AmmWrapper = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();
    const bwc = await (await ethers.getContractFactory("BridgeWhenCheap")).deploy(l2GasfeeDeposit, serviceFee, 123);
    const token = await (await ethers.getContractFactory("TestToken")).deploy();

    await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
    await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);

    for (const acc of accounts) {
      await token.connect(acc).mint(initialAccountTokenBalance);
      await token.connect(acc).approve(bwc.address, initialAllowance);
    }

    const initialNativeBalance = await accounts[0].getBalance();

    return { bwc: bwc, owner: accountsAndOwner[0], accounts, initialNativeBalance, token, fakeL2AmmWrapper };
  }

  describe("Deposits", function () {
    it("initially empty", async function () {
      const { bwc, owner, accounts } = await loadFixture(fixture);
      allRequestsEmpty(bwc, [owner].concat(accounts));
    });

    for (const tc of testPermutations()) {
      it("end2end workflow " + (tc.expectDepositFailure && tc.expectExecFailure ? "success" : "failure") + " " + tc.desc, async () => {
        const { bwc, owner, accounts, initialNativeBalance, token, fakeL2AmmWrapper} = await loadFixture(fixture);
        const [sender, receiver] = accounts;


        // ======================== deposit

        const { id, amount, tokenTransfer, minOutAmount, wantedL1GasFee, followUp, expectDepositFailure, expectExecFailure } = tc;

        if (tokenTransfer) {
          expect(await token.balanceOf(sender.address)).to.equal(initialAccountTokenBalance);
        }

        const nativeEtherAmount = tokenTransfer ? serviceFee : amount;
        const tokenAmount = tokenTransfer ? amount : 0;
        const whichTokenAddr = tokenTransfer ? token.address : nativeEther;

        const depositP = bwc
          .connect(sender)
          .deposit(id, whichTokenAddr, tokenAmount, receiver.address, wantedL1GasFee, minOutAmount, { value: nativeEtherAmount });
        
        if (expectDepositFailure !== undefined) {
          await expect(depositP).to.be.revertedWith(expectDepositFailure);
          return;
        }

        const deposit = await depositP;

        expect(await sender.getBalance()).to.equal(
          initialNativeBalance.sub(nativeEtherAmount).sub(await totalPaidGasFeesOfTx(deposit))
        );

        if (tokenTransfer) {
          expect(await token.balanceOf(sender.address)).to.equal(BigNumber.from(initialAccountTokenBalance).sub(tokenAmount));
        }

        expect(await bwc.collectedServiceFeeExcludingGas()).equal(serviceFee - l2GasfeeDeposit);

        const request: BridgeRequest = await bwc.pendingRequests(sender.address, id);

        expect(request.source).equal(sender.address);
        expect(request.destination).equal(receiver.address);
        expect(request.amount).equal(BigNumber.from(amount).sub(tokenTransfer ? 0 : serviceFee));
        expect(request.amountOutMin).equal(minOutAmount);
        expect(request.token).equal(whichTokenAddr);
        expect(request.isTokenTransfer).equal(tokenTransfer);
        expect(request.l2execGasFeeDeposit).equal(l2GasfeeDeposit);
        expect(request.wantedL1GasPrice).equal(wantedL1GasFee);

        expect(isEmpty(await bwc.pendingRequests(sender.address, BigNumber.from(id).add(1)))).to.be.true;

        allRequestsEmpty(bwc, [owner].concat(...accounts.slice(1)));


        if (followUp === "withdraw") {
          // ======================== withdraw

          const requestorNativeBalance = await sender.getBalance();
          const requestorTokenBalance = await token.balanceOf(sender.address);

          const tx = await bwc.connect(sender).withdraw(id);

          const expectedNativeEtherBalance = requestorNativeBalance
            .add(tokenTransfer ? 0 : request.amount)
            .add(l2GasfeeDeposit)
            .sub(await totalPaidGasFeesOfTx(tx));
          const expectedTokenBalance = requestorTokenBalance.add(tokenTransfer ? request.amount : 0);

          expect(await sender.getBalance()).to.equal(expectedNativeEtherBalance);
          expect(await token.balanceOf(sender.address)).to.equal(expectedTokenBalance);
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

          expect(exec)
            .to.emit(fakeL2AmmWrapper, "SwapAndSend")
            .withArgs(
              owner.address,
              nativeEtherSent,
              0,
              receiver.address,
              request.amount,
              followUp.bonderFee,
              0,
              0,
              request.amountOutMin,
              0
            );

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
});
