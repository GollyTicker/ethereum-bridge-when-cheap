import { ethers } from "ethers";
import {
  ThrottledProvider,
  chainConfig,
  getBwcContract,
  getProvider
} from "./config";
import { GasDB } from "./db";

export async function runBwcRequestService(db: GasDB) {
  for (const [chainId, config] of chainConfig.entries()) {
    if (config.bridgeWhenCheapContractAddress) {
      /* no-await */
      (async () => {
        const provider = getProvider(chainId);
        await processAllPastAndAllNewToBwcRequestEvents(
          provider,
          config.bridgeWhenCheapContractAddress!
        );
      })();
    }
  }
}

async function processAllPastAndAllNewToBwcRequestEvents(
  provider: ThrottledProvider,
  bwcContractAddr: string
) {
  const bwc = await getBwcContract(bwcContractAddr, provider);
  console.log(`[chainId ${provider.network.chainId}] BWC.` /* , bwc */);

  const preFilter = bwc.filters.BridgeRequested;

  console.log("prefilter", preFilter);

  const topic = preFilter(
    undefined, // "0x87868fd4347E695d87981aAD388574D54e92Ac71" to filter by source address
    undefined
  );

  console.log("topic", topic);

  function process(event: ethers.Event) {
    const eventArgs: any = event.args;
    console.log("event bwc request", eventArgs.requestId, eventArgs.request);
  }

  (await bwc.queryFilter(topic)).forEach(process);
  // todo. what to do, if new events appear while this array is being processed?

  bwc.on(topic, process);
}
