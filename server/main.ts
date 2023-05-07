import { CHAIN_IDS } from "./config";
import { GasDB } from "./db";
import { runGasTracker } from "./gasTracking";
import { populateAllGasSinceGasStartingPoint } from "./populatePastGas";

async function main() {
  console.log("Starting server...");

  const db = new GasDB(CHAIN_IDS);
  await db.init();

  for (const chainId of CHAIN_IDS) {
    /* no-await */
    populateAllGasSinceGasStartingPoint(db, chainId);
  }

  /* no-await */
  runGasTracker(db);
}

main();
