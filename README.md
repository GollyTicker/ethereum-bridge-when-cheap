

# EXPERIMENTAL!! DO NOT USE WITH REAL FUNDS.
Liabilities and warranties excluded.

---


# 🌈 Bridge When Cheap 💸

Bridge-when-cheap (BWC) is a simple website to bridge funds from an L2 supported by the [HOP Bridge](https://hop.exchange) to the 
Ethereum mainnet, when the gas price is low on mainnet.

**Note:** The idea with pre-signing the transaction won't work with MetaMask :/ The RPC method [eth_signTransaction](https://ethereum.github.io/execution-apis/api-documentation) isn [not supported by MetaMask](https://github.com/MetaMask/metamask-extension/issues/7644) due to [security and complexity concerns](https://github.com/MetaMask/metamask-extension/issues/3475).

It seems that the only way to offer such a service is to actually *write a smart contract that sends the funds on
behalf of the owners when gas is low.* This smart contract would
* be deployed on multiple L2s
* store the tuples of (source addr, destination addr, token, value, bonder fee and L1 gas price wants) for each request
* execute the above requests, when the gas price wants is reached
* allow the original users to withdraw stored funds if they haven't yet been sent to L1

## Why?

If you want to bridge funds from L2 to L1, then its best to execute such a bridge, when the L1 gas price is low.
However, it's inconvinient to wake up at uncommon times ust to submit a transaction.

Bridge-when-cheap (BWC) allows you to submit a signed transaction to bridge your funds together with a desired
L1 gas price `p` (gwei). BWC keeps the signed transaction and *when the L1 gas price reaches `p`*,
BWC publishes it into the Hop bridge. This moves your funds when the L1 destination gas fees are low - saving you precious 💸.

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


---

# Hop v1 SDK Demo

> A simple React demo for the [Hop SDK](https://github.com/hop-protocol/hop/tree/develop/packages/sdk)

## Demo

[https://sdk-demo.hop.exchange/](https://sdk-demo.hop.exchange/)

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
