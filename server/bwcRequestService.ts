import { BigNumber } from "ethers";
import * as lodash from "lodash";
import {
  ThrottledProvider,
  chainConfig,
  getBwcContract,
  getProvider
} from "./config";
import { BwcDB } from "./db";
import {
  BridgeExecutionSubmittedEvent,
  BridgeRequestStruct,
  BridgeRequestWithdrawnEvent,
  BridgeRequestedEvent,
  BridgeRequestedEventObject
} from "./pre-built/typechain-types/contracts/BridgeWhenCheap";

type BwcEvent =
  | BridgeRequestedEvent
  | BridgeExecutionSubmittedEvent
  | BridgeRequestWithdrawnEvent;

type BwcEventObject = BwcEvent["args"];

const bwcEventTypes = [
  "BridgeRequested",
  "BridgeExecutionSubmitted",
  "BridgeRequestWithdrawn"
] as const;

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

  const preFilters = bwcEventTypes.map((s) => bwc.filters[s]);

  const topics = preFilters.map((f) => f(undefined, undefined));
  /* preFilters[0](
    undefined, // "0x87868fd4347E695d87981aAD388574D54e92Ac71" to filter by source address
    undefined
  );
  */

  async function forEachEvent(event: BwcEvent) {
    const bwcEvent = event.args;
    console.log("event", event.event, bwcEvent.requestId, bwcEvent.request);

    const eventType: (typeof bwcEventTypes)[number] | undefined = <any>(
      event.event
    );

    switch (eventType) {
      case "BridgeRequested":
        const narrowEvent: BridgeRequestedEventObject = bwcEvent;
        await ensureBwcUserIsKnownInDatabase(
          narrowEvent,
          db,
          provider.network.chainId
        );
        break;
      case "BridgeExecutionSubmitted":
        break;
      case "BridgeRequestWithdrawn":
        break;
      default:
        throw new Error("Event not recognized!");
    }

    await updateSetOfPendingRequests(bwcEvent, db, provider.network.chainId);
  }

  // We need to make sure, that we process all of these events in proper order.
  let queue: BwcEvent[] = [];

  let processingOfPastEventsFinished = false;

  async function processQueueEvents() {
    while (queue.length >= 1) {
      const event = queue[0];
      queue.splice(0, 1);
      console.log(`Processing first queue element of ${queue.length}`);
      await forEachEvent(event);
    }
  }

  // We want to first start listening to the topic AND THEN get the past events to not miss out
  // and new events when we're processing the past.
  for (const topic of topics) {
    // todo. how do we ensure, that the events in the same block are provided and processed in the correct order?
    bwc.on(
      topic,
      (
        _1: string,
        _2: BigNumber,
        _3: BridgeRequestStruct,
        event: BridgeRequestedEvent
      ) => {
        queue.push(event);
        if (processingOfPastEventsFinished) {
          processQueueEvents();
        }
      }
    );
  }

  const pastEvents = (
    await Promise.all(topics.map(async (t) => await bwc.queryFilter(t)))
  ).flat();

  // todo. test this. we want to sort all events in the order in which they appeard in the while blockchain.
  const sortedPastEvents = lodash.sortBy(pastEvents, <(keyof BwcEvent)[]>[
    "blockNumber",
    "transactionIndex"
  ]);

  queue = sortedPastEvents.concat(queue);

  await processQueueEvents();
  processingOfPastEventsFinished = true;
}

function updateSetOfPendingRequests(
  bwcEventObject: BwcEventObject,
  db: BwcDB,
  chainId: number
): Promise<void> {
  console.log("todo");
  // throw new Error("Function not implemented.");
  return Promise.resolve(undefined);
}
