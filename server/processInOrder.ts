import { CHAIN_IDS } from "./config";
import { GasInfo } from "./db";

// Calls fn(blockNr) in ascending order
export function processInOrder(
  processElement: (g: GasInfo) => Promise<void>
): (g: GasInfo, firstReceivedBlock: number) => Promise<void> {
  const queues: Map<number, GasInfo[]> = new Map(CHAIN_IDS.map((x) => [x, []]));
  const lastProcessedBlockByChain: Map<number, number> = new Map(
    CHAIN_IDS.map((x) => [x, 0])
  );

  return async (g: GasInfo, firstReceivedBlock: number) => {
    let queue = queues.get(g.chainId)!;

    if (lastProcessedBlockByChain.get(g.chainId) === 0) {
      lastProcessedBlockByChain.set(g.chainId, firstReceivedBlock - 1);
    }

    queue.push(g);

    queue.sort((a, b) => a.blockNr - b.blockNr);

    // process all blocks we have in sequence.
    while (
      queue.length >= 1 &&
      queue[0].blockNr - 1 === lastProcessedBlockByChain.get(g.chainId)! // first block in queue is the next one to be processed.
    ) {
      const currBlock = queue[0];
      await processElement(currBlock);
      lastProcessedBlockByChain.set(g.chainId, currBlock.blockNr);
      queue = queue.slice(1);
    }

    queues.set(g.chainId, queue);
  };
}
