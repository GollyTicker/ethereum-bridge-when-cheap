import { GAS_TRACKER_QUEUE, ThrottledProvider } from "./config";
import { GasDB, GasInfo } from "./db";
import { recordBlock } from "./recordBlock";

export async function runGasTracker(
  db: GasDB,
  onFirstBlockReceived: (provider: ThrottledProvider) => Promise<void>,
  afterNewUnorderedBlockRecorded: (
    gasInfo: GasInfo,
    firstReceivedBlock: number
  ) => Promise<void>
) {
  for (const provider of GAS_TRACKER_QUEUE.keys()) {
    console.log(
      `[chainId: ${provider.network.chainId}] Listening to blocks on ${provider.network.name} ...`
    );
    let firstBlock: number | undefined;

    provider.on("block", async (blockNr) => {
      if (firstBlock === undefined) {
        firstBlock = blockNr;
        onFirstBlockReceived(provider);
      }

      const retreivedBlock = await provider.getBlockThrottled(blockNr);

      /* no-await */
      recordBlock(retreivedBlock, provider, db).then((g: GasInfo) =>
        afterNewUnorderedBlockRecorded(g, firstBlock!)
      );
    });
  }
}
