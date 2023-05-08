import { providers } from "ethers";
import { GAS_START_BLOCK } from "./config";
import { GasDB } from "./db";
import { recordBlock } from "./recordBlock";

export async function populateAllPastGas(
  db: GasDB,
  provider: providers.JsonRpcProvider
) {
  const { chainId, startBlock, latestBlock } = await setup(provider, db);

  for (let blockNr = latestBlock; blockNr >= startBlock; blockNr--) {
    const missingInDb =
      (await db.getGasInfo(startBlock, chainId)) === undefined;
    if (missingInDb) {
      const block = await provider.getBlock(blockNr);
      await recordBlock(block, provider, db);
    }
  }

  console.log(
    `[chainId: ${chainId}] =============== Finished populating all past. ===============`
  );
}

async function setup(provider: providers.JsonRpcProvider, db: GasDB) {
  const chainId = provider.network.chainId;
  const startBlock = GAS_START_BLOCK.get(chainId)!;
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
