import React from 'react'
import { Box, Button } from '@mui/material'

export function ConnectionButton (props: {isConnected: boolean, handleConnect: any, handleDisconnect: any}) {
  if (!props.isConnected) {
    return (
      <Box mb={1}>
        <Button onClick={props.handleConnect} variant="contained">Connect Wallet</Button>
      </Box>
    )
  }

  return (
    <Box mb={2}>
      <Button
        onClick={props.handleDisconnect}
        variant="outlined"
        style={{ height: '80%', fontSize: '0.8em' }}
      >Disconnect</Button>
    </Box>
  )
}
