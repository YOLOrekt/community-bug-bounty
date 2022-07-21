const { expect } = require("chai");
const {
  waffle: { loadFixture },
} = require("hardhat");

const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toTokenAmount, bnOne, toUSDCAmount } = require("./utils/BNUtils");

// *** GameInstanceWithNft Contract Unit Test ***
const {
  Globals: { HashedRoles, HashedContractNames },
  TestPresets: {
    GAME_INSTANCE: gameInstancePresets,
    NFT_TRACKER: { level1Id },
  },
} = require("./constants");

const ONE_MILLION = 1000000;

describe("YOLOrekt BiddersRewardsFactory Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let yoloRegistry;
  let stablecoinToken;
  let yoloNFTPack;
  let nftTracker;
  let gameETH_USD_W_NFT_Pack;
  let biddersRewards;
  let BiddersRewards;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    BiddersRewards = await ethers.getContractFactory("BiddersRewards");

    const contracts = getContracts();

    yoloRegistry = contracts.yoloRegistry;
    stablecoinToken = contracts.stablecoinToken;
    yoloNFTPack = contracts.yoloNFTPack;
    nftTracker = contracts.nftTracker;
    gameETH_USD_W_NFT_Pack = contracts.gameETH_USD_W_NFT_Pack;

    biddersRewardsFactory = contracts.biddersRewardsFactory;

    await gameETH_USD_W_NFT_Pack.unpause();
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("Funding setup", () => {
    it("can deploy (rotate) first and subsequent BiddersRewards contracts", async () => {
      const rewardsAddressesLengthUnInited =
        await biddersRewardsFactory.getRewardsAddressesLength();

      expect(rewardsAddressesLengthUnInited).to.equal(0);

      await yoloNFTPack.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await nftTracker.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.setNFTTrackerContract();
      await yoloNFTPack.mintBaseSFT(alice.address);

      await nftTracker.setYoloNFTPackContract();
      await nftTracker.setLevelRequirement(level1Id, 1, 2, 1);

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(
          toTokenAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );

      const biddersRewardsAddress =
        await biddersRewardsFactory.rewardsAddresses(0);
      const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
      biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);

      await stablecoinToken.approve(
        biddersRewards.address,
        toUSDCAmount(ONE_MILLION).toString()
      );

      await biddersRewards.setMaxFundAmount(bnOne.toString());
      await biddersRewards.fund(bnOne.toString());

      const rewardsAddressesLengthOneRotate =
        await biddersRewardsFactory.getRewardsAddressesLength();

      expect(rewardsAddressesLengthOneRotate).to.equal(1);

      expect(await biddersRewards.isReleased()).to.eq(false);

      expect(
        await nftTracker.hasRole(HashedRoles.ADMIN_ROLE, biddersRewards.address)
      );
      expect(
        await yoloNFTPack.hasRole(
          HashedRoles.ADMIN_ROLE,
          biddersRewards.address
        )
      );

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      expect(await biddersRewards.isReleased()).to.eq(true);

      const rewardsAddressesLengthTwoRotations =
        await biddersRewardsFactory.getRewardsAddressesLength();

      expect(rewardsAddressesLengthTwoRotations).to.equal(2);

      const rewardsAddressSecond = await biddersRewardsFactory.rewardsAddresses(
        rewardsAddressesLengthTwoRotations - 1
      );

      const secondRewardsContract = await BiddersRewards.attach(
        rewardsAddressSecond
      );

      expect(await secondRewardsContract.isReleased()).to.eq(false);

      expect(
        await nftTracker.hasRole(
          HashedContractNames.BIDDERS_REWARDS,
          rewardsAddressSecond
        )
      );
      expect(
        await yoloNFTPack.hasRole(
          HashedContractNames.BIDDERS_REWARDS,
          rewardsAddressSecond
        )
      );
    });

    it("end rewards cycle", async () => {
      const rewardsAddressesLengthUnInited =
        await biddersRewardsFactory.getRewardsAddressesLength();

      expect(rewardsAddressesLengthUnInited).to.equal(0);
      await yoloNFTPack.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await nftTracker.grantRole(
        HashedRoles.ADMIN_ROLE,
        biddersRewardsFactory.address
      );
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.setNFTTrackerContract();
      await yoloNFTPack.mintBaseSFT(alice.address);

      await nftTracker.setYoloNFTPackContract();
      await nftTracker.setLevelRequirement(level1Id, 1, 2, 1);

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(
          toTokenAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(
          toTokenAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );

      const biddersRewardsAddress =
        await biddersRewardsFactory.rewardsAddresses(0);
      const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
      biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);

      await stablecoinToken.approve(
        biddersRewards.address,
        toUSDCAmount(ONE_MILLION).toString()
      );

      await biddersRewardsFactory.endRewards();
      await expect(biddersRewardsFactory.endRewards()).to.be.revertedWith(
        "rewards not started"
      );
    });
  });
});
