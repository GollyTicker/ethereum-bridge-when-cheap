
# EXPERIMENTAL!! DO NOT USE WITH REAL FUNDS.
Liabilities and warranties excluded.

---


# Bridge when Cheap

Bridge-when-cheap (BWC) is a simple website to bridge funds from an L2 supported by the [HOP Bridge](hop.exchange/) to the 
Ethereum mainnet, when the gas price is low on mainnet.

## Why?

If you want to bridge funds from L2 to L1, then its best to execute such a bridge, when the L1 gas price is low.
However, it's inconvinient to wake up at uncommon times ust to submit a transaction.

Bridge-when-cheap (BWC) allows you to submit a signed transaction to bridge your funds together with a desired
L1 gas price `p` (gwei). BWC keeps the signed transaction and *when the L1 gas price reaches `p`*,
BWC publishes it into the Hop bridge. This moves your funds are L1 at a low price.

BWC allows you to save transaction costs if you are willing to wait for a delayed bridging.

A minor caveat: When making a new transaction from the same wallet (potentially unrelated to BWC), publishing it on L2
and having it executed, the above signed transaction will be invalidated, because the same nonce will have been used.
In that case, the BWC signed transaction needs to be submitted again.

