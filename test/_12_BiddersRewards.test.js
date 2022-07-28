const { expect } = require("chai");
const {
  ethers: { provider },
  waffle: { loadFixture },
} = require("hardhat");

const { deployContracts, getContracts } = require("./utils/deployUtils");
const {
  toBN,
  toTokenAmount,
  toTokenString,
  toUSDCAmount,
  bnOne,
  bnTwo,
} = require("./utils/BNUtils");

const {
  getPackedEncodingNameHash,
  getBlockAdvancerMethods,
} = require("./utils/helpers");

const yoloConstants = require("./constants");
const { BN } = require("@openzeppelin/test-helpers");

const { advanceBlocktime } = getBlockAdvancerMethods(ethers.provider);

// *** GameInstanceWithNft Contract Unit Test ***
const {
  Math: { ZERO_ADDRESS },
  TestPresets: {
    GAME_INSTANCE: gameInstancePresets,
    NFT_TRACKER: nftTrackerPresets,
    NFT_TRACKER: {
      level1Id,
      level2Id,
      level3Id,
      sixtyDays,
      rewardsMultiplier100,
      rewardsMultiplier200,
      rewardsMultiplier300,
    },
    YOLO_NFT_PACK: {
      l1FirstToken,
      l1SecondToken,
      l1ThirdToken,
      l1FourthToken,
      l2FirstToken,
    },
  },
  Globals: { HashedRoles },
} = yoloConstants;

const ONE_MILLION = 1000000;
const bidCountWeighting = toUSDCAmount(5);
const hundredBid = toUSDCAmount(gameInstancePresets.bidAmount100).toString();

