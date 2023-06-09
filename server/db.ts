import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { Database, RunResult } from "sqlite3";
import { promisify } from "util";
import { BridgeRequestStructOutput } from "./pre-built/typechain-types/contracts/BridgeWhenCheap";

const dbFile = "data/gas.db";

// a uint256 can have atmost 78 digits in decimal
const SQL_UINT256_TYPE = "VARCHAR(78)";
const SQL_ADDRESS_TYPE = "VARCHAR(42)";

export type BridgeRequestEntry = BridgeRequestStructOutput & {
  requestId: BigNumber;
};

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

  private activeRequestsTable(chainId: number): string {
    return "bwcActiveRequests" + chainId;
  }

  public async init() {
    console.log("Connecting to database...");

    for (const chainId of this.chainIds) {
      await promisify(this.db.run).call(
        this.db,
        `CREATE TABLE IF NOT EXISTS ${this.gasTable(chainId)} (
          blockNr INT PRIMARY KEY,
          unixSeconds INT,
          gasFee ${SQL_UINT256_TYPE}
        )`
      );

      await promisify(this.db.run).call(
        this.db,
        `CREATE TABLE IF NOT EXISTS ${this.bwcUsersTable(chainId)} (
          user ${SQL_ADDRESS_TYPE} PRIMARY KEY
        )`
      );

      await promisify(this.db.run).call(
        this.db,
        // THIS MUST BE IN SAME ORDER AS IN THE CONTRACT!
        `CREATE TABLE IF NOT EXISTS ${this.activeRequestsTable(chainId)} (
          source ${SQL_ADDRESS_TYPE},
          destination ${SQL_ADDRESS_TYPE},
          isTokenTransfer INT,
          token ${SQL_ADDRESS_TYPE},
          amount ${SQL_UINT256_TYPE},
          amountOutMin ${SQL_UINT256_TYPE},
          wantedL1GasPrice ${SQL_UINT256_TYPE},
          l2execGasFeeDeposit ${SQL_UINT256_TYPE},
          requestId INT,
          PRIMARY KEY (source, requestId)
        )`
        // THIS MUST BE IN SAME ORDER AS IN THE CONTRACT!
        // The requestor x requestId are only sufficient to uniquely determine the request during the current time.
      );

      // todo. don't clear database every time.
      await promisify(this.db.run).call(
        this.db,
        `DELETE FROM ${this.activeRequestsTable(chainId)}`
      );
    }

    await this.printStatus();
  }

  public async printStatus() {
    for (const chainId of this.chainIds) {
      const gasCount: { Count: number }[] = <any>(
        await promisify(this.db.all).call(
          this.db,
          `SELECT COUNT(*) as Count FROM ${this.gasTable(chainId)}`
        )
      );

      const usersCount: { Count: number }[] = <any>(
        await promisify(this.db.all).call(
          this.db,
          `SELECT COUNT(*) as Count FROM ${this.bwcUsersTable(chainId)}`
        )
      );

      const activeRequestsCount: { Count: number }[] = <any>(
        await promisify(this.db.all).call(
          this.db,
          `SELECT COUNT(*) as Count FROM ${this.activeRequestsTable(chainId)}`
        )
      );

      console.log(
        `[chainId: ${chainId}] STATUS: ${
          gasCount[0].Count
        } entries in ${this.gasTable(chainId)}. ${
          usersCount[0].Count
        } users in ${this.bwcUsersTable(chainId)}. ${
          activeRequestsCount[0].Count
        } active requests in ${this.activeRequestsTable(chainId)}`
      );
    }
  }

  public async getActiveRequest(
    requestor: string,
    requestId: BigNumber,
    chainId: number
  ): Promise<BridgeRequestEntry | undefined> {
    console.log(`getActiveRequest(${requestor},${requestId},${chainId})`);
    const result: BridgeRequestEntry[] = <BridgeRequestEntry[]>(
      await promisify((cb) =>
        this.db.all(
          `SELECT * FROM ${this.activeRequestsTable(
            chainId
          )} WHERE source=? AND requestId=?`,
          requestor,
          requestId,
          cb
        )
      )()
    );
    console.log("result:", result);
    return result?.[0];
  }

  public async deleteActiveRequest(
    requestor: string,
    requestId: BigNumber,
    chainId: number
  ): Promise<void> {
    console.log(`deleteActiveRequest(${requestor},${requestId},${chainId})`);
    await promisify((cb) =>
      this.db.run(
        `DELETE FROM ${this.activeRequestsTable(
          chainId
        )} WHERE source=? AND requestId=?`,
        requestor,
        requestId,
        cb
      )
    )();
  }

  public async addActiveRequest(
    request: BridgeRequestStructOutput,
    requestId: BigNumber,
    chainId: number
  ): Promise<void> {
    console.log(`addActiveRequest(${request},${chainId})`);
    await promisify((cb) =>
      this.db.run(
        `INSERT OR REPLACE INTO ${this.activeRequestsTable(
          chainId
        )} VALUES (?,?,?,?,?,?,?,?,?)`,
        request[0],
        request[1],
        request[2],
        request[3],
        request[4],
        request[5],
        request[6],
        request[7],
        requestId,
        cb
      )
    )();
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
