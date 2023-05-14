import { CHAIN_IDS, PREDICTION_RECOMPUTE_EVERY_N_BLOCKS } from "./config";
import { GasInfo } from "./db";

export class GasPredictor {
  private hasSyncedToPresent: Set<number> = new Set();
  private blocksUntilPredictionUpdate: Map<number, number> = new Map(
    CHAIN_IDS.map((id) => [id, 1])
  );

  constructor() {}

  isSynced(chainId: number): boolean {
    return this.hasSyncedToPresent.has(chainId);
  }

  public setChainSynced(chainId: number) {
    this.hasSyncedToPresent.add(chainId);
  }

  public async updatePredictionAfterNewBlock(gasInfo: GasInfo): Promise<void> {
    const { chainId, blockNr } = gasInfo;
    const blockCounterOld = this.blocksUntilPredictionUpdate.get(chainId)!;
    const blockCounterNew = blockCounterOld - 1;

    if (blockCounterNew <= 0) {
      console.log(
        `[chainId ${chainId}] Predicting gas looking back from block ${blockNr}`
      );

      this.blocksUntilPredictionUpdate.set(
        chainId,
        PREDICTION_RECOMPUTE_EVERY_N_BLOCKS.get(chainId)!
      );
    } else {
      this.blocksUntilPredictionUpdate.set(chainId, blockCounterNew);
    }
  }
}