describe("YOLOrekt BiddersRewards Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let yoloRegistry;
  let stablecoinToken;
  let yoloNFTPack;
  let nftTracker;
  let gameETH_USD_W_NFT_Pack;
  let biddersRewards;
  let biddersRewardsFactory;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]),
      (alice = accounts[1]),
      (bob = accounts[2]),
      (carol = accounts[3]),
      (dan = accounts[4]),
      await deployContracts(admin);

    const contracts = getContracts();

    yoloRegistry = contracts.yoloRegistry;
    stablecoinToken = contracts.stablecoinToken;
    yoloNFTPack = contracts.yoloNFTPack;
    nftTracker = contracts.nftTracker;
    gameETH_USD_W_NFT_Pack = contracts.gameETH_USD_W_NFT_Pack;
    biddersRewardsFactory = contracts.biddersRewardsFactory;

    await yoloNFTPack.grantRole(
      HashedRoles.ADMIN_ROLE,
      biddersRewardsFactory.address
    );

    await nftTracker.grantRole(
      HashedRoles.ADMIN_ROLE,
      biddersRewardsFactory.address
    );

    await biddersRewardsFactory.rotateRewardsContracts(admin.address);

    const biddersRewardsAddress = await biddersRewardsFactory.rewardsAddresses(
      0
    );

    const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
    biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);

    await yoloRegistry.setContract(
      getPackedEncodingNameHash(
        yoloConstants.Globals.ContractNames.BIDDERS_REWARDS
      ),
      [biddersRewards.address, 1, 1]
    );

    await gameETH_USD_W_NFT_Pack.unpause();
  }

  beforeEach(async () => {
    await loadFixture(fixture);
    console.log("each top");
  });

  describe("Funding setup", () => {
    it("revert by exceeding max fund", async () => {
      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await expect(biddersRewards.fund(bnOne.toString())).to.be.revertedWith(
        "amount exceeds max allowable"
      );

      await biddersRewards.setMaxFundAmount(bnOne.toString());

      await biddersRewards.fund(bnOne.toString());

      await expect(biddersRewards.fund(bnTwo.toString())).to.be.revertedWith(
        "amount exceeds max allowable"
      );
    });

    it("cannot exceed MAX FUND absolute limit", async () => {
      await expect(
        biddersRewards.setMaxFundAmount(toTokenAmount(2500001).toString())
      ).to.be.revertedWith("new max exceeds limit");
    });

    it("funding emits Funding", async () => {
      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      const oneHundredThousandTokens = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(oneHundredThousandTokens);

      await expect(biddersRewards.fund(oneHundredThousandTokens))
        .to.emit(biddersRewards, "Funding")
        .withArgs(admin.address, oneHundredThousandTokens);
    });

    // it("reverts when level multiplier not set", async () => {
    //   await yoloNFTPack.createBaseType(true);
    //   await yoloNFTPack.mintBaseSFT(alice.address);

    //   await stablecoinToken.approve(
    //     biddersRewards.address,
    //     toTokenAmount(ONE_MILLION).toString()
    //   );

    // await yoloNFTPack.mintBaseSFT(alice.address);
    //   await nftTracker.setBiddersRewardsContract(biddersRewards.address);
    //   await nftTracker.setYoloNFTPackContract();

    //   await nftTracker.setLevelRequirement(level1Id, 1, rewardsMultiplier200);

    //   await stablecoinToken
    //     .connect(alice)
    //     .approve(
    //       gameETH_USD_W_NFT_Pack.address,
    //       toTokenAmount(gameInstancePresets.approveMAX).toString()
    //     );

    //   await stablecoinToken.transfer(
    //     alice.address,
    //     toTokenAmount(gameInstancePresets.transferAmount).toString()
    //   );

    //   await gameETH_USD_W_NFT_Pack
    //     .connect(alice)
    //     .bidInYolo(
    //       toTokenAmount(gameInstancePresets.bidAmount100).toString(),
    //       true,
    //       gameInstancePresets.roundIndexes[1]
    //     );

    //   await biddersRewards.setMaxFundAmount(toTokenAmount(1000).toString());

    //   await expect(
    //     biddersRewards.fund(toTokenAmount(1000).toString())
    //   ).to.be.revertedWith(
    //     "VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)"
    //   );
    // });

    it("reverts when max cap exceeded", async () => {
      await yoloNFTPack.createBaseType(true);

      await expect(yoloNFTPack.mintBaseSFT(alice.address)).to.be.revertedWith(
        "mint exceeds token level cap"
      );

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(yoloNFTPack.mintBaseSFT(bob.address)).to.be.revertedWith(
        "mint exceeds token level cap"
      );
    });

    it("can set round count weighting", async () => {
      expect(await biddersRewards.countWeight()).to.be.equal(
        toUSDCAmount(5).toString()
      );

      await biddersRewards.setCountWeight(6543210);

      expect(await biddersRewards.countWeight()).to.be.equal(6543210);
    });

    it("funds entirely to one level", async () => {
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );

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

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      expect(
        await biddersRewards.getUserPendingReward(l1FirstToken)
      ).to.be.equal(0);

      await biddersRewards.fund(fundAmount);

      expect(
        await biddersRewards.getUserPendingReward(l1FirstToken)
      ).to.be.equal(fundAmount);

      console.log(await biddersRewards.poolInfos(level1Id));

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, fundAmount);
    });

    it("emits correct harvest event data", async () => {
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );

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

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      console.log(await biddersRewards.poolInfos(level1Id));

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      await expect(biddersRewards.connect(alice).harvest(alice.address))
        .to.emit(biddersRewards, "Harvest")
        .withArgs(alice.address, alice.address, l1FirstToken, fundAmount);
    });

    it("funds one level and splits to two tokens", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);
      const twoHundredBid = toTokenString(gameInstancePresets.bidAmount200);

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(twoHundredBid, true, gameInstancePresets.roundIndexes[1]);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      console.log(await biddersRewards.poolInfos(level1Id));

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      // add bid amount with weighted bid count of one
      const aliceWeighting = new BN(hundredBid).add(bidCountWeighting);
      const bobWeighting = new BN(twoHundredBid).add(bidCountWeighting);
      const combinedWeighting = aliceWeighting.add(bobWeighting);

      const aliceReward = aliceWeighting
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();
      const bobReward = bobWeighting
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();

      expect(
        await biddersRewards.getUserPendingReward(l1FirstToken)
      ).to.be.equal(aliceReward);

      expect(
        await biddersRewards.getUserPendingReward(l1SecondToken)
      ).to.be.equal(bobReward);

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, aliceReward);

      expect(
        await biddersRewards.getUserPendingReward(l1FirstToken)
      ).to.be.equal(0);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, bobReward);
    });

    it("funds two levels and splits to two levels", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);
      const twoHundredBid = toTokenString(gameInstancePresets.bidAmount200);
      const l2Weighting = 2;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);

      yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await yoloNFTPack.connect(bob).upgradeToken(l1SecondToken);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      console.log(await biddersRewards.poolInfos(level1Id));

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      // add bid amount with weighted bid count of one
      const l1WeightedBids = new BN(hundredBid).add(bidCountWeighting);
      // bob bids twice, bid count is one bc two bids in one round, then factor in multiplier
      const l2WeightedBids = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .mul(toBN(l2Weighting));
      const combinedWeighting = l1WeightedBids.add(l2WeightedBids);

      const l1Rewards = l1WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();
      const l2Rewards = l2WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();

      expect(await biddersRewards.getLatestLevelReward(level1Id)).to.be.equal(
        l1Rewards
      );

      expect(await biddersRewards.getLatestLevelReward(level2Id)).to.be.equal(
        l2Rewards
      );

      expect(
        await biddersRewards.getUserPendingReward(l1FirstToken)
      ).to.be.equal(l1Rewards);

      expect(
        await biddersRewards.getUserPendingReward(l2FirstToken)
      ).to.be.equal(l2Rewards);

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, l1Rewards);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, l2Rewards);
    });

    it("funds two levels and splits to two levels with multiple users", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);
      const twoHundredBid = toTokenString(gameInstancePresets.bidAmount200);

      const fourHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 + gameInstancePresets.bidAmount200
      );

      const sixHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200
      );
      const l2Weighting = 2;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level3Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);
      await yoloNFTPack.mintBaseSFT(carol.address);

      yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        carol.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await yoloNFTPack.connect(bob).upgradeToken(l1SecondToken);
      await yoloNFTPack.connect(carol).upgradeToken(l1ThirdToken);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      console.log(await biddersRewards.poolInfos(level1Id));

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      // add bid amount with weighted bid count of one
      const l1WeightedBids = new BN(hundredBid).add(bidCountWeighting);
      // bob bids twice, bid count is one bc two bids in one round, then factor in multiplier
      // carol bids 4 times
      const l2Bids = new BN(sixHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting);

      const l2WeightedBids = l2Bids.mul(toBN(l2Weighting));

      const combinedWeighting = l1WeightedBids.add(l2WeightedBids);

      const l1Rewards = l1WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();

      const l2Rewards = l2WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const bobL2Rewards = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .mul(l2Rewards)
        .div(l2Bids)
        .toString();

      const carolL2Rewards = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .mul(l2Rewards)
        .div(l2Bids)
        .toString();

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, l1Rewards);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, bobL2Rewards);

      await expect(() =>
        biddersRewards.connect(carol).harvest(carol.address)
      ).to.changeTokenBalance(stablecoinToken, carol, carolL2Rewards);
    });

    it("funds three levels and splits to three levels", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);

      const twoHundredBid = toTokenString(gameInstancePresets.bidAmount200);

      const fourHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 + gameInstancePresets.bidAmount200
      );

      const sixHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200
      );

      const l2Weighting = 2;
      const l3Weighting = 3;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level3Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);
      await yoloNFTPack.mintBaseSFT(carol.address);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        carol.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );
      await nftTracker.setLevelRequirement(
        level3Id,
        3,
        4,
        rewardsMultiplier300
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      // upgrade to lvl 2
      await yoloNFTPack.connect(bob).upgradeToken(l1SecondToken);
      await yoloNFTPack.connect(carol).upgradeToken(l1ThirdToken);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[2]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      // upgrade carol to lvl 3
      const carolTokenId = await yoloNFTPack.usersTokens(carol.address);
      await yoloNFTPack.connect(carol).upgradeToken(carolTokenId);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      console.log("Pool infos");
      console.log(await biddersRewards.poolInfos(level1Id));
      console.log(await biddersRewards.poolInfos(level2Id));
      console.log(await biddersRewards.poolInfos(level3Id));

      // add bid amount with weighted bid count of one
      const l1WeightedBids = new BN(hundredBid).add(bidCountWeighting);
      // bob bids twice, bid count is one bc two bids in one round, then factor in multiplier

      const l2Bids = new BN(twoHundredBid).add(bidCountWeighting);

      // carol bids 4 times in 2 rounds
      const l3Bids = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .add(bidCountWeighting);

      const l2WeightedBids = l2Bids.mul(toBN(l2Weighting));

      const l3WeightedBids = l3Bids.mul(toBN(l3Weighting));

      const combinedWeighting = l1WeightedBids
        .add(l2WeightedBids)
        .add(l3WeightedBids);

      console.log("CombinedWeighting %s", combinedWeighting);

      const l1Rewards = l1WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting)
        .toString();

      const l2Rewards = l2WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const l3Rewards = l3WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const bobL2Rewards = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .mul(l2Rewards)
        .div(l2Bids)
        .toString();

      const carolL2Rewards = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .mul(l3Rewards)
        .div(l3Bids)
        .toString();

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, l1Rewards);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, bobL2Rewards);

      await expect(() =>
        biddersRewards.connect(carol).harvest(carol.address)
      ).to.changeTokenBalance(stablecoinToken, carol, carolL2Rewards);
    });

    it("funds two levels and splits to two higher levels", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);

      const fourHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 + gameInstancePresets.bidAmount200
      );

      const eightHundred = toTokenString(
        gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200 +
          gameInstancePresets.bidAmount200
      );

      const l2Weighting = 2;
      const l3Weighting = 3;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level3Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );
      await nftTracker.setLevelRequirement(
        level3Id,
        3,
        4,
        rewardsMultiplier300
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      // upgrade to lvl 2
      await yoloNFTPack.connect(alice).upgradeToken(l1FirstToken);
      await yoloNFTPack.connect(bob).upgradeToken(l1SecondToken);

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[2]);

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[2]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      // upgrade alice and bob to lvl 3
      const aliceTokenId = await yoloNFTPack.usersTokens(alice.address);
      await yoloNFTPack.connect(alice).upgradeToken(aliceTokenId);
      const bobTokenID = await yoloNFTPack.usersTokens(bob.address);
      await yoloNFTPack.connect(bob).upgradeToken(bobTokenID);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      console.log("Pool infos");
      console.log(await biddersRewards.poolInfos(level1Id));
      console.log(await biddersRewards.poolInfos(level2Id));
      console.log(await biddersRewards.poolInfos(level3Id));

      const l3Bids = new BN(eightHundred)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .add(bidCountWeighting);

      const l3WeightedBids = l3Bids.mul(toBN(l3Weighting));

      const combinedWeighting = l3WeightedBids;

      const l3Rewards = l3WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const bobL3Rewards = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .mul(l3Rewards)
        .div(l3Bids)
        .toString();

      const aliceL3Rewards = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting)
        .mul(l3Rewards)
        .div(l3Bids)
        .toString();

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, aliceL3Rewards);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, bobL3Rewards);
    });

    it("funds two levels and splits to two higher levels 2 tokens each", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);

      const fourHundredBid = toTokenString(
        gameInstancePresets.bidAmount200 + gameInstancePresets.bidAmount200
      );

      const twoHundredBid = toTokenString(gameInstancePresets.bidAmount200);

      const l2Weighting = 2;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level3Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);
      await yoloNFTPack.mintBaseSFT(carol.address);
      await yoloNFTPack.mintBaseSFT(dan.address);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        carol.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        dan.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(dan)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(dan)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(dan)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      // upgrade to lvl 2
      await yoloNFTPack.connect(carol).upgradeToken(l1ThirdToken);
      await yoloNFTPack.connect(dan).upgradeToken(l1FourthToken);

      const fundAmount = toUSDCAmount(100000).toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      console.log("Pool infos");
      console.log(await biddersRewards.poolInfos(level1Id));
      console.log(await biddersRewards.poolInfos(level2Id));
      console.log(await biddersRewards.poolInfos(level3Id));

      const l1Bids = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting);

      const l2Bids = new BN(fourHundredBid)
        .add(bidCountWeighting)
        .add(bidCountWeighting);

      const l1WeightedBids = l1Bids;

      const l2WeightedBids = l2Bids.mul(toBN(l2Weighting));

      const combinedWeighting = l1WeightedBids.add(l2WeightedBids);

      const l1Rewards = l1WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const l2Rewards = l2WeightedBids
        .mul(new BN(fundAmount))
        .div(combinedWeighting);

      const aliceL1Rewards = new BN(hundredBid)
        .add(bidCountWeighting)
        .mul(l1Rewards)
        .div(l1Bids)
        .toString();

      const bobL1Rewards = new BN(hundredBid)
        .add(bidCountWeighting)
        .mul(l1Rewards)
        .div(l1Bids)
        .toString();

      const carolL2Rewards = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .mul(l2Rewards)
        .div(l2Bids)
        .toString();

      const danL2Rewards = new BN(twoHundredBid)
        .add(bidCountWeighting)
        .mul(l2Rewards)
        .div(l2Bids)
        .toString();

      await expect(() =>
        biddersRewards.connect(alice).harvest(alice.address)
      ).to.changeTokenBalance(stablecoinToken, alice, aliceL1Rewards);

      await expect(() =>
        biddersRewards.connect(bob).harvest(bob.address)
      ).to.changeTokenBalance(stablecoinToken, bob, bobL1Rewards);

      await expect(() =>
        biddersRewards.connect(carol).harvest(carol.address)
      ).to.changeTokenBalance(stablecoinToken, carol, carolL2Rewards);

      await expect(() =>
        biddersRewards.connect(dan).harvest(dan.address)
      ).to.changeTokenBalance(stablecoinToken, dan, danL2Rewards);
    });

    it("try to recover funds", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);

      const l2Weighting = 2;
      const l3Weighting = 3;

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level3Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);
      await yoloNFTPack.mintBaseSFT(carol.address);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await stablecoinToken.transfer(
        alice.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        bob.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        carol.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );
      await nftTracker.setLevelRequirement(
        level3Id,
        3,
        4,
        rewardsMultiplier300
      );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(alice)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(bob)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      const fundAmountBN = toUSDCAmount(100000);
      const fundAmount = fundAmountBN.toString();
      const fundAmountNegative = fundAmountBN.neg().toString();

      await biddersRewards.setMaxFundAmount(fundAmount);

      await biddersRewards.fund(fundAmount);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      console.log("Pool infos");
      console.log(await biddersRewards.poolInfos(level1Id));
      console.log(await biddersRewards.poolInfos(level2Id));
      console.log(await biddersRewards.poolInfos(level3Id));

      await expect(
        biddersRewards.recoverFunds(admin.address)
      ).to.be.revertedWith("requires 60 days post deployment");

      await advanceBlocktime(sixtyDays);

      await expect(() =>
        biddersRewards.recoverFunds(admin.address)
      ).to.changeTokenBalances(
        stablecoinToken,
        [biddersRewards, admin],
        [fundAmountNegative, fundAmount]
      );
    });

    it("check for redundant release request event if released twice", async () => {
      const rewardsAddressesLengthUnInited =
        await biddersRewardsFactory.getRewardsAddressesLength();
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
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);

      await nftTracker.setYoloNFTPackContract();
      await yoloNFTPack.setNFTTrackerContract();
      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );
      await yoloNFTPack.mintBaseSFT(alice.address);

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

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await biddersRewards.setMaxFundAmount(bnOne.toString());
      await biddersRewards.fund(bnOne.toString());

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
        toTokenAmount(ONE_MILLION).toString()
      );

      await expect(biddersRewards.releaseFunds())
        .to.emit(biddersRewards, "RedundantReleaseRequest")
        .withArgs(1, admin.address);
    });

    it("emits Harvest event when NFT Pack calls harvest on upgrade", async () => {
      const hundredBid = toTokenString(gameInstancePresets.bidAmount100);

      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.createBaseType(true);

      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setTokenLevelMaxCap(level2Id, 10);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await yoloNFTPack.mintBaseSFT(carol.address);

      await stablecoinToken.transfer(
        carol.address,
        toTokenAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await biddersRewards.setMaxFundAmount(bnOne.toString());
      await biddersRewards.fund(bnOne.toString());

      await nftTracker.setYoloNFTPackContract();

      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setLevelRequirement(
        level2Id,
        2,
        3,
        rewardsMultiplier200
      );

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      console.log(
        "rewards address length:",
        await biddersRewardsFactory.getRewardsAddressesLength()
      );

      const secondBiddersRewardsAddress =
        await biddersRewardsFactory.rewardsAddresses(1);
      const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
      const secondBiddersRewards = await BiddersRewards.attach(
        secondBiddersRewardsAddress
      );

      await stablecoinToken.approve(
        secondBiddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await secondBiddersRewards.setMaxFundAmount(bnOne.toString());
      await secondBiddersRewards.fund(bnOne.toString());

      // upgrade to lvl 2
      await expect(yoloNFTPack.connect(carol).upgradeToken(l1FirstToken))
        .to.emit(biddersRewards, "Harvest")
        .withArgs(yoloNFTPack.address, carol.address, l1FirstToken, 1);
    });

    it("reverts if funded after funds released", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);
      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );

      await nftTracker.setYoloNFTPackContract();
      await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
      await nftTracker.setLevelRequirement(
        level1Id,
        1,
        2,
        rewardsMultiplier100
      );
      await nftTracker.setYoloNFTPackContract();

      await yoloNFTPack.mintBaseSFT(carol.address);

      await stablecoinToken.approve(
        biddersRewards.address,
        toTokenAmount(ONE_MILLION).toString()
      );

      await biddersRewards.setMaxFundAmount(bnTwo.toString());
      await biddersRewards.fund(bnOne.toString());

      await stablecoinToken
        .connect(carol)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        carol.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD_W_NFT_Pack
        .connect(carol)
        .bidInYolo(hundredBid, true, gameInstancePresets.roundIndexes[1]);

      await biddersRewardsFactory.rotateRewardsContracts(admin.address);

      await expect(biddersRewards.fund(bnOne.toString())).to.be.revertedWith(
        "rewards previously processed"
      );
    });

    it("reverts on rotation if prior rewards contract not funded", async () => {
      await expect(
        biddersRewardsFactory.rotateRewardsContracts(admin.address)
      ).to.be.revertedWith("prior cntct requires funds");
    });
  });

  // TODO: use or remove this describe
  describe("BiddersRewards setup", () => {
    async function rewardsSetup1() {
      // mint nft, make a bid
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 10);

      await yoloNFTPack.mintBaseSFT(alice.address);

      await yoloNFTPack.setBiddersRewardsFactoryContract(
        biddersRewardsFactory.address
      );
    }

    async function gameBidSetup() {
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
          toTokenAmount(nftTrackerPresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD_W_NFT_Pack.address,
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

      // const bobNftId = toBN(level1Id).add(toBN(1));
      // const oneHundredTokens = toTokenAmount(
      //   nftTrackerPresets.bidAmount100
      // ).toString();
      // const twoHundredTokens = toTokenAmount(nftTrackerPresets.bidAmount100)
      //   .mul(bnTwo)
      //   .toString();

      // // await expect(
      // //   gameETH_USD_W_NFT_Pack
      // //     .connect(bob)
      // //     .bidInYolo(oneHundredTokens, true, nftTrackerPresets.roundIndexes[2])
      // // )
      // //   .to.emit(nftTracker, "BidTracking")
      // //   .withArgs(bobNftId, 1, oneHundredTokens);

      // // await gameETH_USD_W_NFT_Pack
      // //   .connect(alice)
      // //   .bidInYolo(
      // //     toTokenAmount(nftTrackerPresets.bidAmount200).toString(),
      // //     false,
      // //     nftTrackerPresets.roundIndexes[2]
      // //   );

      // // await gameETH_USD_W_NFT_Pack
      // //   .connect(alice)
      // //   .bidInYolo(
      // //     toTokenAmount(nftTrackerPresets.bidAmount100).toString(),
      // //     true,
      // //     nftTrackerPresets.roundIndexes[2]
      // //   );
    }

    beforeEach(async () => {
      console.log("nft setup each");
      await loadFixture(rewardsSetup1);
      await loadFixture(gameBidSetup);
    });

    it("should ", async () => {
      const game1Pair = yoloConstants.Globals.GamePairHashes.ETH_USD;
      const game1PairLength = 70;
      expect(await gameETH_USD_W_NFT_Pack.GAME_ID()).to.be.equal(
        ethers.utils.solidityKeccak256(
          ["bytes32", "uint256"],
          [game1Pair, game1PairLength]
        )
      );
    });
  });

  describe("testing fixutre ", () => {
    it("balance resets?", async () => {
      console.log(await stablecoinToken.balanceOf(alice.address));
    });
  });
});

