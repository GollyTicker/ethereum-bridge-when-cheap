import { providers } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { GasDB, GasInfo } from "./db";

export async function recordBlock(
  block: providers.Block,
  provider: providers.JsonRpcProvider,
  db: GasDB
) {
  const gasInfo: GasInfo = {
    blockNr: block.number,
    unixSeconds: block.timestamp,
    gasFee: block.baseFeePerGas ?? parseUnits("0.1", "gwei"),
    chainId: provider.network.chainId
  };

  await db.recordGasInfo(gasInfo);

  if (block.number % 25 === 0) {
    await db.printStatus();
  }
}
