import React from 'react'
import { GlobalProps } from '../App'
import { Box } from '@mui/material'
import { BigNumber } from 'ethers'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { LoadingButton } from '@mui/lab'

type RequestStatus = 'waiting' | 'submitted' | 'aborted' | 'failed'

interface Request {
  requestId: string
  fromChain: string
  receiver: string
  wantedL1GasPrice: BigNumber
  totalFee: BigNumber
  token: string
  amount: BigNumber
  status: RequestStatus
}

function statusText (status: RequestStatus) {
  switch (status) {
    case 'waiting': return '⌛ ' + status
    case 'submitted': return '✅ ' + status + ' to Hop'
    case 'aborted': return '⚪ ' + status
    case 'failed': return '❌ ' + status
  }
}

export function ViewAndWithdrawDeposits (props: { global: GlobalProps }) {
  const pendingRquests: Request[] = [
    {
      requestId: '0',
      amount: parseUnits('100', 'ether'),
      token: 'DAI',
      fromChain: 'arbitrum',
      receiver: '0x27349832',
      totalFee: parseUnits('1', 'ether'),
      wantedL1GasPrice: parseUnits('10', 'gwei'),
      status: 'waiting'
    }
  ]

  return <Box p={2} display="flex" flexDirection="column" justifyContent="center" alignItems="center">
    <Box mb={1}>
      <span style={{ fontWeight: 'bold', fontSize: '1.5em' }}>
        REQUESTS
      </span>
    </Box>
    {pendingRquests.map(request => {
      return (<Box
          key={request.requestId}
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
        <Box>
          Send&nbsp;
          <b>{formatUnits(request.amount, 'ether')} {request.token}</b>&nbsp;
          from {request.fromChain}
          <br/>
          to {request.receiver.substring(0, 8)}&nbsp;
          at max {formatUnits(request.wantedL1GasPrice, 'gwei')} L1 gwei
        </Box>
        <Box ml={2} >
          {statusText(request.status)}
        </Box>
        <Box ml={2}>
            <LoadingButton
              disabled={request.status !== 'waiting'}
              onClick={() => 'todo'}
              variant="outlined"
            >withdraw</LoadingButton>
        </Box>
      </Box>)
    })}
  </Box>
}
