const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");

const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toBN, totalTokenSupply } = require("./utils/BNUtils");

const yoloConstants = require("./constants");

// *** YOLOrekt Tokens Unit Test ***

// Preset Values
const yoloSharePresets = yoloConstants.TestPresets.YOLO_SHARES;
const yoloNftPresets = yoloConstants.TestPresets.YOLO_NFT;
const { InterfaceIds } = yoloConstants.Globals;

describe("YOLOrekt Tokens Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let stablecoinToken;
  let yoloNFT;
  let liquidityPool;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    const contracts = getContracts();

    stablecoinToken = contracts.stablecoinToken;
    yoloNFT = contracts.yoloNFT;
    liquidityPool = contracts.liquidityPool;
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("YoloShareToken", () => {
    it("supports correct interfaces", async () => {
      expect(await liquidityPool.supportsInterface(InterfaceIds.IERC20)).to.be
        .true;

      expect(await liquidityPool.supportsInterface(InterfaceIds.IERC165)).to.be
        .true;
    });

    it("reverts wrong interfaces", async () => {
      expect(await liquidityPool.supportsInterface(InterfaceIds.RANDOM)).to.be
        .false;
    });

    it("should have correct name", async () => {
      expect(await liquidityPool.name()).to.be.equal(
        yoloConstants.STConfig.name
      );
    });

    it("should have correct symbol", async () => {
      expect(await liquidityPool.symbol()).to.be.equal(
        yoloConstants.STConfig.symbol
      );
    });

    it("should be pausable by admin", async () => {
      await liquidityPool.pause();
      expect(await liquidityPool.paused()).to.be.equal(true);
    });

    it("should revert if other user try pause", async () => {
      await expect(liquidityPool.connect(bob).pause()).to.be.revertedWith(
        "ERC20PresetMinterPauser: must have pauser role to pause"
      );
    });

    it("should be unpausable by admin", async () => {
      await liquidityPool.pause();
      await liquidityPool.unpause();

      expect(await liquidityPool.paused()).to.be.equal(false);
    });

    it("should revert if other user try unpause", async () => {
      await expect(liquidityPool.connect(bob).unpause()).to.be.revertedWith(
        "ERC20PresetMinterPauser: must have pauser role to unpause"
      );
    });
  });
});
