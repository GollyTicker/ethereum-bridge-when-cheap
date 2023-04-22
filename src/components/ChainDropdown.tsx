import React from 'react'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'

export function ChainDropdown (props: any) {
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
