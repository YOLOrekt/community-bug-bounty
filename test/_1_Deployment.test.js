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
        ).to.be.revertedWith("yoloRegistry cannot be zero address");
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
        ).to.be.revertedWith("owner address must be specified");
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
        ).to.be.revertedWith("yoloRegistry cannot be zero address");
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
        ).to.be.revertedWith("yolo token addr not registered");
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
        ).to.be.revertedWith("wallet cntct addr not registered");
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
        ).to.be.revertedWith("lp contract addr not registered");
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
        ).to.be.revertedWith("nft contract address must be specified");
      });
    });
  });
});
