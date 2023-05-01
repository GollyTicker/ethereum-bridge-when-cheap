import { assert } from "console";
import { ethers, providers } from "ethers";
import dotenv from "dotenv";
import { formatUnits } from "ethers/lib/utils";

dotenv.config();

console.log("Starting server...");

const { L1_RPC_URL, L2_RPC_URL, L1, L2 } = process.env;

const providerL1 = new ethers.providers.JsonRpcProvider(L1_RPC_URL, L1);
const providerL2 = new ethers.providers.JsonRpcProvider(L2_RPC_URL, L2);

const queue: Map<
  providers.JsonRpcProvider,
  [Map<number, [providers.Block, Date]>, number | undefined]
> = new Map([
  [providerL1, [new Map(), undefined]],
  [providerL2, [new Map(), undefined]]
]);

function logBlock(
  elt: [providers.Block, Date],
  provider: providers.JsonRpcProvider
) {
  const [block, receiveDate] = elt;
  const formattedGas = formatUnits(block.baseFeePerGas ?? 0.1, "gwei")
    .substring(0, 5)
    .padEnd(5);

  console.log(
    receiveDate.toLocaleTimeString(),
    "block nr",
    block.number,
    formattedGas,
    new Date(block.timestamp * 1000).toLocaleTimeString(),
    provider.network.name
  );
}

for (const provider of queue.keys()) {
  console.log(
    "Listening to blocks on",
    provider.network.name,
    provider.network.chainId,
    "..."
  );

  provider.on("block", async (blockNr) => {
    const receiveDate = new Date(Date.now());

    const [cachedBlocks, nextBlockToProcess] = queue.get(provider)!;

    if (nextBlockToProcess === undefined) {
      queue.set(provider, [cachedBlocks, blockNr]);
    }

    const retreivedBlock = await provider.getBlock(blockNr);
    cachedBlocks.set(blockNr, [retreivedBlock, receiveDate]);

    // process as many blocks as possible
    while (true) {
      const blockNrToProcess = queue.get(provider)![1]!;
      if (!cachedBlocks.has(blockNrToProcess)) {
        // not yet arrived. wait and let the next async call handle it.
        break;
      }
      queue.set(provider, [cachedBlocks, blockNrToProcess + 1]);
      logBlock(cachedBlocks.get(blockNrToProcess)!, provider);
    }
  });
}
