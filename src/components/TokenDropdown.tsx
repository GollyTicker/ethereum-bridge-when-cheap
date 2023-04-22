import React from 'react'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'

export function TokenDropdown (props: any) {
  const { label, tokens, value, handleChange } = props
  return (
    <FormControl style={{ width: '20%' }}>
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
