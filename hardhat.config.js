require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");

const { config: dotenvConfig } = require("dotenv");
dotenvConfig({ path: "./.env" });

// uncomment reporter to get gas usage ranges while running tests
// require("hardhat-gas-reporter");

// use with future typechain testing
// import '@typechain/hardhat'
// import '@nomiclabs/hardhat-ethers'
// import '@nomiclabs/hardhat-waffle'

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    development: {
      url: "http://localhost:8545",
      gas: "auto",
    },
    hardhat: {
      hardfork: "london",
      blockGasLimit: 30000000,
      forking: {
        enabled: process.env.IS_FORK === "true" ? true : false,
        url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 29246555,
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
    // add custom optimizer runs
    overrides: {
      "contracts/game/GameFactoryWithNFTPack.sol": {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2500,
          },
        },
      },
      "contracts/core/YoloWallet.sol": {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
    },
  },
  mocha: {
    timeout: 100000,
  },
};
