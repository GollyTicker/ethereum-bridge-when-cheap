import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { Database, RunResult } from "sqlite3";
import { promisify } from "util";

const dbFile = "data/gas.db";

// a uint256 can have atmost 78 digits in decimal
const UINT256_DECIMAL_PLACES = 78;
const ADDRESS_HEX_LENGTH = 42;

export interface GasInfo {
  chainId: number;
  blockNr: number;
  unixSeconds: number;
  gasFee: BigNumber;
}

export class BwcDB {
  private db: Database;
  public chainIds: number[];

  constructor(chainIds: number[]) {
    this.db = new Database(dbFile);
    this.chainIds = chainIds;
  }

  private gasTable(chainId: number): string {
    return "gas" + chainId;
  }

  private bwcUsersTable(chainId: number): string {
    return "bwcUsers" + chainId;
  }

  public async init() {
    console.log("Connecting to database...");

    for (const chainId of this.chainIds) {
      await promisify(this.db.run).call(
        this.db,
        `CREATE TABLE IF NOT EXISTS ${this.gasTable(chainId)} (
          blockNr INT PRIMARY KEY,
          unixSeconds INT,
          gasFee VARCHAR(${UINT256_DECIMAL_PLACES})
        )`
      );

      await promisify(this.db.run).call(
        this.db,
        `CREATE TABLE IF NOT EXISTS ${this.bwcUsersTable(chainId)} (
          user VARCHAR(${ADDRESS_HEX_LENGTH}) PRIMARY KEY
        )`
      );
    }

    await this.printStatus();
  }

  public async printStatus() {
    for (const chainId of this.chainIds) {
      const result: { Count: number }[] = <any>(
        await promisify(this.db.all).call(
          this.db,
          `SELECT COUNT(*) as Count FROM ${this.gasTable(chainId)}`
        )
      );

      console.log(
        `[chainId: ${chainId}] STATUS: ${
          result[0].Count
        } entries in table ${this.gasTable(chainId)}.`
      );
    }
  }

  public async addBwcUser(userAddr: string, chainId: number) {
    const tableName = this.bwcUsersTable(chainId);
    await promisify(
      (
        sql: string,
        user: string,
        callback: (this: RunResult, err: Error | null) => void
      ) => this.db.run(sql, user, callback)
    )(`INSERT OR REPLACE INTO ${tableName}(user) VALUES (?)`, userAddr);
  }

  public async getLatestRecordedBlockNr(chainId: number): Promise<number> {
    const tableName = this.gasTable(chainId);
    const result = await promisify(this.db.all).call(
      this.db,
      `SELECT MAX(blockNr) as BlockNr FROM ${tableName}`
    );
    return (<{ BlockNr: number }[]>result)[0].BlockNr;
  }

  public async getGasInfo(
    block: number,
    chainId: number
  ): Promise<GasInfo | undefined> {
    const tableName = this.gasTable(chainId);
    const result = await promisify(this.db.all).call(
      this.db,
      `SELECT * from ${tableName} WHERE blockNr=${block}`
    );
    return (<GasInfo[] | undefined>result)?.[0];
  }

  public async recordGasInfo(gasInfo: GasInfo) {
    const tableName = this.gasTable(gasInfo.chainId);
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

  public async computeGasPrediction(
    chainId: number,
    startBlockNr: number,
    endBlockNr: number,
    percentile: number
  ): Promise<number> {
    const result = await promisify(
      (
        sql: string,
        p1: number,
        p2: number,
        p3: number,
        callback: (this: RunResult, err: Error | null) => void
      ) => this.db.all(sql, p1, p2, p3, callback)
    )(
      `WITH gasFeesWindow as (
        SELECT CAST(gasFee AS INTEGER) AS gasFeeInt
        FROM ${this.gasTable(chainId)} WHERE blockNr BETWEEN ? AND ?
        ORDER BY gasFeeInt ASC
      )
      SELECT * FROM gasFeesWindow
      LIMIT 1 OFFSET (
        SELECT FLOOR(COUNT(*) * ?) FROM gasFeesWindow
      )`,
      startBlockNr,
      endBlockNr,
      percentile
    );

    const typedResult = <{ gasFeeInt: number }[]>(<unknown>result);

    return typedResult[0].gasFeeInt;
  }
}
