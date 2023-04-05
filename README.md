
# EXPERIMENTAL!! DO NOT USE WITH REAL FUNDS.
Liabilities and warranties excluded.

---


# Bridge when Cheap

Bridge-when-cheap (BWC) is a simple website to bridge funds from an L2 supported by the [HOP Bridge](https://hop.exchange) to the 
Ethereum mainnet, when the gas price is low on mainnet.

## Why?

If you want to bridge funds from L2 to L1, then its best to execute such a bridge, when the L1 gas price is low.
However, it's inconvinient to wake up at uncommon times ust to submit a transaction.

Bridge-when-cheap (BWC) allows you to submit a signed transaction to bridge your funds together with a desired
L1 gas price `p` (gwei). BWC keeps the signed transaction and *when the L1 gas price reaches `p`*,
BWC publishes it into the Hop bridge. This moves your funds are L1 at a low price.

BWC allows you to save transaction costs if you are willing to wait for a delayed bridging.

A minor caveat: When making a new transaction from the same wallet (potentially unrelated to BWC), publishing it on L2
and having it executed, the BWC signed transaction with the same nonce will be invalidated.
In that case, the BWC signed transaction needs to be submitted again, as otherwise no funds will be bridged.

## How secure and trustless is this?

* ✅ BWC only receives the sigend transaction and cannot steal any funds. Either the transaction is submitted or it is not.
  This means that either the funds will be bridged or not. But they cannot get lost or be stolen.
* ✅ You can always invalidate any queued BWC transaction by making a transaction ourself and submitting it.
  Since the nonce gets used, it's not possible for BWC to submit and run the signed transaction anymore.
* 🟠 The worst thing BWC could do is to bridge funds when the gas fees are high. However, these
  tx costs wouldn't go to profit BWC, but the validators on L1 instead. This could only happen,
  if there is a serious bug which wasn't caught by the tests or if the website behaves maliciously due
  to a hack or rouge developer.
  * *TODO*: Is it perhaps to avoid these by having the correct desired amount of transaction fees included in the
    tx? This way, atmost this amount can get "lost" at all.
* ℹ️ If the BWC server goes offline, then the funds are not moved. In this case, you can still always cancel the tx or move
  the funds immediately at a higher gas price.
