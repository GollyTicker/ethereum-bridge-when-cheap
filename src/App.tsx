import React, { useState, useEffect, useCallback } from 'react'
import { useInterval } from 'react-use'
import Box from '@mui/material/Box'
import { providers } from 'ethers'
import './App.css'
import { Header } from './components/Header'
import { ConnectionButton } from './components/ConnectionButton'
import { Alert } from '@mui/material'
import { DepositWorkflow } from './components/DepositWorkflow'

export interface GlobalProps {
  address: string
  signer: any
  provider: providers.Web3Provider | undefined
  isConnected: boolean
  success: string
  setSuccess: any
  error: string
  setError: any
}

function App () {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [address, setAddress] = useState('')
  const setNativeTokenBalance = useState<any>(null)[1] // todo.
  const [signer, setSigner] = useState<any>(null)
  const [provider] = useState(() => {
    try {
      return new providers.Web3Provider((window as any).ethereum, 'any')
    } catch (err: any) {
      setError(err.message)
    }
  })

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

  const isConnected = !!signer

  const globalProps : GlobalProps = {
    address,
    signer,
    provider,
    isConnected,
    success,
    setSuccess,
    error,
    setError
  }

  console.log('sadsdf', Date.now())

  return (
    <Box p={4} m="0 auto" display="flex" flexDirection="column" justifyContent="center" alignItems="center">

      <Header/>

      <ConnectionButton
        isConnected={isConnected}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
      />

      {isConnected && <DepositWorkflow global={globalProps}/>}

      {Boolean(error) && (
        <Box mb={2} pl={1} style={{ maxWidth: '400px', wordBreak: 'break-word' }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {Boolean(success) && (
        <Box mb={2} pl={1}>
          <Alert severity="success">{success}</Alert>
        </Box>
      )}
    </Box>
  )
}

export default App
