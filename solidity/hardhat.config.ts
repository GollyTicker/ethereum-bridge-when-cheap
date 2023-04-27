import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    // unforunately, the z3 isn't detected by the hardhat solc compiler... however, running solc manually does make it work!
  },
  paths: {
    tests: "tests"
  },
};

export default config;
