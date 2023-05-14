import { CHAIN_IDS } from "./config";
import { GasDB } from "./db";
import { runGasTracker } from "./gasTracking";
import { populateAllPastGas } from "./populatePastGas";
import { GasPredictor } from "./predict";
import { processInOrder } from "./processInOrder";

async function main() {
  console.log("Starting server...");

  const db = new GasDB(CHAIN_IDS);
  await db.init();

  const gasPredictor = new GasPredictor();

  /* no-await */
  runGasTracker(
    db,
    (provider) =>
      populateAllPastGas(
        db,
        provider,
        gasPredictor.setChainSynced.bind(gasPredictor)
      ),
    processInOrder(
      gasPredictor.updatePredictionAfterNewBlock.bind(gasPredictor)
    )
  );
}

main();
