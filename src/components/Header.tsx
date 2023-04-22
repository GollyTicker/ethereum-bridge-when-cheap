import React from 'react'
import Typography from '@mui/material/Typography'
import { Box, Link } from '@mui/material'

export function Header () {
  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Box mb={2} style={{
        textAlign: 'center',
        backgroundColor: 'red',
        color: 'black',
        fontWeight: 'bold',
        padding: 'auto 2em auto 2em'
      }} >
        <Typography variant="h5">
          THIS IS UNFINISHED! DO NOT INTERACT WITH THIS!
        </Typography>
      </Box>
      <Box mb={1}>
        <Typography variant="h3">
          🌈 Bridge When Cheap 💸
        </Typography>
      </Box>
      <Box mb={1}>
        <Typography variant='h6'>
          <Link href="https://github.com/GollyTicker/ethereum-bridge-when-cheap#readme" target='_blank'>How It Works ↗️</Link>
        </Typography>
      </Box>
    </Box>
  )
}
