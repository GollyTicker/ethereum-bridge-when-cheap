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

describe("BridgeWhenCheap", function () {
  const l2GasfeeDeposit = 3;
  const serviceFee = 10;
  const nAccountsIncludingOwner = 4;
  const initialAccountTokenBalance = 1000;

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
      await token.connect(acc).approve(bwc.address, initialAccountTokenBalance);
    }

    const initialNativeBalance = await accounts[0].getBalance();

    return { bwc: bwc, owner: accountsAndOwner[0], accounts, initialNativeBalance, token };
  }

  describe("Deposits", function () {
    it("initially empty", async function () {
      const { bwc, owner, accounts } = await loadFixture(fixture);
      allRequestsEmpty(bwc, [owner].concat(accounts));
    });

    interface DepositTestCase {
      desc?: string;
      id: BigNumberish;
      amount: BigNumberish;
      tokenTransfer: boolean;
      wantedL1GasFee: BigNumberish;
      minOutAmount: BigNumberish;
    }

    function testPermutations(): DepositTestCase[] {
      const ids: BigNumberish[] = [0, 1, 2, parseUnits("10000", "ether")];
      const amounts: BigNumberish[] = [0, serviceFee - 1, serviceFee, 300, initialAccountTokenBalance, initialAccountTokenBalance+1, parseUnits("9999", "ether")];
      const tokenTransfers = [true, false];
      const wantedL1GasFees = [1, 1000, parseUnits("1", "ether")]

      const tcs: DepositTestCase[] = [];

      for (const id of ids) {
        for (const amount of amounts) {
          for (const tokenTransfer of tokenTransfers) {
            for (const wantedL1GasFee of wantedL1GasFees) {

              // amount == 0 implies that it's a nativeEther transfer. so token transfer is excluded then.
              if (BigNumber.from(0).eq(amount) && tokenTransfer) continue;
              
              let minOutAmount: BigNumberish;
              if (tokenTransfer) {
                if (BigNumber.from(amount).gt(initialAccountTokenBalance)) continue;
                minOutAmount = amount;
              }
              else {
                if (BigNumber.from(amount).lt(serviceFee)) continue;
                minOutAmount = BigNumber.from(amount).sub(serviceFee);
              }

              tcs.push({
                desc: "a" + amount.toString() + " i" + id.toString() + " tt"+tokenTransfer + " wl1" + wantedL1GasFee.toString(),
                amount, id, minOutAmount, tokenTransfer, wantedL1GasFee
              })
            }
          }
        }
      }
      return tcs;
    }

    const testCases: DepositTestCase[] = testPermutations();

    for (const tc of testCases) {
      it("deposit success " + tc.desc, async () => {
        const { bwc, owner, accounts, initialNativeBalance, token } = await loadFixture(fixture);
        const [sender, receiver] = accounts;

        const { id, amount, tokenTransfer, minOutAmount, wantedL1GasFee } = tc;

        if (tokenTransfer) {
          expect(await token.balanceOf(sender.address)).to.equal(initialAccountTokenBalance);
        }

        const nativeEtherAmount = tokenTransfer ? serviceFee : amount;
        const tokenAmount = tokenTransfer ? amount : 0;
        const whichTokenAddr = tokenTransfer ? token.address : nativeEther;

        const deposit = await bwc
          .connect(sender)
          .deposit(id, whichTokenAddr, tokenAmount, receiver.address, wantedL1GasFee, minOutAmount, { value: nativeEtherAmount });

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
      });
    }

    // todo. product arguments test. test, that all combinations of valid and invalid arguments don't break the system.

  });

  // todo. test when balance insufficient or approval isn't given.

});
