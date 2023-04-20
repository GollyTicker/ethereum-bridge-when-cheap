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

# we have this block, so we can stop.
stop_at = 17090881

def load_data():
  with open(data_file, "r") as f:
    global data
    data = json.load(f)

load_data()

save_every = 200

def save_data():
  print("Saving.... Don't terminate!")
  with open(data_file, "w") as f:
    json.dump(data, f, indent=True)
  print("Saved progress.")

print("Ctrl+C to exit.")

startWith = w.eth.get_block(sys.argv[2]).number
print("Starting with block:", startWith)

blockNr = startWith
skipped = 0

while True:
  blockNrStr = str(blockNr)

  if blockNr == stop_at:
    print("Reached beginning of already saved data.")
    save_data()
    print("Finished.")
    break

  if blockNrStr in data:
    skipped = skipped + 1
    blockNr = blockNr - 1
    if (skipped < 50 and skipped % 10 == 0) or skipped % 1000 == 0:
      print("Skipped", skipped, " already populated blocks.")
    continue

  if skipped > 0:
    print("Skipped", skipped, "already populated blocks in total.")
    skipped = 0

  block = w.eth.get_block(blockNr)

  gasFeeGwei = block.baseFeePerGas // 1e9
  data[blockNrStr] = {
    "fee": gasFeeGwei,
    "t": block.timestamp
  }
  n = len(data)
  print(n,"| block:", block.number, block.timestamp, gasFeeGwei)

  if n % save_every == 0:
    save_data()

  time.sleep(0.205)

  blockNr = blockNr - 1
