const { BN } = require("@openzeppelin/test-helpers");

const DECIMALS = 18;

const bnZero = new BN("0", 10);
const bnOne = new BN("1", 10);
const bnTwo = new BN("2", 10);

const toBN = (amount, magnitude = 0) => {
  const mag = new BN(10).pow(new BN(magnitude));
  return new BN(amount).mul(mag);
};

const toTokenAmount = (amount) => {
  return toBN(amount, DECIMALS);
};

const toTokenString = (amount) => {
  return toTokenAmount(amount).toString();
};

const toUSDCAmount = (amount) => {
  return toBN(amount, 6);
};

const supplyInteger = toBN(1, 9); // 1 Billion
const totalTokenSupply = toTokenAmount(supplyInteger);

exports.bnZero = bnZero;
exports.bnOne = bnOne;
exports.bnTwo = bnTwo;

exports.toBN = toBN;
exports.toTokenAmount = toTokenAmount;
exports.toTokenString = toTokenString;
exports.totalTokenSupply = totalTokenSupply;
exports.toUSDCAmount = toUSDCAmount;
