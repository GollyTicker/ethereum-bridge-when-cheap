import { GAS_TRACKER_QUEUE, ThrottledProvider } from "./config";
import { GasDB } from "./db";
import { recordBlock } from "./recordBlock";

export async function runGasTracker(
  db: GasDB,
  onFirstBlockReceived: (provider: ThrottledProvider) => any
) {
  for (const provider of GAS_TRACKER_QUEUE.keys()) {
    console.log(
      `[chainId: ${provider.network.chainId}] Listening to blocks on ${provider.network.name} ...`
    );
    let isFirstBlock = true;

    provider.on("block", async (blockNr) => {
      isFirstBlock && onFirstBlockReceived(provider);
      isFirstBlock = false;

      const receiveDate = new Date(Date.now());

      // ensure blocks are processed in order.
      const [cachedBlocks, nextBlockToProcess] =
        GAS_TRACKER_QUEUE.get(provider)!;

      if (nextBlockToProcess === undefined) {
        GAS_TRACKER_QUEUE.set(provider, [cachedBlocks, blockNr]);
      }

      const retreivedBlock = await provider.getBlockThrottled(blockNr);
      cachedBlocks.set(blockNr, [retreivedBlock, receiveDate]);

      // process as many blocks as possible
      while (true) {
        const blockNrToProcess = GAS_TRACKER_QUEUE.get(provider)![1]!;
        if (!cachedBlocks.has(blockNrToProcess)) {
          // not yet arrived. wait and let the next async call handle it.
          break;
        }
        GAS_TRACKER_QUEUE.set(provider, [cachedBlocks, blockNrToProcess + 1]);

        const [block, _receiveDate] = cachedBlocks.get(blockNrToProcess)!;
        /* no-await */
        recordBlock(block, provider, db);
      }
    });
  }
}
