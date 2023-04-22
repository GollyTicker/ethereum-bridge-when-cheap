import React from 'react'
import { Box, Button } from '@mui/material'

export function ConnectionButton (props: {isConnected: boolean, handleConnect: any, handleDisconnect: any}) {
  if (!props.isConnected) {
    return (
      <Box mb={2}>
        <Button onClick={props.handleConnect} variant="contained">Connect Wallet</Button>
      </Box>
    )
  }

  return (
    <Box style={{ fontSize: '1.1em' }} >
      <Box mb={2} display="flex" flexDirection="column" alignItems={'center'}>
        <Button onClick={props.handleDisconnect} variant="outlined">Disconnect</Button>
      </Box>
    </Box>
  )
}
