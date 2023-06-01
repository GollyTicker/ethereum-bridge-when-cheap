import {
  ThrottledProvider,
  chainConfig,
  getBwcContract,
  getProvider
} from "./config";
import {
  BridgeRequestedEvent,
  BridgeRequestedEventObject
} from "./pre-built/typechain-types/contracts/BridgeWhenCheap";
import { BwcDB } from "./db";

export async function runBwcRequestService(db: BwcDB) {
  for (const [chainId, config] of chainConfig.entries()) {
    if (config.bridgeWhenCheapContractAddress) {
      /* no-await */
      (async () => {
        const provider = getProvider(chainId);
        await processAllPastAndAllNewToBwcRequestEvents(
          provider,
          config.bridgeWhenCheapContractAddress!,
          db
        );
      })();
    }
  }
}

async function ensureBwcUserIsKnownInDatabase(
  bridgeRequested: BridgeRequestedEventObject,
  db: BwcDB,
  chainId: number
): Promise<void> {
  return await db.addBwcUser(bridgeRequested.source, chainId);
}

async function processAllPastAndAllNewToBwcRequestEvents(
  provider: ThrottledProvider,
  bwcContractAddr: string,
  db: BwcDB
) {
  const bwc = await getBwcContract(bwcContractAddr, provider);
  // console.log(`[chainId ${provider.network.chainId}] BWC.` , bwc);

  const preFilter = bwc.filters.BridgeRequested;

  const topic = preFilter(
    undefined, // "0x87868fd4347E695d87981aAD388574D54e92Ac71" to filter by source address
    undefined
  );

  // console.log("topic", topic);

  async function forEachEvent(event: BridgeRequestedEvent) {
    const bridgeRequested = event.args;
    console.log(
      "event bwc request",
      bridgeRequested.requestId,
      bridgeRequested.request
    );
    await ensureBwcUserIsKnownInDatabase(
      bridgeRequested,
      db,
      provider.network.chainId
    );
    await updateSetOfPendingRequests(
      bridgeRequested,
      db,
      provider.network.chainId
    );
  }

  // We want to first start listening to the topic AND THEN get the past events to not miss out
  // and new events when we're processing the past.

  bwc.on(topic, forEachEvent);

  (await bwc.queryFilter(topic)).forEach(<any>forEachEvent);
}

function updateSetOfPendingRequests(
  bridgeRequested: BridgeRequestedEventObject,
  db: BwcDB,
  chainId: number
): Promise<void> {
  console.log("todo");
  // throw new Error("Function not implemented.");
  return Promise.resolve(undefined);
}
