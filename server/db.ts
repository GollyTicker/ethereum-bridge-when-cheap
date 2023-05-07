import { promisify } from "util";
import { Database, RunResult } from "sqlite3";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";

const dbFile = "data/gas.db";

// a uint256 can have atmost 78 digits in decimal
const UINT256_DECIMAL_PLACES = 78;

export interface GasInfo {
  chainId: number;
  blockNr: number;
  unixSeconds: number;
  gasFee: BigNumber;
}

interface GasInfoEntry {
  blockNr: number;
  unixSeconds: number;
  gasFee: string;
}

export class GasDB {
  private db: Database;
  public chainIds: number[];

  constructor(chainIds: number[]) {
    this.db = new Database(dbFile);
    this.chainIds = chainIds;
  }

  private table(chainId: number): string {
    return "gas" + chainId;
  }

  public async init() {
    console.log("Connecting to database...");

    for (const chainId of this.chainIds) {
      await promisify(this.db.run).call(
        this.db,
        `CREATE TABLE IF NOT EXISTS ${this.table(chainId)} (
        blockNr INT PRIMARY KEY,
        unixSeconds INT,
        gasFee VARCHAR(${UINT256_DECIMAL_PLACES})
      )`
      );
    }

    await this.printStatus();
  }

  public async printStatus() {
    for (const chainId of this.chainIds) {
      const result: GasInfoEntry[] = <any>(
        await promisify(this.db.all).call(
          this.db,
          `SELECT * FROM ${this.table(chainId)}`
        )
      );

      console.log(
        `[chainId: ${chainId}] Found ${
          result.length
        } entries in table ${this.table(chainId)}.`
      );
    }
  }

  public async recordGasInfo(gasInfo: GasInfo) {
    const tableName = this.table(gasInfo.chainId);
    await promisify(
      (
        sql: string,
        p1: number,
        p2: number,
        p3: string,
        callback: (this: RunResult, err: Error | null) => void
      ) => this.db.run(sql, p1, p2, p3, callback)
    )(
      `INSERT OR REPLACE INTO ${tableName}(blockNr, unixSeconds, gasFee) VALUES (?, ?, ?)`,
      gasInfo.blockNr,
      gasInfo.unixSeconds,
      formatUnits(gasInfo.gasFee, "wei")
    );
  }
}