describe("YOLOrekt BiddersRewards Deployment Test", () => {
  let nftTracker, yoloRegistry, yoloNFTPack, biddersRewards, admin;
  let biddersRewardsFactory;

  before(async () => {
    admin = (await ethers.getSigners())[0];

    const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
    yoloRegistry = await YoloRegistry.deploy();

    const StablecoinToken = await ethers.getContractFactory("StablecoinToken");
    const stablecoinToken = await StablecoinToken.deploy(
      yoloConstants.UTConfig.name,
      yoloConstants.UTConfig.symbol,
      admin.address
    );
    await yoloRegistry.setContract(
      getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.USDC_TOKEN),
      [stablecoinToken.address, 1, 1]
    );

    const NFTTracker = await ethers.getContractFactory("NFTTracker");
    nftTracker = await NFTTracker.deploy(yoloRegistry.address);
    await yoloRegistry.setContract(
      getPackedEncodingNameHash(
        yoloConstants.Globals.ContractNames.NFT_TRACKER
      ),
      [nftTracker.address, 1, 1]
    );

    const YoloNFTPack = await ethers.getContractFactory("YoloNFTPack");
    yoloNFTPack = await YoloNFTPack.deploy(yoloRegistry.address);

    await yoloRegistry.setContract(
      getPackedEncodingNameHash(
        yoloConstants.Globals.ContractNames.YOLO_NFT_PACK
      ),
      [yoloNFTPack.address, 1, 1]
    );
  });

  it("Should revert with missing bidders cntct", async () => {
    await expect(
      nftTracker.setBiddersRewardsContract(ZERO_ADDRESS)
    ).to.be.revertedWith("ZAA_BiddersRewards()");
    await expect(
      yoloNFTPack.setBiddersRewardsFactoryContract(ZERO_ADDRESS)
    ).to.be.revertedWith("rewards address cannot be zero");
  });

  it("Should revert with sender must be rewards factory", async () => {
    const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
    const startBlockNumber = (await provider.getBlockNumber()) + 1;

    await expect(
      BiddersRewards.deploy(
        admin.address,
        yoloRegistry.address,
        1,
        nftTracker.address,
        yoloNFTPack.address
      )
    ).to.be.revertedWith("sender must be rewards factory");

    await expect(
      nftTracker.setBiddersRewardsContract(ZERO_ADDRESS)
    ).to.be.revertedWith("ZAA_BiddersRewards()");
    await expect(
      yoloNFTPack.setBiddersRewardsFactoryContract(ZERO_ADDRESS)
    ).to.be.revertedWith("rewards address cannot be zero");
  });

  it("Should deploy succesfully with bidders factory", async () => {
    const BiddersRewardsFactory = await ethers.getContractFactory(
      "BiddersRewardsFactory"
    );
    biddersRewardsFactory = await BiddersRewardsFactory.deploy(
      yoloRegistry.address
    );
    await yoloRegistry.setContract(
      getPackedEncodingNameHash(
        yoloConstants.Globals.ContractNames.BIDDERS_REWARDS_FACTORY
      ),
      [biddersRewardsFactory.address, 1, 1]
    );

    await yoloNFTPack.grantRole(
      HashedRoles.ADMIN_ROLE,
      biddersRewardsFactory.address
    );

    await nftTracker.grantRole(
      HashedRoles.ADMIN_ROLE,
      biddersRewardsFactory.address
    );

    await biddersRewardsFactory.rotateRewardsContracts(admin.address);

    const biddersRewardsAddress = await biddersRewardsFactory.rewardsAddresses(
      0
    );

    const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
    biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);
  });

  it("can set bidders rewards contract on tracker and NFT pack", async () => {
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

    const trackerStor = await provider.getStorageAt(nftTracker.address, 7);

    const packStor = await provider.getStorageAt(yoloNFTPack.address, 15);

    const expectedTrackerAddr = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      trackerStor
    )[0];

    const expectedPackAddr = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      packStor
    )[0];

    expect(expectedPackAddr).to.be.equal(biddersRewardsFactory.address);
    expect(expectedTrackerAddr).to.be.equal(biddersRewards.address);
  });
});
