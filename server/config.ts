import dotenv from "dotenv";
import { ethers, providers } from "ethers";
import queueThrottled from "throttled-queue";

// environment variables
dotenv.config();
const {
  L1_RPC_URL,
  L2_RPC_URL,
  L1,
  L2,
  L1_START_BLOCK,
  L2_START_BLOCK,
  L1_PREDICTION_RECOMPUTE_EVERY_N_BLOCKS,
  L2_PREDICTION_RECOMPUTE_EVERY_N_BLOCKS,
  GET_BLOCK_MAX_REQUESTS_PER_SECOND,
  L1_PREDICTION_NUMBER_OF_LOOKBACK_BLOCKS,
  L2_PREDICTION_NUMBER_OF_LOOKBACK_BLOCKS,
  L1_PREDICTION_PERCENTILE,
  L2_PREDICTION_PERCENTILE,
  L1_RECORD_EVERY_NTH_BLOCK,
  L2_RECORD_EVERY_NTH_BLOCK
} = process.env;

// provider throttling
export type ThrottledProvider = providers.JsonRpcProvider & {
  getBlockThrottled: providers.JsonRpcProvider["getBlock"];
};

function enrichProviderWithThrottling(
  p: providers.JsonRpcProvider
): ThrottledProvider {
  const throttle = queueThrottled(
    parseInt(GET_BLOCK_MAX_REQUESTS_PER_SECOND!),
    1000
  );
  const pNew = <ThrottledProvider>p;
  pNew.getBlockThrottled = (b: Parameters<providers.Provider["getBlock"]>[0]) =>
    throttle(() => pNew.getBlock(b));
  return pNew;
}

// providers and queue
const providerL1 = new ethers.providers.JsonRpcProvider(L1_RPC_URL, L1);
const providerL2 = new ethers.providers.JsonRpcProvider(L2_RPC_URL, L2);

export const GAS_TRACKER_QUEUE: Map<
  ThrottledProvider,
  [Map<number, [providers.Block, Date]>, number | undefined]
> = new Map([
  [enrichProviderWithThrottling(providerL1), [new Map(), undefined]],
  [enrichProviderWithThrottling(providerL2), [new Map(), undefined]]
]);

export function getProvider(chainId: number): ThrottledProvider {
  return Array.from(GAS_TRACKER_QUEUE.keys()).filter(
    (p) => p.network.chainId === chainId
  )[0];
}

export interface ChainConfig {
  startBlock: number;
  recordEveryNthBlock: number;
  prediction: {
    recomputeEveryNBlocks: number;
    lookbackBlocks: number;
    percentile: number;
  };
}

export const chainConfig: Map<number, ChainConfig> = new Map([
  [
    providerL1.network.chainId,
    {
      startBlock: parseInt(L1_START_BLOCK!),
      recordEveryNthBlock: parseInt(L1_RECORD_EVERY_NTH_BLOCK!),
      prediction: {
        recomputeEveryNBlocks: parseInt(
          L1_PREDICTION_RECOMPUTE_EVERY_N_BLOCKS!
        ),
        lookbackBlocks: parseInt(L1_PREDICTION_NUMBER_OF_LOOKBACK_BLOCKS!),
        percentile: parseFloat(L1_PREDICTION_PERCENTILE!)
      }
    }
  ],
  [
    providerL2.network.chainId,
    {
      startBlock: parseInt(L2_START_BLOCK!),
      recordEveryNthBlock: parseInt(L2_RECORD_EVERY_NTH_BLOCK!),
      prediction: {
        recomputeEveryNBlocks: parseInt(
          L2_PREDICTION_RECOMPUTE_EVERY_N_BLOCKS!
        ),
        lookbackBlocks: parseInt(L2_PREDICTION_NUMBER_OF_LOOKBACK_BLOCKS!),
        percentile: parseFloat(L2_PREDICTION_PERCENTILE!)
      }
    }
  ]
]);

export const CHAIN_IDS = Array.from(GAS_TRACKER_QUEUE.keys()).map(
  (p) => p.network.chainId
);
