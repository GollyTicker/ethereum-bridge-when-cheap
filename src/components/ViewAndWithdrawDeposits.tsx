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
  submitTx?: string
}

function statusText (status: RequestStatus) {
  switch (status) {
    case 'waiting': return '⌛ ' + status
    case 'submitted': return '✅ ' + status
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
      receiver: '0x87868fd4347E695d87981aAD388574D54e92Ac71',
      totalFee: parseUnits('1', 'ether'),
      wantedL1GasPrice: parseUnits('10', 'gwei'),
      status: 'waiting'
    },
    {
      requestId: '3',
      amount: parseUnits('10', 'ether'),
      token: 'ETH',
      fromChain: 'arbitrum',
      receiver: '0x123456d4347E695d87981aAD388574D54e92Ac71',
      totalFee: parseUnits('15', 'ether'),
      wantedL1GasPrice: parseUnits('15', 'gwei'),
      status: 'submitted',
      submitTx: '0x12121212347E695d87981aAD388574D54e92Ac71'
    },
    {
      requestId: '2',
      amount: parseUnits('1', 'ether'),
      token: 'USDC',
      fromChain: 'arbitrum',
      receiver: '0x987654d4347E695d87981aAD388574D54e92Ac71',
      totalFee: parseUnits('12', 'ether'),
      wantedL1GasPrice: parseUnits('13', 'gwei'),
      status: 'aborted'
    }
  ]

  return <Box
    p={2}
    display="flex" flexDirection="column" justifyContent="center"
    style={{ fontSize: '1.1em' }}
    >
    <Box mb={1} display="flex" justifyContent="center" alignItems="center">
      <span style={{ fontWeight: 'bold', fontSize: '1.5em' }}>
        REQUESTS
      </span>
    </Box>
    {pendingRquests.map((request, idx) => {
      return (<Box
          key={request.requestId}
          display="flex"
          alignItems="left"
          marginTop={idx === 0 ? 1 : 2}
          paddingTop={idx === 0 ? 0 : 2}
          borderTop={idx === 0 ? '' : 'dotted gray 0.13em'}
          minWidth="350px"
        >
        <Box pr={2} style={{ width: '50%', marginTop: 'auto', marginBottom: 'auto' }} >
          Bridge&nbsp;
          <b>{formatUnits(request.amount, 'ether')} {request.token}</b>
          <br/>
          to <a
            href={'https://etherscan.io/address/' + request.receiver}
            target="_blank"
            rel="noreferrer"
          >
            {request.receiver.substring(0, 8)} ↗️
          </a>
          <br/>
          <small>gas ≤ {formatUnits(request.wantedL1GasPrice, 'gwei')} gwei</small>
        </Box>
        <Box
          pl={2}
          borderLeft="gray 0.1em dotted"
          display="flex" flexDirection="column"
          alignItems="center"
          style={{ width: '50%' }}
        >
          <p style={{ marginTop: '0.5em', marginBottom: '0.2em' }}>
            {statusText(request.status)}
          </p>

          {request.status === 'waiting' &&
            <LoadingButton
              onClick={() => 'todo'}
              variant="outlined"
              style={{ marginTop: '0.3em', marginBottom: '0.5em' }}
            >withdraw</LoadingButton>
          }

          {request.submitTx &&
            <a
              href={'https://arbiscan.io/tx/' + request.submitTx}
              target="_blank"
              rel="noreferrer"
            >
              {request.submitTx.substring(0, 8)} ↗️
            </a>
          }
        </Box>
      </Box>)
    })}
  </Box>
}
