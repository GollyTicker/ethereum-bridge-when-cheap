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

print("Ctrl+C to exit.")

startWith = sys.argv[2]
print("Starting with block:", startWith)
if startWith != "latest":
  startWith = int(startWith)
block = w.eth.get_block(startWith)
skipped = 0

while True:
  blockNrStr = str(block.number)
  if blockNrStr in data:
    skipped = skipped + 1
    if skipped % 50 == 0:
      print("Skipped", skipped, " already populated blocks.")
    try:
      block = w.eth.get_block(block.number - 1)
    except Exception as e:
      print("Exception: ", e)
      print("Retrying after 1m.")
      time.sleep(60)
    continue
  
  if skipped > 0:
    print("Skipped", skipped, "already populated blocks in total.")
    skipped = 0

  gasFeeGwei = block.baseFeePerGas // 1e9
  data[blockNrStr] = {
    "fee": gasFeeGwei,
    "t": block.timestamp
  }
  n = len(data)
  print(n,"| block:", block.number, block.timestamp, gasFeeGwei)

  time.sleep(0.23)
  block = w.eth.get_block(block.number - 1)

  if n % 100 == 0:
    with open(data_file, "w") as f:
      json.dump(data, f, indent=True)
    print("Saved progress.")

