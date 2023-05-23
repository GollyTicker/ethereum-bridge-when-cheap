import throttledQueue from "throttled-queue";
import { runBwcRequestService } from "./bwcRequestService";
import { CHAIN_IDS } from "./config";
import { GasDB } from "./db";
import { runGasTracker } from "./gasTracking";
import { populateAllPastGas } from "./populatePastGas";
import { GasPredictor } from "./predict";
import { processInOrder } from "./processInOrder";

const predictionUpdateThrottling = throttledQueue(100, 1000); // 100x per second = 1000ms

async function main() {
  console.log("Starting server...");

  const db = new GasDB(CHAIN_IDS);
  await db.init();

  const gasPredictor = new GasPredictor(db);

  /* no-await */
  runGasTracker(
    db,
    (provider) =>
      populateAllPastGas(
        db,
        provider,
        gasPredictor.setChainSynced.bind(gasPredictor)
      ),
    processInOrder((g) =>
      predictionUpdateThrottling(() =>
        gasPredictor.updatePredictionAfterNewBlock(g)
      )
    )
  );

  /* no-await */
  runBwcRequestService(db);
}

main();
