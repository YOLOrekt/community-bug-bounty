const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");
const { deployContracts, getContracts } = require("./utils/deployUtils");

const yoloConstants = require("./constants");

const { getPackedEncodingNameHash } = require("./utils/helpers");

function isObject(val) {
  if (val === null) {
    return false;
  }

  return typeof val === "object";
}

const {
  Math: { ZERO_ADDRESS },
} = yoloConstants;

// *** YOLOrekt Contract Deployment Tests ***

describe("Yolorekt contract Deployment ", () => {
  //  *** Addresses ***
  let admin, alice, bob;
  describe("YOLOrekt Contract Deployment Test", () => {
    //  *** Contracts ***
    async function fixture() {
      const accounts = await ethers.getSigners();
      (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

      await deployContracts(admin);

      const contracts = getContracts();

      expect(isObject(contracts.yoloRegistry)).to.be.true;
      expect(isObject(contracts.stablecoinToken)).to.be.true;
      expect(isObject(contracts.nftTracker)).to.be.true;
      expect(isObject(contracts.whitelistClaims)).to.be.true;
      expect(isObject(contracts.yoloWallet)).to.be.true;
      expect(isObject(contracts.liquidityPool)).to.be.true;
      expect(isObject(contracts.gameFactory)).to.be.true;
      expect(isObject(contracts.gameFactoryWithNFTPack)).to.be.true;
      expect(isObject(contracts.gameETH_USD)).to.be.true;
      expect(isObject(contracts.gameDoge_USD)).to.be.true;
      expect(isObject(contracts.gameETH_USD_W_NFT_Pack)).to.be.true;
      // expect(isObject(contracts.gameTSLA_USD)).to.be.true;

      expect(isObject(contracts.gameETH_USD_W_NFT_Pack)).to.be.true;
      expect(isObject(contracts.yoloNFTPack)).to.be.true;

      expect(isObject(contracts.biddersRewardsFactory)).to.be.true;
    }

    beforeEach(async function () {
      await loadFixture(fixture);
    });

    it("should succeed deploying Contract", () => {});
  });

  describe("YOLOrekt Contract Deployment Test failures with fixture", () => {
    async function fixture() {
      const accounts = await ethers.getSigners();
      (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

      await deployContracts(admin);
    }

    const roundIndex = 0;
    const maxStartDelay = 0;

    let GameInstanceWithNFTPack;
    let accounts;
    let contracts;
    let game1PairWNFTPack, game1LengthWNFTPack;

    beforeEach(async function () {
      accounts = await ethers.getSigners();
      (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

      await loadFixture(fixture);

      game1PairWNFTPack = yoloConstants.Globals.GamePairHashes.ETH_USD;
      game1LengthWNFTPack = 70;

      contracts = getContracts();
    });
    describe("Yolorekt Contract GameInstanceWithNftPack test", () => {
      it("should revert deploying Contract with no registry", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );
        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            ZERO_ADDRESS,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_YoloRegistry");
      });

      it("should revert deploying Contract with no admin address", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );

        await expect(
          GameInstanceWithNFTPack.deploy(
            ZERO_ADDRESS,
            contracts.yoloRegistry.address,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_gameAdmin()");
      });
    });
  });

  describe("YOLOrekt Contract Deployment Test failures with no fixture", () => {
    let GameInstanceWithNFTPack;
    let accounts;
    let game1PairWNFTPack, game1LengthWNFTPack;
    let roundIndex = 0;
    let maxStartDelay = 0;

    beforeEach(async function () {
      accounts = await ethers.getSigners();
      (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

      game1PairWNFTPack = yoloConstants.Globals.GamePairHashes.ETH_USD;
      game1LengthWNFTPack = 70;
    });
    describe("Yolorekt Contract GameInstanceWithNftPack test", () => {
      it("should revert deploying Contract with no registry", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );
        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            ZERO_ADDRESS,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_YoloRegistry()");
      });

      it("should revert deploying Contract with no yolo token", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );

        const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
        const yoloRegistry = await YoloRegistry.deploy();

        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            yoloRegistry.address,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_USDCToken()");
      });

      it("should revert deploying Contract with user contract yolo token", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );

        // yolo registry
        const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
        const yoloRegistry = await YoloRegistry.deploy();

        // yolo token
        const StablecoinToken = await ethers.getContractFactory(
          "StablecoinToken"
        );
        const stablecoinToken = await StablecoinToken.deploy(
          yoloConstants.UTConfig.name,
          yoloConstants.UTConfig.symbol,
          admin.address
        );
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          ),
          [stablecoinToken.address, 1, 1]
        );

        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            yoloRegistry.address,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_YoloWallet()");
      });

      it("should revert deploying game factory with missing NFTTracker address ", async () => {
        const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
        const yoloRegistry = await YoloRegistry.deploy();

        const StablecoinToken = await ethers.getContractFactory(
          "StablecoinToken"
        );
        const stablecoinToken = await StablecoinToken.deploy(
          "Generic",
          "GEN",
          admin.address
        );

        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          ),
          [stablecoinToken.address, 1, 1]
        );

        const YoloWallet = await ethers.getContractFactory("YoloWallet");
        const yoloWallet = await YoloWallet.deploy(yoloRegistry.address);
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_WALLET
          ),
          [yoloWallet.address, 1, 1]
        );

        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        const liquidityPool = await LiquidityPool.deploy(yoloRegistry.address);
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          ),
          [liquidityPool.address, 1, 1]
        );

        const NFTTracker = await ethers.getContractFactory("NFTTracker");
        const nftTracker = await NFTTracker.deploy(yoloRegistry.address);

        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_TRACKER
          ),
          [nftTracker.address, 1, 1]
        );

        const YoloNFTPack = await ethers.getContractFactory("YoloNFTPack");
        const yoloNFTPack = await YoloNFTPack.deploy(yoloRegistry.address);

        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_NFT_PACK
          ),
          [yoloNFTPack.address, 1, 1]
        );

        const GameFactory = await ethers.getContractFactory(
          "GameFactoryWithNFTPack"
        );

        const gameFactory = await GameFactory.deploy(yoloRegistry.address);

        await yoloRegistry.removeContractAddress(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.NFT_TRACKER
          )
        );

        // --- GameETH_USD ---
        const roundIndex = 0;
        const maxStartDelay = yoloConstants.TestPresets.Miner.THIRTY_MINUTES;
        const game1Pair = yoloConstants.Globals.GamePairHashes.ETH_USD;
        const game1Length = 70;

        const game1InstanceAddress = await gameFactory.getPredictedGameAddress(
          admin.address,
          yoloRegistry.address,
          game1Pair,
          game1Length,
          roundIndex,
          maxStartDelay
        );
        await yoloRegistry.setApprovedGame(game1InstanceAddress, true);
        await expect(
          gameFactory.createGame(
            admin.address,
            yoloRegistry.address,
            game1Pair,
            game1Length,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_NFTTracker()");
      });

      it("should revert deploying Contract with lp contract address ", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );

        // yolo registry
        const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
        const yoloRegistry = await YoloRegistry.deploy();

        // yolo token
        const StablecoinToken = await ethers.getContractFactory(
          "StablecoinToken"
        );
        const stablecoinToken = await StablecoinToken.deploy(
          yoloConstants.UTConfig.name,
          yoloConstants.UTConfig.symbol,
          admin.address
        );
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          ),
          [stablecoinToken.address, 1, 1]
        );

        //users
        const YoloWallet = await ethers.getContractFactory("YoloWallet");
        const yoloWallet = await YoloWallet.deploy(yoloRegistry.address);
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_WALLET
          ),
          [yoloWallet.address, 1, 1]
        );

        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            yoloRegistry.address,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_LiquidityPool()");
      });

      it("should revert deploying Contract without nft pack contract address ", async () => {
        GameInstanceWithNFTPack = await ethers.getContractFactory(
          "GameInstanceWithNFTPack"
        );

        // yolo registry
        const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
        const yoloRegistry = await YoloRegistry.deploy();

        // yolo token
        const StablecoinToken = await ethers.getContractFactory(
          "StablecoinToken"
        );
        stablecoinToken = await StablecoinToken.deploy(
          yoloConstants.UTConfig.name,
          yoloConstants.UTConfig.symbol,
          admin.address
        );
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.USDC_TOKEN
          ),
          [stablecoinToken.address, 1, 1]
        );

        //users
        const YoloWallet = await ethers.getContractFactory("YoloWallet");
        yoloWallet = await YoloWallet.deploy(yoloRegistry.address);
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.YOLO_WALLET
          ),
          [yoloWallet.address, 1, 1]
        );

        //lp

        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        liquidityPool = await LiquidityPool.deploy(yoloRegistry.address);
        await yoloRegistry.setContract(
          getPackedEncodingNameHash(
            yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
          ),
          [liquidityPool.address, 1, 1]
        );

        await expect(
          GameInstanceWithNFTPack.deploy(
            admin.address,
            yoloRegistry.address,
            game1PairWNFTPack,
            game1LengthWNFTPack,
            roundIndex,
            maxStartDelay
          )
        ).to.be.revertedWith("ZAA_YoloNFTPack()");
      });
    });
  });
});
