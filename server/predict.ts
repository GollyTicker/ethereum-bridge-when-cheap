import { CHAIN_IDS, chainConfig } from "./config";
import { GasDB, GasInfo } from "./db";

export class GasPredictor {
  private hasSyncedToPresent: Set<number> = new Set();
  private blocksUntilPredictionUpdate: Map<number, number> = new Map(
    CHAIN_IDS.map((id) => [id, 1])
  );

  constructor(private db: GasDB) {}

  isSynced(chainId: number): boolean {
    return this.hasSyncedToPresent.has(chainId);
  }

  public setChainSynced(chainId: number) {
    this.hasSyncedToPresent.add(chainId);
  }

  public async updatePredictionAfterNewBlock(gasInfo: GasInfo): Promise<void> {
    const { chainId, blockNr } = gasInfo;
    const config = chainConfig.get(chainId)!;
    const blockCounterOld = this.blocksUntilPredictionUpdate.get(chainId)!;
    const blockCounterNew = blockCounterOld - 1;

    if (blockCounterNew <= 0) {
      const startBlockNr = blockNr - config.prediction.lookbackBlocks;

      const predictedGas: number = await this.db.computeGasPrediction(
        gasInfo.chainId,
        startBlockNr,
        blockNr,
        config.prediction.percentile
      );

      console.log(
        `[chainId ${chainId}] Predicted gas: ${predictedGas} from start = ${startBlockNr} and end = ${blockNr}`
      );

      this.blocksUntilPredictionUpdate.set(
        chainId,
        config.prediction.recomputeEveryNBlocks
      );
    } else {
      this.blocksUntilPredictionUpdate.set(chainId, blockCounterNew);
    }
  }
}
