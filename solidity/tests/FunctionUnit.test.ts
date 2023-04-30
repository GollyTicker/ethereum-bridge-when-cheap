import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./shared";


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

  const fixtureBarebone = () => fixture(false, false)

  it("tests a single function", async () => {
    const { bwc, accounts: [acc1, acc2], fakeL2AmmWrapper, initialNativeBalance, owner, token } = await loadFixture(fixtureBarebone);
  });

  // todo. add tests for each function testing all edge-cases.

  // todo. product arguments test. test, that all combinations of valid and invalid arguments don't break the system.

  // todo. how do we test for werid interactions and specific edge hard-to-imagine cases?
});
