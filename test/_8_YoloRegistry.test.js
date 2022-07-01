const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");

const { getPackedEncodingNameHash } = require("./utils/helpers");
const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toBN } = require("./utils/BNUtils");

const yoloConstants = require("./constants");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

// *** YOLOrekt YoloRegistry Contract Tests ***
const yoloRegistryPresets = yoloConstants.TestPresets.YOLO_REGISTRY;

describe("YOLOrekt YoloRegistry Contract Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let yoloRegistry;
  let stablecoinToken;
  let yoloNFTPack;
  let nftTracker;
  let whitelistClaims;
  let yoloWallet;
  let liquidityPool;
  let gameFactory;
  let gameETH_USD;
  let gameDoge_USD;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    const contracts = getContracts();

    yoloRegistry = contracts.yoloRegistry;
    stablecoinToken = contracts.stablecoinToken;
    yoloNFTPack = contracts.yoloNFTPack;
    nftTracker = contracts.nftTracker;
    whitelistClaims = contracts.whitelistClaims;
    yoloWallet = contracts.yoloWallet;
    liquidityPool = contracts.liquidityPool;
    gameFactory = contracts.gameFactory;
    gameETH_USD = contracts.gameETH_USD;
    gameDoge_USD = contracts.gameDoge_USD;
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("YoloRegistry", () => {
    it("should match correct address as deployed", async () => {
      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          )
        )
      ).to.be.equal(stablecoinToken.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_NFT_PACK
          )
        )
      ).to.be.equal(yoloNFTPack.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_TRACKER
          )
        )
      ).to.be.equal(nftTracker.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_CLAIMS
          )
        )
      ).to.be.equal(whitelistClaims.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_WALLET
          )
        )
      ).to.be.equal(yoloWallet.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          )
        )
      ).to.be.equal(liquidityPool.address);

      expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.GAME_FACTORY
          )
        )
      ).to.be.equal(gameFactory.address);
    });

    it("should match correct contract version", async () => {
      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_NFT_PACK
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_TRACKER
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_CLAIMS
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_WALLET
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.GAME_FACTORY
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion);
    });

    it("should revert if using same address for newer version", async () => {
      await expect(
        yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          ),
          [
            liquidityPool.address,
            yoloRegistryPresets.contractVersion + 1,
            yoloRegistryPresets.contractVersion + 1,
          ]
        )
      ).to.be.revertedWith("reinstating version mismatch");
    });

    it("should remove old registered address from existing registrations", async () => {
      await yoloRegistry.removeContractAddress(
        getPackedEncodingNameHash(
          yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
        )
      );

      await expect(
        await yoloRegistry.getContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          )
        )
      ).to.be.equal(ZERO_ADDRESS);

      await expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          )
        )
      ).to.be.equal(0);
    });

    it("admin should succeed in replacing contract if contract version is higher than before", async () => {
      const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
      liquidityPoolSecond = await LiquidityPool.deploy(yoloRegistry.address);

      await yoloRegistry.setContract(
        getPackedEncodingNameHash(
          yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
        ),
        [
          liquidityPoolSecond.address,
          yoloRegistryPresets.contractVersion + 1,
          yoloRegistryPresets.contractVersion + 1,
        ]
      );

      expect(
        await yoloRegistry.getContractVersion(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          )
        )
      ).to.be.equal(yoloRegistryPresets.contractVersion + 1);
    });

    it("should revert replace contract if contract version is same or lower than before", async () => {
      const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
      liquidityPoolThird = await LiquidityPool.deploy(yoloRegistry.address);

      liquidityPoolFourth = await LiquidityPool.deploy(yoloRegistry.address);

      await yoloRegistry.setContract(
        getPackedEncodingNameHash(
          yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
        ),
        [
          liquidityPoolThird.address,
          yoloRegistryPresets.contractVersion + 1,
          yoloRegistryPresets.contractVersion + 1,
        ]
      );

      await expect(
        yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          ),
          [
            liquidityPoolFourth.address,
            yoloRegistryPresets.contractVersion + 1,
            yoloRegistryPresets.interfaceId,
          ]
        )
      ).to.be.revertedWith("new version val must be 1 g.t.");

      await expect(
        yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          ),
          [
            liquidityPool.address,
            yoloRegistryPresets.contractVersion + 1,
            yoloRegistryPresets.interfaceId,
          ]
        )
      ).to.be.revertedWith("reinstating version mismatch");
    });

    it("should revert if other user is try to set contract", async () => {
      await expect(
        yoloRegistry
          .connect(bob)
          .setContract(
            getPackedEncodingNameHash(
              yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
            ),
            [
              liquidityPool.address,
              yoloRegistryPresets.contractVersion + 1,
              yoloRegistryPresets.interfaceId,
            ]
          )
      ).to.be.revertedWith("Must have admin role to invoke");
    });

    it("should success to approve the game address", async () => {
      expect(
        await yoloRegistry.registeredGames(gameETH_USD.address)
      ).to.be.equal(true);

      expect(
        await yoloRegistry.registeredGames(gameDoge_USD.address)
      ).to.be.equal(true);
    });

    it("should success to remove approval of the game address by admin", async () => {
      await yoloRegistry.setApprovedGame(gameETH_USD.address, false);

      expect(
        await yoloRegistry.registeredGames(gameETH_USD.address)
      ).to.be.equal(false);
    });

    it("should revert if other user try to set approved game", async () => {
      await expect(
        yoloRegistry.connect(bob).setApprovedGame(gameETH_USD.address, false)
      ).to.be.revertedWith("Must have admin role to invoke");
    });

    it("should revert if other user try to set global parameters", async () => {
      await expect(
        yoloRegistry
          .connect(bob)
          .setGlobalParameters(
            ethers.utils.id("FEE_MAX"),
            yoloRegistryPresets.updatingFeeMax
          )
      ).to.be.revertedWith("Must have admin role to invoke");
    });

    it("should succeed to set global parameters by admin", async () => {
      await yoloRegistry.setGlobalParameters(
        ethers.utils.id("FEE_MIN"),
        yoloRegistryPresets.updatedFeeMin
      );

      expect(
        (
          await yoloRegistry.globalParameters(ethers.utils.id("FEE_MIN"))
        ).toString()
      ).to.be.equal(toBN(yoloRegistryPresets.updatedFeeMin).toString());
    });
  });
});
