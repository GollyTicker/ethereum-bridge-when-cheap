import { expect } from "chai";
import { BigNumber, ContractTransaction, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { BridgeWhenCheap, Fake_L2_AmmWrapper, OwnerWithdrawAdversary, TestToken } from "../typechain-types";
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
  const adversary = await (await ethers.getContractFactory("Adversary")).deploy(bwc.address);

  // impersoante zero address
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addressZero]
  });
  const addressZeroSigner = await ethers.getSigner(addressZero);
  // populate zero address with some initial ether from the owner
  await accountsAndOwner[0].sendTransaction({value: parseUnits("1","ether"), to: addressZero});

  if (addTokensSupport) {
    await bwc.addSupportForNewToken(nativeEther, fakeL2AmmWrapper.address);
    await bwc.addSupportForNewToken(token.address, fakeL2AmmWrapper.address);
  }

  for (const acc of accounts) {
    await token.connect(acc).mint(initialAccountTokenBalance);
    addTokenApprovals && await token.connect(acc).approve(bwc.address, initialAllowance);
  }

  const initialNativeBalance = await accounts[0].getBalance();

  return { bwc, owner: accountsAndOwner[0], accounts, initialNativeBalance, token, fakeL2AmmWrapper, addressZeroSigner, adversary};
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

export const fixtureBarebone = () => fixture(false, false)
export const fixturePreconfigured = () => fixture(true, true)

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

export async function withReentrancy(
  contract: TestToken | Fake_L2_AmmWrapper | OwnerWithdrawAdversary,
  reFunc: "none" | "deposit" | "withdraw" | "executeRequest" | "ownerWithdraw",
  bwc: BridgeWhenCheap,
  func: () => Promise<ContractTransaction>
) {
  const enumNumber = ["none", "deposit", "withdraw", "executeRequest", "ownerWithdraw"].indexOf(reFunc);
  await contract.setReentrancy(enumNumber, bwc.address);
  await expect(func()).to.be.revertedWith(/ReentrancyGuard: reentrant call/);
  await contract.setReentrancy(0 /* none */, bwc.address);
}