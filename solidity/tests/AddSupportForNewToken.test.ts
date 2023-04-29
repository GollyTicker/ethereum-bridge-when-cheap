import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";
import { BridgeWhenCheap } from "../typechain-types";

const addressZero = constants.AddressZero;

const nativeEther = addressZero;

describe("AddSupportForNewToken", function () {

  async function fixture() {
    const [ owner, nonOwner ] = await ethers.getSigners();
    
    const firstFakeBridge = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();

    const secondFakeBridge = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();
    
    const bwc = await (await ethers.getContractFactory("BridgeWhenCheap")).deploy(10, 30, 123);
    
    const token = await (await ethers.getContractFactory("TestToken")).deploy();

    // await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
    return { bwc, owner, nonOwner, token,
      tokenBridgesToTest: [
        { token: nativeEther, bridge: firstFakeBridge},
        { token: token.address, bridge: secondFakeBridge }
      ]
    };
  }

  async function isDefined(bwc: BridgeWhenCheap, token: string): Promise<boolean> {
    return await bwc.bridgeContractOf(token) !== addressZero;
  }

  it("is initially unset", async function () {
    const { bwc, tokenBridgesToTest } = await loadFixture(fixture);

    for (const {token} of tokenBridgesToTest) {
      expect(await isDefined(bwc, token)).to.be.false;
    }
  });

  it("can only be called by the owner",async () => {
    const { bwc, owner, nonOwner, tokenBridgesToTest} = await loadFixture(fixture);

    for (const {token, bridge} of tokenBridgesToTest) {
      expect(bwc.connect(nonOwner).addSupportForNewToken(token, bridge.address)).to.be.reverted;
      
      await bwc.connect(owner).addSupportForNewToken(token, bridge.address);
    }
  })

  it("sets the bridge contract exactly once per token",async () => {
    const { bwc, tokenBridgesToTest} = await loadFixture(fixture);

    for (const {token, bridge} of tokenBridgesToTest) {
      expect(await isDefined(bwc, token)).to.be.false;

      await bwc.addSupportForNewToken(token, bridge.address);
      
      expect(await isDefined(bwc, token)).to.be.true;

      await expect(bwc.addSupportForNewToken(token, bridge.address)).to.be.revertedWith(/already supported/);

      expect(await bwc.bridgeContractOf(token)).to.equal(bridge.address);
    }
  });

  it("doens't allow a zero address as destination",async () => {
    const { bwc, tokenBridgesToTest} = await loadFixture(fixture);

    for (const {token} of tokenBridgesToTest) {
      await expect(bwc.addSupportForNewToken(token, addressZero)).to.be.revertedWith(/must not be 0 address/);
    }
  });

});
