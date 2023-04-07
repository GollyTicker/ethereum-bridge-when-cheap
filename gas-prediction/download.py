import sys

from web3 import Web3

w = Web3(Web3.HTTPProvider(sys.argv[1]))

if not w.is_connected():
  raise "couldn't connect!"

print("Connected to RPC!")

print("Latest block info:")
block = w.eth.get_block('latest')

print("Blocknr", block.number)
print("block base gas fee", block.baseFeePerGas)
print("timestamp", block.timestamp)

