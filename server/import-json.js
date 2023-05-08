const { parseUnits } = require("ethers/lib/utils");
const fs = require("fs");
const { Database } = require("sqlite3");
const util = require("util");

const jsonFile = "../gas-prediction/data/data.json";

const data = JSON.parse(fs.readFileSync(jsonFile).toString());

console.log(Object.getOwnPropertyNames(data).length);

const dbFile = "data/gas.db";
const db = new Database(dbFile);

let cmd = "";

async function ingest() {
  if (cmd !== "") {
    await util.promisify(db.run).call(db, cmd);
    cmd = "";
  }
}

async function main() {
  let i = 0;

  for (const key of Object.getOwnPropertyNames(data)) {
    const { fee: feeGwei, t } = data[key];
    const feeWei = parseUnits(feeGwei.toString(), "gwei");

    const value = `(${key}, ${t}, ${feeWei})`;

    if (cmd === "") {
      cmd = `INSERT OR REPLACE INTO gas1(blockNr, unixSeconds, gasFee) VALUES ${value}`;
    } else {
      cmd += ", " + value;
    }

    if (i % 1000 === 0) {
      await ingest(cmd);
    }

    i++;
    if (i % 10000 === 0) console.log("Finished", i + 1, "elements...");
  }

  await ingest();

  console.log("Done!");
}

main();
