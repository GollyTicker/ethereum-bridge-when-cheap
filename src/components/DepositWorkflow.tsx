import { LoadingButton } from '@mui/lab'
import { Box, TextField } from '@mui/material'
import React, { useEffect, useMemo, useState } from 'react'
import { ChainDropdown } from './ChainDropdown'
import { TokenDropdown } from './TokenDropdown'
import { Chain, Hop } from '@hop-protocol/sdk'
import { BigNumber, providers } from 'ethers'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { GlobalProps } from '../App'

export function DepositWorkflow (props: { global: GlobalProps }) {
  const { address, provider, signer, setSuccess, setError, isConnected } = props.global
  const [amount, setAmount] = useState('100')
  const [fromChain, setFromChain] = useState('arbitrum')
  const [recipient, setRecipient] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('DAI')
  const toChain = 'ethereum'
  const [estimate, setEstimate] = useState<any>(null)
  const [execNowTotalFee, setExecNowTotalFee] = useState(BigNumber.from(0))
  const [savedAmount, setSavedAmount] = useState<BigNumber>(BigNumber.from(0))
  const [needsApproval, setNeedsApproval] = useState(false)
  const [tokenBalance, setTokenBalance] = useState(BigNumber.from(0))

  const [isContractAccount, setIsContractAccount] = useState(false)

  useEffect(() => {
    (async () => {
      if (address) {
        const code = await provider?.getCode(address)
        setIsContractAccount(code !== '0x')
      }
    })()
  }, [address, provider])

  useEffect(() => {
    if (isContractAccount) {
      setRecipient('')
      return
    }
    if (!recipient) setRecipient(address)
  }, [address, recipient, isContractAccount])

  const bridge = useMemo(() => {
    console.log('bridge')
    const hop = new Hop('mainnet', signer)
    const bridge = hop.bridge(tokenSymbol)
    return bridge
  }, [tokenSymbol, signer])

  const supportedChains = useMemo(() => {
    console.log('supportedChainsPreWrap')
    const _chains = bridge.getSupportedChains()
    return _chains.map((chainSlug: string) => bridge.toChainModel(chainSlug))
  }, [bridge])

  const supportedTokens = useMemo(() => {
    console.log('supportedTokens')
    const _tokens = bridge.getSupportedTokens()
    return _tokens.map((tokenSymbol: string) => bridge.toTokenModel(tokenSymbol))
  }, [bridge])

  useEffect(() => {
    (async () => {
      try {
        if (!address) {
          return
        }
        const _balance = await bridge.getTokenBalance(fromChain)
        setTokenBalance(_balance)
      } catch (err: any) {
        console.error(err.message)
      }
    })()
    console.log('getTokenBalance')
  }, [address, bridge, fromChain])

  // useInterval(updateTokenBalance, 5 * 1000)

  useEffect(() => {
    (async () => {
      if (signer) {
        try {
          const amountBn = bridge.parseUnits(amount)
          const _needsApproval = await bridge.needsApproval(amountBn, fromChain)
          setNeedsApproval(_needsApproval)
        } catch (err: any) {
          setError(err.message)
        }
      }
    })()
    console.log('updateNeedsApprovalCb')
  }, [amount, bridge, fromChain, setError, signer])

  // useInterval(updateNeedsApproval, 5 * 1000)

  const [wantedGasPriceString] = useState('20')
  const [wantedGasPrice, setWantedGasPrice] = useState(parseUnits(wantedGasPriceString, 'gwei'))

  useEffect(() => {
    (async () => {
      const parsedWantedGasPrice = parseUnits(wantedGasPriceString, 'gwei')
      console.log('setWantedGasPrice')
      setWantedGasPrice(parsedWantedGasPrice)
    })()
      .catch(console.error)
  }, [wantedGasPriceString])

  useEffect(() => {
    console.log('define-update')
    async function update () {
      try {
        console.log('update')
        setSuccess('')
        setError('')
        setEstimate(null)
        const amountBn = bridge.parseUnits(amount)

        injectWantedGasPriceIntoEthereumChain(
          bridge.toChainModel(toChain),
          false,
          wantedGasPrice
        )
        const execNowEstimate = await bridge.getSendData(amountBn, fromChain, toChain)
        setExecNowTotalFee(execNowEstimate.totalFee)

        injectWantedGasPriceIntoEthereumChain(
          bridge.toChainModel(toChain),
          true,
          wantedGasPrice
        )
        const estimate = await bridge.getSendData(amountBn, fromChain, toChain)
        setEstimate(estimate)

        setSavedAmount(execNowEstimate.totalFee.sub(estimate.totalFee))
        // const txData = await bridge.populateSendTx(amountBn, fromChain, toChain, undefined /* min amount comes here */)
      } catch (err: any) {
        setError(err.message)
      }
    }
    update().catch(console.error)
  }, [bridge, fromChain, toChain, amount, supportedChains, wantedGasPrice, setSuccess, setError])

  async function handleApprove (event: any) {
    console.log('handleApprove')
    event.preventDefault()
    try {
      setSuccess('')
      setError('')
      const amountBn = bridge.parseUnits(amount)
      const tx = await bridge.sendApproval(amountBn, fromChain, toChain)
      if (tx.hash) {
        setSuccess(`Sent approval: ${tx.hash}`)
      }
    } catch (err: any) {
      setSuccess('')
      setError(err.message)
    }
  }

  async function handleSend (event: any) {
    event.preventDefault()
    try {
      setSuccess('')
      setError('')
      const amountBn = bridge.parseUnits(amount)
      let options :any = {}
      if (recipient) {
        options.recipient = recipient
      }
      if (fromChain === 'ethereum') {
        options = {
          relayerFee: 0
        }
      } else {
        options = {
          bonderFee: estimate.totalFee
        }
      }
      const tx = await bridge.send(amountBn, fromChain, toChain, options)
      if (tx.hash) {
        setSuccess(`Sent ${tx.hash}`)
      }
    } catch (err: any) {
      setSuccess('')
      setError(err.message)
    }
  }

  const estimatedReceivedFormatted = estimate && amount ? `≈ ${bridge.formatUnits(estimate.estimatedReceived).toFixed(4)} ${tokenSymbol}` : '...'
  const totalFeeFormatted = estimate && amount ? `${bridge.formatUnits(estimate.totalFee).toFixed(4)} ${tokenSymbol}` : '...'
  const execNowTotalFeeFormatted = estimate && amount ? `${bridge.formatUnits(execNowTotalFee).toFixed(4)}` : '...'
  const savedAmountFormatted = estimate ? bridge.formatUnits(savedAmount).toFixed(4) : '...'
  const savedAmountPercentageFormatted = !estimate ? '...' : bridge.formatUnits(savedAmount.mul(100).div(execNowTotalFee).mul(10e8).mul(10e8))

  // todo. this render loop is being run continously... we need to
  // find the place where it's making troubles...

  const sendEnabled = isConnected && estimate && amount && !needsApproval

  return (
    <Box style={{
      fontSize: '1.1em',
      borderTop: 'black dashed 0.2em',
      borderBottom: 'black dashed 0.2em',
      paddingTop: '0.7em'
    }} >
      <Box display="flex" flexDirection="column" alignItems="center">
        <Box>
          <span style={{ fontWeight: 'bold', fontSize: '1.4em' }}>DEPOSIT</span>
        </Box>
      </Box>
      <Box display="flex" flexWrap="wrap">
        <Box minWidth="350px" p={2}>
          <Box mb={2}>
            <TextField
              style={{ width: '78%', paddingRight: '2%' }}
              value={amount}
              label={'max ' + bridge.formatUnits(tokenBalance)}
              onChange={(event: any) => {
                setAmount(event.target.value)
              }}
            />
            <TokenDropdown
              tokens={supportedTokens}
              value={tokenSymbol}
              handleChange={(event: any) => {
                setTokenSymbol(event.target.value)
              }}
            />
          </Box>
          <Box mb={2}>
            <ChainDropdown
              label="from"
              chains={supportedChains.filter(c => !c.isL1)}
              value={fromChain}
              handleChange={(event: any) => {
                setFromChain(event.target.value)
              }}
            />
          </Box>
          <Box mb={2}>
            <TextField
              fullWidth
              defaultValue={address}
              label={'to Ethereum recipient' + (isContractAccount ? ' (required since sender is contract)' : '')}
              value={recipient}
              onChange={(event: any) => {
                console.log('set recipient')
                setRecipient(event.target.value)
              }}
            />
          </Box>
          { /* TODO. detect if wallet is a smart contract and remind to use a different recipient address. */ }
          <Box mb={2} pl={1}>
            <Box mb={1}>
              when Ethereum gas price is {wantedGasPriceString} gwei <small>(prediction)</small>
            </Box>
            <Box mb={1}>
              and receive <strong>{estimatedReceivedFormatted}</strong> on Ethereum.
            </Box>
            <Box mb={1}>
              Fee: {totalFeeFormatted} <small>instead
              of <s>{execNowTotalFeeFormatted} {tokenSymbol}</s></small>
            </Box>
            <Box mb={1}>
              You save&nbsp;
              <span
                style={{ color: 'darkgreen', fontWeight: 'bold' }}
              >
                {savedAmountFormatted}&nbsp;
                {tokenSymbol}&nbsp;
                = {savedAmountPercentageFormatted}% ⭐
              </span>
            </Box>
            <Box mb={1}>
              Your {tokenSymbol} will be bridged within 24h
              <br/><small>(with 98.6% probability based on historical analysis)</small>.
            </Box>
          </Box>
          <Box mb={2} pl={1}>
            <LoadingButton
              disabled={!needsApproval}
              onClick={handleApprove}
              variant="contained"
            >{needsApproval ? 'Approve' : 'Approved ✅'}</LoadingButton>

            <LoadingButton
              style={{ marginLeft: '1em' }}
              disabled={!sendEnabled}
              onClick={handleSend}
              variant="contained"
            >Deposit</LoadingButton>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

type GasFn = providers.Provider['getGasPrice']

type MChain = Chain & { provider: providers.Provider & {orgGetGasPrice: GasFn; futureGetGasPrice: GasFn;} }

function injectWantedGasPriceIntoEthereumChain (
  curr: Chain,
  futureChain: boolean,
  wantedGasPrice: BigNumber
): Chain {
  if (curr.chainId !== 1 || curr.provider === null) {
    return curr
  }

  const newChain: MChain = curr as any

  if (!newChain.provider.orgGetGasPrice) {
    newChain.provider.orgGetGasPrice = newChain.provider.getGasPrice
  }

  console.log('inject gas price:', formatUnits(wantedGasPrice, 'gwei'))

  newChain.provider.futureGetGasPrice = async () => wantedGasPrice

  newChain.provider.getGasPrice = futureChain ? newChain.provider.futureGetGasPrice : newChain.provider.orgGetGasPrice

  return newChain
}
