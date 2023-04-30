import { expect } from "chai";
import { BigNumber, ContractTransaction, constants } from "ethers";
import { ethers } from "hardhat";
import { BridgeWhenCheap } from "../typechain-types";
import { BridgeRequestStructOutput } from "../typechain-types/contracts/BridgeWhenCheap.sol/BridgeWhenCheap";

export const l2GasfeeDeposit = 3;
export const serviceFee = 10;
export const heldFeePerRequest = serviceFee - l2GasfeeDeposit;
export const nAccountsIncludingOwner = 4;
export const initialAccountTokenBalance = 1000;
export const initialAllowance = 3000;
export const chainId = 123;
export const addressZero = constants.AddressZero;
export const nativeEther = addressZero;

export async function fixture(addTokensSupport: boolean, addTokenApprovals: boolean) {
  const accountsAndOwner = await ethers.getSigners();
  const accounts = accountsAndOwner.slice(1, nAccountsIncludingOwner) // i = 1,2,3 = 3 test accounts
  
  const fakeL2AmmWrapper = await (await ethers.getContractFactory("Fake_L2_AmmWrapper")).deploy();
  const bwc = await (await ethers.getContractFactory("BridgeWhenCheap")).deploy(l2GasfeeDeposit, serviceFee, chainId);
  const token = await (await ethers.getContractFactory("TestToken")).deploy();

  if (addTokensSupport) {
    await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
    await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);
  }

  for (const acc of accounts) {
    await token.connect(acc).mint(initialAccountTokenBalance);
    addTokenApprovals && await token.connect(acc).approve(bwc.address, initialAllowance);
  }

  const initialNativeBalance = await accounts[0].getBalance();

  return { bwc: bwc, owner: accountsAndOwner[0], accounts, initialNativeBalance, token, fakeL2AmmWrapper };
}


export interface BridgeRequest {
  source: string;
  destination: string;
  isTokenTransfer: boolean;
  token: string;
  amount: BigNumber;
  amountOutMin: BigNumber;
  wantedL1GasPrice: BigNumber;
  l2execGasFeeDeposit: BigNumber;
};

// transform simple object types to the output type from hardhat JS framework.
export function toStructOutput(simpleObject: BridgeRequest): BridgeRequestStructOutput {
  const keys = ["source", "destination", "isTokenTransfer", "token", "amount", "amountOutMin", "wantedL1GasPrice", "l2execGasFeeDeposit" ];
  const array: any = keys.map(k => (simpleObject as any)[k]);
  return Object.assign(array, simpleObject);
}

export async function GetEventByName<T>(name: string, tx: ContractTransaction, sourceContract?: string): Promise<T> {
  const filteredEvents = (await tx.wait()).events?.filter((x) => {
    return x.event !== undefined ? x.event === name : x.address === sourceContract
  });
  return filteredEvents?.[0].args as T;
}


export function isEmpty(request: BridgeRequest): boolean {
  return request.source === addressZero &&
    request.destination === addressZero &&
    request.amount.eq(0) &&
    request.wantedL1GasPrice.eq(0)
}

export async function allRequestsEmpty(bwc: BridgeWhenCheap, accounts: { address: string }[]) {
  for (const acc of accounts) {
    for (let i = 0; i < 3; i++) {
      const request: BridgeRequest = await bwc.pendingRequests(acc.address, i);
      expect(isEmpty(request)).to.be.true
    }
  }
}

export async function totalPaidGasFeesOfTx(tx: ContractTransaction): Promise<BigNumber> {
  const receipt = ethers.provider.getTransactionReceipt(tx.hash);
  return (await receipt).gasUsed.mul((await receipt).effectiveGasPrice);
}