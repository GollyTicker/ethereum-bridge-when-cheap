import throttle from "@jcoreio/async-throttle";
import dotenv from "dotenv";
import { ethers, providers } from "ethers";

// environment variables
dotenv.config();
const {
  L1_RPC_URL,
  L2_RPC_URL,
  L1,
  L2,
  L1_START_BLOCK,
  L2_START_BLOCK,
  GET_BLOCK_THROTTLED_MS
} = process.env;

// provider throttling
export type ThrottledProvider = providers.JsonRpcProvider & {
  getBlockThrottled: providers.JsonRpcProvider["getBlock"];
};

function enrichProviderWithThrottling(
  p: providers.JsonRpcProvider
): ThrottledProvider {
  const pNew = <ThrottledProvider>p;
  pNew.getBlockThrottled = throttle(
    pNew.getBlock.bind(pNew),
    parseInt(GET_BLOCK_THROTTLED_MS!)
  );
  return pNew;
}

// providers and queue
export const providerL1 = new ethers.providers.JsonRpcProvider(L1_RPC_URL, L1);
export const providerL2 = new ethers.providers.JsonRpcProvider(L2_RPC_URL, L2);

export const GAS_TRACKER_QUEUE: Map<
  ThrottledProvider,
  [Map<number, [providers.Block, Date]>, number | undefined]
> = new Map([
  [enrichProviderWithThrottling(providerL1), [new Map(), undefined]],
  [enrichProviderWithThrottling(providerL2), [new Map(), undefined]]
]);

export const GAS_START_BLOCK: Map<number, number> = new Map([
  [providerL1.network.chainId, parseInt(L1_START_BLOCK!)],
  [providerL2.network.chainId, parseInt(L2_START_BLOCK!)]
]);

export const CHAIN_IDS = Array.from(GAS_TRACKER_QUEUE.keys()).map(
  (p) => p.network.chainId
);
