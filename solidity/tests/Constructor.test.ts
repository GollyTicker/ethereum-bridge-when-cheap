import { expect } from "chai";
import { BigNumberish } from "ethers";
import { ethers } from "hardhat";


describe("Constructor", function () {

  const testCases: [BigNumberish, BigNumberish, BigNumberish, RegExp | undefined][] = [
    [100, 1000, 1, undefined],
    [10, 10, 2, undefined],
    [1, 2, 3, undefined],
    [0, 0, 4, undefined],
    [1, 0, 5, /Service fee must cover at least the execution gas requirement/]
  ]

  for (const [ l2gasfeed, sfee, cid, errStr ] of testCases) {
    it("contract creation", async function () {
      const factory = await ethers.getContractFactory("BridgeWhenCheap");
      const bwcP = factory.deploy(l2gasfeed, sfee, cid);
      
      if (errStr !== undefined) {
        expect(bwcP).to.be.revertedWith(errStr);
        return;
      }
      const bwc = await bwcP;

      expect(await bwc.serviceFee()).to.equal(sfee);
      expect(await bwc.l2execGasFeeDeposit()).to.equal(l2gasfeed);
      expect(await bwc.layer1ChainId()).to.equal(cid);
    });
  }

});
