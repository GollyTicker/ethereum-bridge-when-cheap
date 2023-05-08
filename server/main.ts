import { CHAIN_IDS } from "./config";
import { GasDB } from "./db";
import { runGasTracker } from "./gasTracking";
import { populateAllPastGas } from "./populatePastGas";

async function main() {
  console.log("Starting server...");

  const db = new GasDB(CHAIN_IDS);
  await db.init();

  /* no-await */
  runGasTracker(db, (provider) => populateAllPastGas(db, provider));
}

main();
