import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useInterval } from 'react-use'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LoadingButton from '@mui/lab/LoadingButton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import { BigNumber, providers } from 'ethers'
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import { Hop, Chain } from '@hop-protocol/sdk'
import './App.css'
import { Checkbox } from '@mui/material'

function TokenDropdown (props: any) {
  const { label, tokens, value, handleChange } = props
  return (
    <FormControl fullWidth>
      <InputLabel id="select-label">{label}</InputLabel>
      <Select
        labelId="select-label"
        id="simple-select"
        value={value}
        label={label}
        onChange={handleChange}
      >
        {tokens?.map((token: any, i: number) => {
          return (
            <MenuItem key={i} value={token.symbol}>{token.symbol}</MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}

function ChainDropdown (props: any) {
  const { label, chains, value, handleChange, readOnly } = props
  return (
    <FormControl fullWidth>
      <InputLabel id="select-label">{label}</InputLabel>
      <Select
        labelId="select-label"
        id="simple-select"
        value={value}
        label={label}
        onChange={handleChange}
        readOnly={readOnly ?? false}
      >
        {chains?.map((chain: any, i: number) => {
          return (
            <MenuItem key={i} value={chain.slug}>{chain.name}</MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}

type GasFn = providers.Provider['getGasPrice']
type MChain = Chain & { provider: providers.Provider & {orgGetGasPrice: GasFn; futureGetGasPrice: GasFn;} }

function wrapToFutureChain (curr: Chain, futureChain: boolean, wantedGasPrice: BigNumber): Chain {
  if (curr.chainId !== 1 || curr.provider === null) {
    return curr
  }

  const newChain: MChain = curr as any

  if (!newChain.provider.futureGetGasPrice) {
    console.log('first time init chain')
    newChain.provider.orgGetGasPrice = newChain.provider.getGasPrice
    newChain.provider.futureGetGasPrice = async () => wantedGasPrice
  }

  console.log('Setting gas price to future?', futureChain)
  newChain.provider.getGasPrice = futureChain ? newChain.provider.futureGetGasPrice : newChain.provider.orgGetGasPrice

  return newChain
}

function App () {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [address, setAddress] = useState('')
  const [nativeTokenBalance, setNativeTokenBalance] = useState<any>(null)
  const [signer, setSigner] = useState<any>(null)
  const [futureChain, setFutureChain] = useState<boolean>(false)
  const [wantedGasPriceString, setWantedGasPriceString] = useState('15')
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
  const [toChain] = useState('ethereum')
  const [amount, setAmount] = useState('100')
  const [recipient] = useState('')
  const [estimate, setEstimate] = useState<any>(null)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<any>(null)
  const [supportedChains, setSupportedChains] = useState<Chain[]>([])
  const bridge = useMemo(() => {
    const hop = new Hop('mainnet', signer)
    const bridge = hop.bridge(tokenSymbol)
    return bridge
  }, [tokenSymbol, signer])

  const _supportedChains = useMemo(() => {
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
    setSupportedChains(_supportedChains.map(chain => wrapToFutureChain(chain, futureChain, wantedGasPrice)))
  }, [_supportedChains, futureChain, wantedGasPrice])

  useEffect(() => {
    async function update () {
      try {
        setSuccess('')
        setError('')
        setEstimate(null)
        const amountBn = bridge.parseUnits(amount)
        const _estimate = await bridge.getSendData(amountBn, fromChain, toChain)
        setEstimate(_estimate)
        console.log('Estimation:', JSON.stringify(estimate, null, 2))
        for (const chain of supportedChains) {
          if (chain.chainId === 1 && chain.provider) {
            chain
              .provider
              .getGasPrice()
              .then(price => {
                console.log('using gas price: ', formatUnits(price, 'gwei'), 'gwei.')
              })
              .catch(console.warn)
          }
        }
      } catch (err: any) {
        setError(err.message)
      }
    }
    update().catch(console.error)
  }, [bridge, fromChain, toChain, amount, supportedChains])

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
  const nativeTokenBalanceFormatted = address && nativeTokenBalance ? Number(formatEther(nativeTokenBalance)).toFixed(4) : '-'
  const tokenBalanceFormatted = address && tokenBalance ? bridge.formatUnits(tokenBalance).toFixed(4) : '-'
  const totalFeeFormatted = estimate && amount ? `${bridge.formatUnits(estimate.totalFee).toFixed(4)} ${tokenSymbol}` : '-'
  const estimatedReceivedFormatted = estimate && amount ? `${bridge.formatUnits(estimate.estimatedReceived).toFixed(4)} ${tokenSymbol}` : '-'
  const sendEnabled = isConnected && estimate && amount && !needsApproval
  const sendSummary = `Send ${amount} ${tokenSymbol} ${fromChain} → ${toChain}`

  return (
    <Box>
      <Box p={4} m="0 auto" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
        <Box mb={3}>
          <Typography variant="h3">
            🌈 Bridge When Cheap 💸
          </Typography>
        </Box>
        <Box mb={3}>
          <Typography variant="h5">
            ⚠️ Experimental. Use at your own risk! ⚠️
          </Typography>
        </Box>
        {!isConnected && (
          <Box mb={2}>
            <Button onClick={handleConnect} variant="contained">Connect Wallet</Button>
          </Box>
        )}
        {isConnected && (
          <Box>
            <Box display="flex" flexDirection="column" alignItems="center">
              <Box mb={1}>
                <Button onClick={handleDisconnect} variant="contained">Disconnect</Button>
              </Box>
              <Box mb={1}>
                Account: {address}
              </Box>
              <Box mb={1}>
                <Box mb={1}>ETH: {nativeTokenBalanceFormatted}</Box>
                <Box mb={1}>{tokenSymbol}: {tokenBalanceFormatted}</Box>
              </Box>
            </Box>
            <Box display="flex" flexWrap="wrap">
              <Box minWidth="400px" p={4}>
                <Box mb={2}>
                  <Typography variant="body1">
                    Send {tokenSymbol}
                  </Typography>
                </Box>
                <Box mb={2}>
                  <TokenDropdown tokens={supportedTokens} label="Token" value={tokenSymbol} handleChange={(event: any) => {
                    setTokenSymbol(event.target.value)
                  }} />
                </Box>
                <Box mb={2}>
                  <ChainDropdown label="From Chain" chains={supportedChains} value={fromChain} handleChange={(event: any) => {
                    setFromChain(event.target.value)
                  }} />
                </Box>
                <Box mb={2}>
                  To Chain: {toChain}
                </Box>
                <Box mb={2}>
                  <TextField fullWidth label="Amount" value={amount} onChange={(event: any) => {
                    setAmount(event.target.value)
                  }} />
                </Box>
                {/*
                <Box mb={2}>
                  <TextField fullWidth label="Recipient (optional)" value={recipient} onChange={(event: any) => {
                    setRecipient(event.target.value)
                  }} />
                </Box>
                */}
                <Box mb={2}>
                  <Checkbox checked={futureChain} onChange={(event: any) => {
                    setFutureChain(event.target.checked)
                  }} />
                  use wanted gas price of
                  <TextField style={{ marginLeft: '1em' }} label="wantedGasPrice" value={wantedGasPriceString} onChange={(event: any) => {
                    setWantedGasPriceString(event.target.value)
                  }}/>
                </Box>
                <Box mb={4}>
                  <Box mb={1}>
                    {sendSummary}
                  </Box>
                  <Box mb={1}>
                    Total Fee: {totalFeeFormatted}
                  </Box>
                  <Box mb={1}>
                    Estimated Received: <strong>{estimatedReceivedFormatted}</strong>
                  </Box>
                </Box>
                <Box mb={2}>
                  <LoadingButton disabled={!needsApproval} onClick={handleApprove} variant="contained">Approve</LoadingButton>
                </Box>
                <Box mb={2}>
                  <LoadingButton disabled={!sendEnabled} onClick={handleSend} variant="contained">Send</LoadingButton>
                </Box>
                {!!error && (
                  <Box mb={2} style={{ maxWidth: '400px', wordBreak: 'break-word' }}>
                    <Alert severity="error">{error}</Alert>
                  </Box>
                )}
                {!!success && (
                  <Box mb={2}>
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
