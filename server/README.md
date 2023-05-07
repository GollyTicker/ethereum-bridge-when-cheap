# Bridge-When-Cheap Server

This server code runs in the background on a server in addition to the deployed smartcontract on chain and the static CDN-served website.

The server is responsible for the following tasks:
  * tracking the L1+L2 gas fees (gwei)
  * persisting gas fees
  * computing the predictions for low L1 gas fees (gwei) for the next 24h
  * tracking the currently pending requests and
    * executing them, if their gas fee and minAmountOut can be satisfied
      * updating the status depending on the reuslt of the execution
    * abandoning them, if more than 24h have been passed.
  * regularly withdrawing the owner deposits into my personal wallet.
