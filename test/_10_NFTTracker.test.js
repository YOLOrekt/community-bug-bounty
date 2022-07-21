const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");

const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toBN, toTokenAmount, bnTwo } = require("./utils/BNUtils");
const { getPackedEncodingNameHash } = require("./utils/helpers");

const yoloConstants = require("./constants");

const provider = ethers.provider;

// *** NFTTracker Contract Unit Test ***
const {
  Math: { ZERO_ADDRESS },
  TestPresets: {
    NFT_TRACKER: { level1Id, level2Id },
  },
  Globals: { HashedRoles },
} = yoloConstants;

const nftTrackerPresets = yoloConstants.TestPresets.NFT_TRACKER;

// !!! these tests use BEFORE! NOT beforeeach

describe("YOLOrekt NFTTracker Test", () => {
  //  *** Addresses ***

  let admin, alice, bob;

  //  *** Contracts ***
  let yoloRegistry;
  let stablecoinToken;
  let yoloNFTPack;
  let nftTracker;
  let yoloWallet;
  let gameETH_USD;
  let biddersRewards;
  let biddersRewardsFactory;

  async function fixture() {
    await deployContracts(admin);

    const contracts = getContracts();

    yoloRegistry = contracts.yoloRegistry;
    stablecoinToken = contracts.stablecoinToken;
    yoloNFTPack = contracts.yoloNFTPack;
    nftTracker = contracts.nftTracker;
    yoloWallet = contracts.yoloWallet;
    gameETH_USD = contracts.gameETH_USD_W_NFT_Pack;

    biddersRewardsFactory = contracts.biddersRewardsFactory;

    await gameETH_USD.unpause();
  }

  before(async () => {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("Initial setup and checks", () => {
    // before(async () => {

    //   await yoloRegistry.removeContractAddress(
    //     getPackedEncodingNameHash(
    //       yoloConstants.Globals.ContractNames.BIDDERS_REWARDS
    //     )
    //   );
    // });

    it("Should revert with missing address", async () => {
      await expect(
        nftTracker.setBiddersRewardsContract(ZERO_ADDRESS)
      ).to.be.revertedWith("ZAA_BiddersRewards()");
    });

    it("Initial bidders rewards address is zero", async () => {
      // caveat: can change. 5 slots for tracker, 2 for parents
      const slotAddress = await provider.getStorageAt(nftTracker.address, 7);

      const biddersRewardsAddress = ethers.utils.defaultAbiCoder.decode(
        ["address"],
        slotAddress
      )[0];
      //tODO end rewards
      expect(biddersRewardsAddress).to.be.equal(ZERO_ADDRESS);
    });

    it("NFT levels list should start at zero", async () => {
      const listLength = await nftTracker.getNFTLevelIdsLength();

      expect(listLength).to.be.equal(0);
    });

    it("Call NFT levels list range with 0 length", async () => {
      await expect(nftTracker.getNFTLevelsListRange(0, 0)).to.be.revertedWith(
        "length must be g.t. 0"
      );
    });

    it("Revert call NFT levels list range with nonzero length", async () => {
      await expect(nftTracker.getNFTLevelsListRange(0, 1)).to.be.revertedWith(
        "range out of array bounds"
      );
    });

    it("Revert set level requirement on bad authorization", async () => {
      await nftTracker.setYoloNFTPackContract();

      await expect(
        nftTracker.connect(alice).setLevelRequirement(0, 1, 1, 1)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          alice.address.toLowerCase() +
          " is missing role " +
          HashedRoles.MINTER_ROLE +
          "'"
      );
    });

    it("Revert set level requirement on wrong id encoding", async () => {
      await nftTracker.setYoloNFTPackContract();

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await expect(
        nftTracker.setLevelRequirement(0, 1, 1, 1)
      ).to.be.revertedWith("incorrect token base encoding");
    });

    it("Revert set level requirement on nonexistent base type", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await expect(
        nftTracker.setLevelRequirement(level1Id, 0, 1, 1)
      ).to.be.revertedWith("base type does not exist");
    });

    it("Revert set level requirement on zero bid count threshold", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);

      await expect(
        nftTracker.setLevelRequirement(level1Id, 0, 1, 1)
      ).to.be.revertedWith("new thresholds must be greater than lower level");
    });

    it("Revert set level requirement on zero cum amount threshold", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);

      await expect(
        nftTracker.setLevelRequirement(level1Id, 1, 0, 1)
      ).to.be.revertedWith("new thresholds must be greater than lower level");
    });
  });

  describe("NftTracker threshold modifications", () => {
    it("Set threshold values initial level threshold value", async () => {
      await nftTracker.setYoloNFTPackContract();

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);

      await expect(nftTracker.setLevelRequirement(level1Id, 1, 2, 1))
        .to.emit(nftTracker, "LevelSet")
        .withArgs(level1Id, 1, 2);

      const currentLevelRequirements = await nftTracker.levelRequirements(
        level1Id
      );

      expect(currentLevelRequirements.roundCountThreshold).to.be.equal(1);

      expect(currentLevelRequirements.cumulativeAmountThreshold).to.be.equal(2);

      expect(currentLevelRequirements.nextLevelId).to.be.equal(0);

      expect(currentLevelRequirements.prevLevelId).to.be.equal(0);
    });

    it("New level sets prev and next threshold values on 2 levels", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await nftTracker.setLevelRequirement(level1Id, 1, 2, 1);
      await nftTracker.setLevelRequirement(level2Id, 3, 4, 3);

      const level2Requirements = await nftTracker.levelRequirements(level2Id);
      const l1Req = await nftTracker.levelRequirements(level1Id);

      expect(level2Requirements.roundCountThreshold).to.be.equal(3);

      expect(level2Requirements.cumulativeAmountThreshold).to.be.equal(4);

      expect(level2Requirements.nextLevelId).to.be.equal(0);

      expect(level2Requirements.prevLevelId).to.be.equal(level1Id);

      expect(l1Req.nextLevelId).to.be.equal(level2Id);
    });

    it("Cannot set threshold values to 0", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);
      await expect(
        nftTracker.setLevelRequirement(level1Id, 0, 4, 1)
      ).to.be.revertedWith("new thresholds must be greater than lower level");

      await expect(
        nftTracker.setLevelRequirement(level1Id, 1, 0, 2)
      ).to.be.revertedWith("new thresholds must be greater than lower level");
    });

    it("Cannot set threshold values below lower level", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await nftTracker.setLevelRequirement(level1Id, 1, 2, 1);
      await nftTracker.setLevelRequirement(level2Id, 3, 4, 3);

      await expect(
        nftTracker.setLevelRequirement(level2Id, 1, 4, 2)
      ).to.be.revertedWith("new thresholds must be greater than lower level");

      await expect(
        nftTracker.setLevelRequirement(level2Id, 3, 2, 3)
      ).to.be.revertedWith("new thresholds must be greater than lower level");

      await expect(
        nftTracker.setLevelRequirement(level2Id, 0, 4, 1)
      ).to.be.revertedWith("new thresholds must be greater than lower level");

      await expect(
        nftTracker.setLevelRequirement(level2Id, 3, 1, 4)
      ).to.be.revertedWith("new thresholds must be greater than lower level");
    });

    it("Cannot set threshold values above higher level", async () => {
      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await nftTracker.setLevelRequirement(level1Id, 1, 2, 1);
      await nftTracker.setLevelRequirement(level2Id, 3, 4, 3);

      await expect(
        nftTracker.setLevelRequirement(level1Id, 1, 4, 1)
      ).to.be.revertedWith("new thresholds must be less than next level");

      await expect(
        nftTracker.setLevelRequirement(level1Id, 3, 2, 3)
      ).to.be.revertedWith("new thresholds must be less than next level");

      await expect(
        nftTracker.setLevelRequirement(level1Id, 1, 4, 2)
      ).to.be.revertedWith("new thresholds must be less than next level");

      await expect(
        nftTracker.setLevelRequirement(level1Id, 3, 2, 4)
      ).to.be.revertedWith("new thresholds must be less than next level");
    });
  });

  describe("NftTracker in play", () => {
    let biddersRewards;
    beforeEach(async () => {
      await yoloNFTPack.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );

      await nftTracker.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      const biddersRewardsAddress =
        await biddersRewardsFactory.rewardsAddresses(0);

      const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
      biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);

      await yoloRegistry.setContract(
        getPackedEncodingNameHash(
          yoloConstants.Globals.ContractNames.BIDDERS_REWARDS
        ),
        [biddersRewards.address, 1, 1]
      );

      await nftTracker.setBiddersRewardsContract(biddersRewards.address);
      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );
    });

    it("should revert if yoloWallet (not game contract) call the update tracking", async () => {
      await expect(
        nftTracker.updateTracking(
          nftTrackerPresets.tokenIndex,
          nftTrackerPresets.bidAmount100,
          yoloConstants.Globals.GamePairHashes.ETH_USD,
          nftTrackerPresets.roundIndexes[2]
        )
      ).to.be.revertedWith("caller isnt approved game cntrct");

      await expect(
        nftTracker
          .connect(alice)
          .updateTracking(
            nftTrackerPresets.tokenIndex,
            nftTrackerPresets.bidAmount100,
            yoloConstants.Globals.GamePairHashes.ETH_USD,
            nftTrackerPresets.roundIndexes[2]
          )
      ).to.be.revertedWith("caller isnt approved game cntrct");
    });

    it("should update the nftTrackingMap if user bid", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 2);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toTokenAmount(nftTrackerPresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toTokenAmount(nftTrackerPresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(nftTrackerPresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(nftTrackerPresets.transferAmount).toString()
      );

      const bobNftId = toBN(level1Id).add(toBN(1));
      const oneHundredTokens = toTokenAmount(
        nftTrackerPresets.bidAmount100
      ).toString();
      const twoHundredTokens = toTokenAmount(nftTrackerPresets.bidAmount100)
        .mul(bnTwo)
        .toString();

      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(oneHundredTokens, true, nftTrackerPresets.roundIndexes[2])
      )
        .to.emit(nftTracker, "BidTracking")
        .withArgs(bobNftId, 1, oneHundredTokens);

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toTokenAmount(nftTrackerPresets.bidAmount200).toString(),
          false,
          nftTrackerPresets.roundIndexes[2]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toTokenAmount(nftTrackerPresets.bidAmount100).toString(),
          true,
          nftTrackerPresets.roundIndexes[2]
        );

      const bobTokenIndex = await yoloNFTPack.usersTokens(bob.address);
      const aliceTokenIndex = await yoloNFTPack.usersTokens(alice.address);
      let bobNftTracking = await nftTracker.nftTrackingMap(bobTokenIndex);

      expect(bobNftTracking.roundCount.toString()).to.be.equal(
        toBN(1).toString()
      );

      expect(bobNftTracking.cumulativeBidAmount.toString()).to.be.equal(
        toTokenAmount(nftTrackerPresets.bidAmount100).toString()
      );

      let aliceNftTracking = await nftTracker.nftTrackingMap(aliceTokenIndex);

      expect(aliceNftTracking.roundCount.toString()).to.be.equal(
        toBN(1).toString()
      );

      expect(aliceNftTracking.cumulativeBidAmount.toString()).to.be.equal(
        toTokenAmount(
          nftTrackerPresets.bidAmount200 + nftTrackerPresets.bidAmount100
        ).toString()
      );

      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            toTokenAmount(nftTrackerPresets.bidAmount100).toString(),
            true,
            nftTrackerPresets.roundIndexes[3]
          )
      )
        .to.emit(nftTracker, "BidTracking")
        .withArgs(bobNftId, 2, twoHundredTokens);

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toTokenAmount(nftTrackerPresets.bidAmount200).toString(),
          false,
          nftTrackerPresets.roundIndexes[3]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toTokenAmount(nftTrackerPresets.bidAmount100).toString(),
          true,
          nftTrackerPresets.roundIndexes[3]
        );

      bobNftTracking = await nftTracker.nftTrackingMap(bobTokenIndex);

      expect(bobNftTracking.roundCount.toString()).to.be.equal(
        toBN(2).toString()
      );

      expect(bobNftTracking.cumulativeBidAmount.toString()).to.be.equal(
        toTokenAmount(2 * nftTrackerPresets.bidAmount100).toString()
      );

      aliceNftTracking = await nftTracker.nftTrackingMap(aliceTokenIndex);

      expect(aliceNftTracking.roundCount.toString()).to.be.equal(
        toBN(2).toString()
      );

      expect(aliceNftTracking.cumulativeBidAmount.toString()).to.be.equal(
        toTokenAmount(
          2 * (nftTrackerPresets.bidAmount200 + nftTrackerPresets.bidAmount100)
        ).toString()
      );
    });
  });
});
