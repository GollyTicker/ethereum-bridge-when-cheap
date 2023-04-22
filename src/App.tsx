import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useInterval } from 'react-use'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LoadingButton from '@mui/lab/LoadingButton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import { BigNumber, providers } from 'ethers'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { Hop, Chain } from '@hop-protocol/sdk'
import './App.css'
import { Link } from '@mui/material'
import { TokenDropdown } from './components/TokenDropdown'
import { ChainDropdown } from './components/ChainDropdown'

type GasFn = providers.Provider['getGasPrice']
type MChain = Chain & { provider: providers.Provider & {orgGetGasPrice: GasFn; futureGetGasPrice: GasFn;} }

function injectWantedGasPriceIntoEthereumChain (curr: Chain, futureChain: boolean, wantedGasPrice: BigNumber): Chain {
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

function App () {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [address, setAddress] = useState('')
  const setNativeTokenBalance = useState<any>(null)[1]
  const [signer, setSigner] = useState<any>(null)
  const [wantedGasPriceString, setWantedGasPriceString] = useState('20')
  const [wantedGasPrice, setWantedGasPrice] = useState(parseUnits(wantedGasPriceString, 'gwei'))
  const [provider] = useState(() => {
    try {
      return new providers.Web3Provider((window as any).ethereum, 'any')
    } catch (err: any) {
      setError(err.message)
    }
  })
  const [tokenSymbol, setTokenSymbol] = useState('DAI')
  const [fromChain, setFromChain] = useState('arbitrum')
  const toChain = 'ethereum'
  const [amount, setAmount] = useState('100')
  const [recipient, setRecipient] = useState('')
  const [estimate, setEstimate] = useState<any>(null)
  const [execNowTotalFee, setExecNowTotalFee] = useState(BigNumber.from(0))
  const [savedAmount, setSavedAmount] = useState<BigNumber>(BigNumber.from(0))
  const [needsApproval, setNeedsApproval] = useState(false)
  const setTokenBalance = useState<any>(null)[1]
  const [supportedChainsPostWrap, setSupportedChainsPostWrap] = useState<Chain[]>([])
  const bridge = useMemo(() => {
    const hop = new Hop('mainnet', signer)
    const bridge = hop.bridge(tokenSymbol)
    return bridge
  }, [tokenSymbol, signer])

  const supportedChainsPreWrap = useMemo(() => {
    const _chains = bridge.getSupportedChains()
    return _chains.map((chainSlug: string) => bridge.toChainModel(chainSlug))
  }, [bridge])

  const supportedTokens = useMemo(() => {
    const _tokens = bridge.getSupportedTokens()
    return _tokens.map((tokenSymbol: string) => bridge.toTokenModel(tokenSymbol))
  }, [bridge])

  const updateBalance = async () => {
    try {
      if (!provider) {
        return
      }
      if (!address) {
        return
      }
      const _balance = await provider.getBalance(address)
      setNativeTokenBalance(_balance)
    } catch (err: any) {
      console.error(err.message)
    }
  }

  const updateBalanceCb = useCallback(updateBalance, [updateBalance])

  useEffect(() => {
    if (address) {
      updateBalanceCb()
    }
  }, [address, updateBalanceCb])

  useInterval(updateBalance, 5 * 1000)

  const updateTokenBalance = async () => {
    try {
      if (!address) {
        return
      }
      const _balance = await bridge.getTokenBalance(fromChain)
      setTokenBalance(_balance)
    } catch (err: any) {
      console.error(err.message)
    }
  }

  const updateTokenBalanceCb = useCallback(updateTokenBalance, [updateTokenBalance])

  useEffect(() => {
    if (address) {
      updateTokenBalanceCb()
    }
  }, [address, updateTokenBalanceCb])

  useInterval(updateTokenBalance, 5 * 1000)

  useEffect(() => {
    (async () => {
      const parsedWantedGasPrice = parseUnits(wantedGasPriceString, 'gwei')
      setWantedGasPrice(parsedWantedGasPrice)
    })()
      .catch(console.error)
  }, [wantedGasPriceString])

  useEffect(() => {
    async function update () {
      if (signer) {
        const address = await signer?.getAddress()
        setAddress(address)
      } else {
        setAddress('')
      }
    }

    update().catch(console.error)
  }, [signer])

  async function updateNeedsApproval () {
    if (signer) {
      try {
        const amountBn = bridge.parseUnits(amount)
        const _needsApproval = await bridge.needsApproval(amountBn, fromChain)
        setNeedsApproval(_needsApproval)
      } catch (err: any) {
        setError(err.message)
      }
    }
  }

  const updateNeedsApprovalCb = useCallback(updateNeedsApproval, [updateNeedsApproval])

  useEffect(() => {
    updateNeedsApprovalCb().catch(console.error)
  }, [updateNeedsApprovalCb])

  useInterval(updateNeedsApproval, 5 * 1000)

  async function handleConnect (event: any) {
    event.preventDefault()
    try {
      if (provider) {
        await provider.send('eth_requestAccounts', [])
        if (provider.getSigner()) {
          setSigner(provider.getSigner())
          setRecipient(await provider.getSigner().getAddress())
        }
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleDisconnect (event: any) {
    event.preventDefault()
    setSigner(null)
  }

  useEffect(() => {
    setSupportedChainsPostWrap(supportedChainsPreWrap)
    /* .map(chain => wrapToFutureChain(chain, futureChain, wantedGasPrice)) */
  }, [supportedChainsPreWrap])

  useEffect(() => {
    async function update () {
      try {
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
  }, [bridge, fromChain, toChain, amount, supportedChainsPostWrap, wantedGasPrice])

  async function handleApprove (event: any) {
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

  const isConnected = !!signer
  const estimatedReceivedFormatted = estimate && amount ? `≈ ${bridge.formatUnits(estimate.estimatedReceived).toFixed(4)} ${tokenSymbol}` : '...'
  const totalFeeFormatted = estimate && amount ? `${bridge.formatUnits(estimate.totalFee).toFixed(4)} ${tokenSymbol}` : '...'
  const execNowTotalFeeFormatted = estimate && amount ? `${bridge.formatUnits(execNowTotalFee).toFixed(4)}` : '...'
  const savedAmountFormatted = estimate ? bridge.formatUnits(savedAmount).toFixed(4) : '...'
  const savedAmountPercentageFormatted = !estimate ? '...' : bridge.formatUnits(savedAmount.mul(100).div(execNowTotalFee).mul(10e8).mul(10e8))

  // todo. this render loop is being run continously... we need to
  // find the place where it's making troubles...

  const sendEnabled = isConnected && estimate && amount && !needsApproval

  return (
    <Box>
      <Box p={4} m="0 auto" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
        <Box mb={3}>
          <Typography variant="h3">
            🌈 Bridge When Cheap 💸
          </Typography>
        </Box>
        <Box mb={1}>
          <Typography variant='h6'>
            <Link href="https://github.com/GollyTicker/ethereum-bridge-when-cheap#readme" target='_blank'>How It Works ↗️</Link>
          </Typography>
        </Box>
        <Box mb={2} style={{
          textAlign: 'center',
          backgroundColor: 'red',
          color: 'black',
          fontWeight: 'bold',
          padding: 'auto 2em auto 2em'
        }} >
          <Typography variant="h6">
            Experimental and Work in Progress!
            <br/>
            This is not ready to be used publicly!
          </Typography>
        </Box>
        {!isConnected && (
          <Box mb={2}>
            <Button onClick={handleConnect} variant="contained">Connect Wallet</Button>
          </Box>
        )}
        {isConnected && (
          <Box style={{ fontSize: '1.1em' }} >
            <Box mb={2} display="flex" flexDirection="column" alignItems={'center'}>
              <Button onClick={handleDisconnect} variant="outlined">Disconnect</Button>
            </Box>
            <Box display="flex" flexDirection="column" pl={3}>
              <Box>
                From account&nbsp;
                <span style={{ whiteSpace: 'pre' }}>{address.substring(0, 8)}</span> {/* todo. add tooltip with full address */}
                send
              </Box>
            </Box>
            <Box display="flex" flexWrap="wrap">
              <Box minWidth="400px" p={2}>
                <Box mb={2}>
                  <TextField
                    style={{ width: '78%', paddingRight: '2%' }}
                    value={amount}
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
                    chains={supportedChainsPostWrap.filter(c => !c.isL1)}
                    value={fromChain}
                    handleChange={(event: any) => {
                      setFromChain(event.target.value)
                    }}
                  />
                </Box>
                <Box mb={2}>
                  <TextField
                    fullWidth
                    label="to Ethereum recipient"
                    value={recipient}
                    onChange={(event: any) => {
                      setRecipient(event.target.value)
                    }}
                  />
                </Box>
                { // TODO. detect if wallet is a smart contract and remind to use a different recipient address.
                }
                <Box mb={2}>
                  <TextField
                    fullWidth
                    label="when Ethereum gas price is (gwei)"
                    value={wantedGasPriceString}
                    onChange={(event: any) => {
                      setWantedGasPriceString(event.target.value)
                    }}
                  />
                </Box>
                <Box mb={4} pl={1}>
                  <Box mb={1}>
                    and receive <strong>{estimatedReceivedFormatted}</strong> on Ethereum.
                  </Box>
                  <Box mb={1}>
                    Fee: {totalFeeFormatted} instead
                    of <s>{execNowTotalFeeFormatted}</s>
                    <br/>
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
                  <LoadingButton disabled={!needsApproval} onClick={handleApprove} variant="contained">{needsApproval ? 'Approve' : 'Approved ✅'}</LoadingButton>
                </Box>
                <Box mb={2} pl={1}>
                  <LoadingButton disabled={!sendEnabled} onClick={handleSend} variant="contained">Deposit</LoadingButton>
                </Box>
                {!!error && (
                  <Box mb={2} pl={1} style={{ maxWidth: '400px', wordBreak: 'break-word' }}>
                    <Alert severity="error">{error}</Alert>
                  </Box>
                )}
                {!!success && (
                  <Box mb={2} pl={1}>
                    <Alert severity="success">{success}</Alert>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default App
