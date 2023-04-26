import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";

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

const nativeEther = constants.AddressZero;

function isEmpty(request: BridgeRequest): boolean {
  return request.source === constants.AddressZero &&
    request.destination === constants.AddressZero &&
    request.amount.eq(0) &&
    request.wantedL1GasPrice.eq(0)
}

describe("BridgeWhenCheap", function () {
  const l2GasfeeDeposit = 1;
  const serviceFee = 10;

  async function fixture() {
    const [owner, acc1, acc2, acc3] = await ethers.getSigners();
    const ContractFactory = await ethers.getContractFactory("BridgeWhenCheap");
    const bwc = await ContractFactory.deploy(
      l2GasfeeDeposit,
      serviceFee,
      123,
      {
        /* no gas or value */
      }
    );

    return { bwc: bwc, owner, accounts: [acc1, acc2, acc3] };
  }

  describe("Deposits", function () {
    it("initially empty", async function () {
      const { bwc, owner, accounts } = await loadFixture(fixture);

      for (const acc of [owner].concat(...accounts)) {
        for (let i = 0; i < 3; i++) {
          const request: BridgeRequest = await bwc.pendingRequests(acc.address, i);
          expect(isEmpty(request)).to.be.true
        }
      }
    });


    it("native success sane", async () => {
      const { bwc, owner, accounts: [acc1, acc2] } = await loadFixture(fixture);

      await bwc.connect(acc1).deposit(0, nativeEther, 0, acc2.address, 10, 200, { value: 300 });

      expect(await bwc.collectedServiceFeeExcludingGas()).equal(serviceFee - l2GasfeeDeposit);

      const request: BridgeRequest = await bwc.pendingRequests(acc1.address, 0);

      expect(request.source).equal(acc1.address);
      expect(request.destination).equal(acc2.address);
      expect(request.amount).equal(300 - serviceFee);
      expect(request.amountOutMin).equal(200);
      expect(request.isTokenTransfer).equal(false);
      expect(request.l2execGasFeeDeposit).equal(l2GasfeeDeposit);
      expect(request.wantedL1GasPrice).equal(10);
    });

  });

});
