import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, ContractTransaction, constants } from "ethers";
import { ethers } from "hardhat";
import { BridgeWhenCheap } from "../typechain-types";

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
  const l2GasfeeDeposit = 1;
  const serviceFee = 10;
  const nAccountsIncludingOwner = 4;
  const initialAccountTokenBalance = 1000;

  async function fixture() {
    const accountsAndOwner = await ethers.getSigners();
    const accounts = accountsAndOwner.slice(1, nAccountsIncludingOwner) // i = 1,2,3 = 3 test accounts
    
    const fakeL2AmmWrapper = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();
    const bwc = await (await ethers.getContractFactory("BridgeWhenCheap")).deploy(l2GasfeeDeposit, serviceFee, 123);
    const token = await (await ethers.getContractFactory("TestToken")).deploy();

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

    it("native success sane", async () => {
      const { bwc, owner, accounts, initialNativeBalance} = await loadFixture(fixture);
      const [acc1, acc2 ] = accounts;

      const nativeAmountDeposited = 300;

      const deposit = await bwc.connect(acc1).deposit(0, nativeEther, 0, acc2.address, 10, 200, { value: nativeAmountDeposited });

      expect(await acc1.getBalance()).to.equal(
        initialNativeBalance.sub(nativeAmountDeposited).sub(await totalPaidGasFeesOfTx(deposit))
      );

      expect(await bwc.collectedServiceFeeExcludingGas()).equal(serviceFee - l2GasfeeDeposit);

      const request: BridgeRequest = await bwc.pendingRequests(acc1.address, 0);

      expect(request.source).equal(acc1.address);
      expect(request.destination).equal(acc2.address);
      expect(request.amount).equal(nativeAmountDeposited - serviceFee);
      expect(request.amountOutMin).equal(200);
      expect(request.token).equal(nativeEther);
      expect(request.isTokenTransfer).equal(false);
      expect(request.l2execGasFeeDeposit).equal(l2GasfeeDeposit);
      expect(request.wantedL1GasPrice).equal(10);

      expect(isEmpty(await bwc.pendingRequests(acc1.address, 1))).to.be.true;

      allRequestsEmpty(bwc, [owner].concat(...accounts.slice(1)));
    });

    // todo. product arguments test. test, that all combinations of valid and invalid arguments don't cheak the system.

    it("token success sane", async () => {
      const { bwc, owner, accounts, token, initialNativeBalance } = await loadFixture(fixture);
      const [acc1, acc2] = accounts

      expect(await token.balanceOf(acc1.address)).to.equal(initialAccountTokenBalance);

      const tokenAmountDeposited = 300;

      const deposit = await bwc.connect(acc1).deposit(0, token.address, tokenAmountDeposited, acc2.address, 10, 200, { value: serviceFee });

      expect(await acc1.getBalance()).to.equal(
        initialNativeBalance.sub(serviceFee).sub(await totalPaidGasFeesOfTx(deposit))
      );

      expect(await token.balanceOf(acc1.address)).to.equal(initialAccountTokenBalance - tokenAmountDeposited);

      expect(await bwc.collectedServiceFeeExcludingGas()).equal(serviceFee - l2GasfeeDeposit);

      const request: BridgeRequest = await bwc.pendingRequests(acc1.address, 0);

      expect(request.source).equal(acc1.address);
      expect(request.destination).equal(acc2.address);
      expect(request.amount).equal(300);
      expect(request.amountOutMin).equal(200);
      expect(request.token).equal(token.address);
      expect(request.isTokenTransfer).equal(true);
      expect(request.l2execGasFeeDeposit).equal(l2GasfeeDeposit);
      expect(request.wantedL1GasPrice).equal(10);

      expect(isEmpty(await bwc.pendingRequests(acc1.address, 1))).to.be.true;

      allRequestsEmpty(bwc, [owner].concat(...accounts.slice(1)));
    });

  });

  // todo. test when balance insufficient or approval isn't given.

});
