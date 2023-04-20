

# EXPERIMENTAL AND WORK IN PROGRESS!!
# DO NOT USE WITH REAL FUNDS!
Liabilities and warranties excluded.

---


# 🌈 Bridge When Cheap 💸

Bridge-when-cheap (BWC): Bridge crypto from L2 to Ethereum L1 **at a cheaper fee** and save money!


It does that by delaying your briding request to a point in time when the gas prices are low on L1 and hence the destination transaction fees are low. *Save money when briding your funds back to mainnet while avoiding to wake up at uncommon times for your cheap transactions!*

The bridge is powered by the [Hop Protocol](https://hop.exchange) and hence corresponding L2s and tokens are supported.

## How to use

1. Open \<TODO-website\> and connect your wallet.
2. Select the source L2, the token and the amount of funds you want to bridge to L1.
3. Get a suggested cheaper briding fee based on the recent gas prices.
4. Approve the token.
5. Deposit your funds into the smart contract + a small fee for the  gas of the delayed execution.

**What happens next?**

Your request and funds will be stored in the smart contract.
A server-node (run by the developer) regularly checks L1 gas prices and the applicability of any requests.

When activity (and hence gas price) on L1 is low and the desired cheaper briding of funds is possible, the server-node will initiate the briding of the funds and they'll arrive in your specified address on L1.

## How secure and trustless is this?

In the spirit of the core values of Ethereum, Bridge-When-Cheap offers you desireable guarantees:
* ✅ The smart contract can only spend the funds to the L1 recipient you provide. They cannot be taken away.
  * *TODO*. The code is intended to be formally verified to prove these guarantees.
* ✅ You can always abort a request and withdraw your funds on L2 if you changed your mind.
  * This can be useful, if the server-node is down, the gas prices are too high to ever bridge your request, etc.
* ✅ You inherit the same bridging guarantees as provided by the Hop Protocol.
* ✅ The contract is immutable, hence it cannot be changed maliciously.

Q: *Why not use another bridge, like Layerswap, which also does this at a lower price, but instantly?*

You need to trust LayerSwap whereas with Bridge-When-Cheap and Hop Protocol you have verifiable trust. Check the amazing summary at the [l2beat page on Hop Protocol](https://l2beat.com/bridges/projects/hop).
