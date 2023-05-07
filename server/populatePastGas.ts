import { GAS_START_BLOCK } from "./config";
import { GasDB } from "./db";

export async function populateAllGasSinceGasStartingPoint(
  db: GasDB,
  chainId: number
) {
  const startBlock = GAS_START_BLOCK.get(chainId)!;

  // todo. migrate download.py functionality
  // todo. migrate collected database entries into this new databse

  console.log(
    `[chainId: ${chainId}] Populate past gas info starting from block ${startBlock}`
  );
}
