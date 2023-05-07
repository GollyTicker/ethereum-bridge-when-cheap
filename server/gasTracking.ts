import { providers } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { GAS_TRACKER_QUEUE } from "./config";
import { GasDB, GasInfo } from "./db";

async function recordBlock(
  elt: [providers.Block, Date],
  provider: providers.JsonRpcProvider,
  db: GasDB
) {
  const [block, _receiveDate] = elt;

  const gasInfo: GasInfo = {
    blockNr: block.number,
    unixSeconds: block.timestamp,
    gasFee: block.baseFeePerGas ?? parseUnits("0.1", "gwei"),
    chainId: provider.network.chainId
  };

  await db.recordGasInfo(gasInfo);

  if (block.number % 10 === 0) {
    await db.printStatus();
  }
}

export async function runGasTracker(db: GasDB) {
  for (const provider of GAS_TRACKER_QUEUE.keys()) {
    console.log(
      `[chainId: ${provider.network.chainId}] Listening to blocks on ${provider.network.name} ...`
    );

    provider.on("block", async (blockNr) => {
      const receiveDate = new Date(Date.now());

      const [cachedBlocks, nextBlockToProcess] =
        GAS_TRACKER_QUEUE.get(provider)!;

      if (nextBlockToProcess === undefined) {
        GAS_TRACKER_QUEUE.set(provider, [cachedBlocks, blockNr]);
      }

      const retreivedBlock = await provider.getBlock(blockNr);
      cachedBlocks.set(blockNr, [retreivedBlock, receiveDate]);

      // process as many blocks as possible
      while (true) {
        const blockNrToProcess = GAS_TRACKER_QUEUE.get(provider)![1]!;
        if (!cachedBlocks.has(blockNrToProcess)) {
          // not yet arrived. wait and let the next async call handle it.
          break;
        }
        GAS_TRACKER_QUEUE.set(provider, [cachedBlocks, blockNrToProcess + 1]);

        /* no-await */
        recordBlock(cachedBlocks.get(blockNrToProcess)!, provider, db);
      }
    });
  }
}
