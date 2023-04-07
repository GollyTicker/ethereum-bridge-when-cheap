import sys
import time
import json

# Running this requires the quicknode RPC URL with
# its built in API "key" as well as
# the prepopulated/empty "data/data.json" file.
# Empty means "{}".

from web3 import Web3

w = Web3(Web3.HTTPProvider(sys.argv[1]))

if not w.is_connected():
  raise "couldn't connect!"

print("Connected to RPC!")

data = {}
data_file = "data/data.json"
def load_data():
  with open(data_file, "r") as f:
    global data
    data = json.load(f)

load_data()

print("Starting with latest block")
print("Ctrl+C to exit.")

block = w.eth.get_block('latest')
skipped = 0

while True:
  blockNrStr = str(block.number)
  if blockNrStr in data:
    skipped = skipped + 1
    block = w.eth.get_block(block.number - 1)
    continue
  
  if skipped > 0:
    print("skipped",skipped,"already populated blocks")
    skipped = 0

  gasFeeGwei = block.baseFeePerGas // 1e9
  data[blockNrStr] = {
    "fee": gasFeeGwei,
    "t": block.timestamp
  }
  n = len(data)
  print(n,"| block:", block.number, block.timestamp, gasFeeGwei)

  time.sleep(0.25)
  block = w.eth.get_block(block.number - 1)

  if n % 10 == 0:
    with open(data_file, "w") as f:
      json.dump(data, f, indent=True)
    print("Saved progress.")

