import { ThrottledProvider, chainConfig } from "./config";
import { GasDB } from "./db";
import { recordBlock } from "./recordBlock";

export async function populateAllPastGas(
  db: GasDB,
  provider: ThrottledProvider,
  afterGasPopulated: (chainId: number) => void
) {
  const { chainId, startBlock, latestBlock } = await setup(provider, db);

  for (let blockNr = latestBlock; blockNr >= startBlock; blockNr--) {
    const missingInDb =
      (await db.getGasInfo(startBlock, chainId)) === undefined;
    if (missingInDb) {
      const block = await provider.getBlockThrottled(blockNr);
      await recordBlock(block, provider, db);
    }
  }

  console.log(
    `[chainId: ${chainId}] =============== Finished populating all past! ===============`
  );

  afterGasPopulated(chainId);
}

async function setup(provider: ThrottledProvider, db: GasDB) {
  const chainId = provider.network.chainId;
  const startBlock = chainConfig.get(chainId)!.startBlock;
  const latestBlock = await db.getLatestRecordedBlockNr(chainId);

  console.log(
    `[chainId: ${chainId}] Populate past gas info between block ${startBlock} and ${latestBlock} starting back from latest.`
  );

  if (latestBlock < startBlock) {
    console.error(
      "Invalid preconditon. Latest block is older than starting block."
    );
    process.exit(1);
  }

  return { chainId, startBlock, latestBlock };
}
