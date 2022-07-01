const { ethers } = require("hardhat");
const { time } = require("@openzeppelin/test-helpers");

// all mining functions return promises and should be awaited

const getBlockAdvancerMethods = (provider) => {
  const advanceBlocktime = (offset) =>
    provider.send("evm_increaseTime", [offset]);

  const advanceBlock = async (offset) => {
    let newTimestamp;
    if (+offset > 0) {
      newTimestamp = (await provider.getBlock()).timestamp + +offset;
    }
    return provider.send("evm_mine", [newTimestamp]);
  };

  const hardhatMine = async (numberOfBlocks, timeInterval) =>
    provider.send("hardhat_mine", [numberOfBlocks, timeInterval]);

  return { advanceBlocktime, advanceBlock, hardhatMine };
};

const advanceNBlocks = (n) =>
  Promise.all([...Array(n)].map((i) => time.advanceBlock()));

const getPackedEncodingNameHash = (str) =>
  ethers.utils.solidityKeccak256(["string"], [str]);

const createRandomAddress = () => ethers.Wallet.createRandom().address;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  getBlockAdvancerMethods,
  getPackedEncodingNameHash,
  createRandomAddress,
  delay,
  advanceNBlocks,
};
