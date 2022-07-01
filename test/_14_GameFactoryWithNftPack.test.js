const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");
const { deployContracts, getContracts } = require("./utils/deployUtils");

const yoloConstants = require("./constants");

const { ZERO_BYTES32 } = require("@openzeppelin/test-helpers/src/constants");

// *** GameFactory Contract Unit Test ***

describe("YOLOrekt GameFactory Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let GameInstanceWithNFTPack;

  let yoloRegistry;
  let gameFactoryWithNftPack;
  let yoloMarketHelpers;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    const contracts = getContracts();

    yoloRegistry = contracts.yoloRegistry;
    gameFactoryWithNftPack = contracts.gameFactoryWithNFTPack;

    yoloMarketHelpers = contracts.yoloMarketHelpers;

    GameInstanceWithNFTPack = await ethers.getContractFactory(
      "GameInstanceWithNFTPack"
    );
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("GameFactoryWithNFTPack", () => {
    const roundIndex = 0;
    const gameTestPair = yoloConstants.Globals.GamePairHashes.TSLA_USD;
    const gameTestPairLength = 70;
    const maxStartDelay = 0;

    it("should have same game instance address as predicted", async () => {
      const gameTestInstanceAddress =
        await gameFactoryWithNftPack.getPredictedGameAddress(
          admin.address,
          yoloRegistry.address,
          gameTestPair,
          gameTestPairLength,
          roundIndex,
          maxStartDelay
        );

      await yoloRegistry.setApprovedGame(gameTestInstanceAddress, true);
      await gameFactoryWithNftPack.createGame(
        admin.address,
        yoloRegistry.address,
        gameTestPair,
        gameTestPairLength,
        roundIndex,
        maxStartDelay
      );

      expect(
        await gameFactoryWithNftPack.gameAddresses(
          ethers.utils.solidityKeccak256(
            ["bytes32", "uint256"],
            [gameTestPair, gameTestPairLength]
          )
        )
      ).to.be.equal(gameTestInstanceAddress);

      const gameTest = await GameInstanceWithNFTPack.attach(
        gameTestInstanceAddress
      );

      expect(gameTest.address).to.be.equal(gameTestInstanceAddress);
    });

    it("should revert if there is same game instance when create game", async () => {
      const gameAlreadyExistingPair =
        yoloConstants.Globals.GamePairHashes.ETH_USD;
      const gameAlreadyExistingPairLength = 70;

      await expect(
        gameFactoryWithNftPack.createGame(
          admin.address,
          yoloRegistry.address,
          gameAlreadyExistingPair,
          gameAlreadyExistingPairLength,
          roundIndex,
          maxStartDelay
        )
      ).to.be.revertedWith("game configuration instance exists");
    });

    it("should revert if the game address is not approved in yolo registry when create game", async () => {
      await expect(
        gameFactoryWithNftPack.createGame(
          admin.address,
          yoloRegistry.address,
          gameTestPair,
          gameTestPairLength,
          roundIndex,
          maxStartDelay
        )
      ).to.be.revertedWith("game instance not approved for deployment");
    });

    it("should revert if the user is not admin when create game", async () => {
      await expect(
        gameFactoryWithNftPack
          .connect(bob)
          .createGame(
            admin.address,
            yoloRegistry.address,
            gameTestPair,
            gameTestPairLength,
            roundIndex,
            maxStartDelay
          )
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.ADMIN_ROLE.toLowerCase() +
          "'"
      );
    });

    it("should revert if game is not approved for deployment", async () => {
      await expect(
        gameFactoryWithNftPack
          .connect(admin)
          .createGame(
            admin.address,
            yoloRegistry.address,
            "0x4f45826ce9874a8dca27b8cf3d34688c5de2f164050b1182ac352dfd8ba92600",
            gameTestPairLength,
            roundIndex,
            maxStartDelay
          )
      ).to.be.revertedWith("game instance not approved for deployment");

      await expect(
        gameFactoryWithNftPack
          .connect(admin)
          .createGame(
            admin.address,
            yoloRegistry.address,
            ZERO_BYTES32,
            0,
            roundIndex,
            maxStartDelay
          )
      ).to.be.revertedWith("game instance not approved for deployment");
    });

    it("should revert if game configuration exists", async () => {
      const gameTestInstanceAddress =
        await gameFactoryWithNftPack.getPredictedGameAddress(
          admin.address,
          yoloRegistry.address,
          gameTestPair,
          gameTestPairLength,
          roundIndex,
          maxStartDelay
        );

      await yoloRegistry.setApprovedGame(gameTestInstanceAddress, true);
      await gameFactoryWithNftPack.createGame(
        admin.address,
        yoloRegistry.address,
        gameTestPair,
        gameTestPairLength,
        roundIndex,
        maxStartDelay
      );

      await expect(
        gameFactoryWithNftPack
          .connect(admin)
          .createGame(
            admin.address,
            yoloRegistry.address,
            gameTestPair,
            gameTestPairLength,
            roundIndex,
            maxStartDelay
          )
      ).to.be.revertedWith("game configuration instance exists");
    });
  });
});
