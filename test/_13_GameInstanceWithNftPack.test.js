const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");

const { provider, BigNumber } = ethers;

const { deployContracts, getContracts } = require("./utils/deployUtils");

const { toBN, toUSDCAmount, bnOne } = require("./utils/BNUtils");

const yoloConstants = require("./constants");

const { getBlockAdvancerMethods } = require("./utils/helpers");
const { advanceBlocktime, advanceBlock } = getBlockAdvancerMethods(
  ethers.provider
);

// *** GameInstanceWithNFTPack Contract Unit Test ***

const {
  Math: { ZERO_BYTES32 },
  TestPresets: {
    Miner: { THREE_MINUTES, THIRTY_MINUTES, DEFAULT_MINE_TIME },
    YOLO_WALLET: yoloWalletPresets,
    GAME_INSTANCE: gameInstancePresets,
  },
  Globals: { HashedRoles },
} = yoloConstants;

describe("YOLOrekt GameInstanceWithNftPack Test", () => {
  let admin, alice, bob, random, treasury;

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

  let currentTime;
  let accounts;

  async function fixture() {
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
    gameETH_USD = contracts.gameETH_USD_W_NFT_Pack;
    gameDoge_USD = contracts.gameDoge_USD;

    currentTime = (await provider.getBlock()).timestamp;

    await gameETH_USD.unpause();
    await gameDoge_USD.unpause();
  }

  before(async () => {
    accounts = await ethers.getSigners();
    (admin = accounts[0]),
      (alice = accounts[1]),
      (bob = accounts[2]),
      (treasury = accounts[3]),
      (random = accounts[4]);

    // remove admin for iterated tests
    accounts = accounts.slice(1, 9);
  });

  describe("GameInstanceWithNft", () => {
    beforeEach(async function () {
      await loadFixture(fixture);
    });

    it("should have correct GAME_ID", async () => {
      const game1Pair = yoloConstants.Globals.GamePairHashes.ETH_USD;
      const game1PairLength = 70;

      expect(await gameETH_USD.GAME_ID()).to.be.equal(
        ethers.utils.solidityKeccak256(
          ["bytes32", "uint256"],
          [game1Pair, game1PairLength]
        )
      );
    });

    it("should have correct roundIndex", async () => {
      expect(await gameETH_USD.roundIndex()).to.be.equal(
        gameInstancePresets.roundIndexes[0]
      );
    });

    it("should have correct lpFeeRate", async () => {
      expect(await gameETH_USD.lpFeeRate()).to.be.equal(
        gameInstancePresets.initialLPFee
      );
    });

    it("should have correct lpAddress", async () => {
      expect(await gameETH_USD.lpAddress()).to.be.equal(liquidityPool.address);
    });

    it("should be pausable by game admin", async () => {
      await gameETH_USD.pause();
      expect(await gameETH_USD.paused()).to.be.equal(true);
    });

    it("should revert if other user try to pause", async () => {
      await expect(gameETH_USD.connect(bob).pause()).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.GAME_ADMIN_ROLE.toLowerCase() +
          "'"
      );
    });

    it("should be unpausable by game admin", async () => {
      await gameETH_USD.pause();
      await gameETH_USD.unpause();

      expect(await gameETH_USD.paused()).to.be.equal(false);
    });

    it("should revert if other user try to unpause", async () => {
      await expect(gameETH_USD.connect(bob).unpause()).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.GAME_ADMIN_ROLE.toLowerCase() +
          "'"
      );
    });

    it("should be available to update the LP Fee by game admin", async () => {
      await gameETH_USD.updateLpFee(
        toBN(gameInstancePresets.updatedLPFee).toString()
      );

      expect((await gameETH_USD.lpFeeRate()).toString()).to.be.equal(
        toBN(gameInstancePresets.updatedLPFee).toString()
      );
    });

    it("should revert if LP fee is out of bounds", async () => {
      await yoloRegistry.setGlobalParameters(
        ethers.utils.id("FEE_RATE_MIN"),
        gameInstancePresets.updatedFeeMin
      );

      await expect(
        gameETH_USD.updateLpFee(gameInstancePresets.updatedFeeMin - 1)
      ).to.be.revertedWith("fee must be within bounds");
    });

    it("should revert if other user try to updateLPFee", async () => {
      await expect(
        gameETH_USD.connect(bob).updateLpFee(gameInstancePresets.updatedLPFee)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.GAME_ADMIN_ROLE.toLowerCase() +
          "'"
      );
    });

    it("grant role test", async () => {
      const GAME_ADMIN_ROLE = ethers.utils.id("GAME_ADMIN");
      const DEFAULT_ADMIN_ROLE = ZERO_BYTES32;
      const ADMIN_ROLE = ethers.utils.id("ADMIN_ROLE");

      await gameFactory.grantRole(GAME_ADMIN_ROLE, bob.address);
      await expect(
        gameFactory.connect(bob).grantRole(GAME_ADMIN_ROLE, alice.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'"
      );
    });

    it("should update the settlementPrice of previous round data after process round by game admin", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      let roundData0 = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[0]
      );

      expect(roundData0.settlementPrice.toString()).to.be.equal(
        toBN(gameInstancePresets.processRound0.settlement).toString()
      );
    });

    it("should increase the roundIndex after process round by game admin", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      expect(await gameETH_USD.roundIndex()).to.be.equal(
        gameInstancePresets.roundIndexes[1]
      );
    });

    it("should update the startTime of the next round data after process round by game admin", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      const roundData1 = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[1]
      );

      expect(roundData1.startTime.toString()).to.be.equal(
        currentTime.toString()
      );
    });

    it("should update the strikePrice of the next round data after process round by game admin", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      let roundData1 = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[1]
      );

      expect(roundData1.strikePrice.toString()).to.be.equal(
        toBN(gameInstancePresets.processRound0.nextStrike).toString()
      );
    });

    it("should be able to process round if the block number is reached to game length", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      expect(await gameETH_USD.roundIndex()).to.be.equal(
        gameInstancePresets.roundIndexes[2]
      );
    });

    it("should revert if the block number did not reach to the game length", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await expect(
        gameETH_USD.processRound(
          currentTime,
          gameInstancePresets.processRound1.settlement,
          gameInstancePresets.processRound1.nextStrike
        )
      ).to.be.revertedWith("min duration for start required");
    });

    it("should revert if minimum settlement time not reached", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await expect(
        gameETH_USD.processRound(
          currentTime + 300,
          gameInstancePresets.processRound1.settlement,
          gameInstancePresets.processRound1.nextStrike
        )
      ).to.be.revertedWith("minimum game settlement time not reached");
    });

    it("should revert if the non admin user try to process round", async () => {
      await expect(
        gameETH_USD
          .connect(bob)
          .processRound(
            currentTime,
            gameInstancePresets.processRound0.settlement,
            gameInstancePresets.processRound0.nextStrike
          )
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.GAME_ADMIN_ROLE.toLowerCase() +
          "'"
      );
    });

    it("should revert if user bids in yolo when the game is paused", async () => {
      await gameETH_USD.pause();
      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            gameInstancePresets.bidAmount100,
            true,
            gameInstancePresets.roundIndexes[1]
          )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should revert if user try bid in yolo with previous or live bid round number", async () => {
      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            gameInstancePresets.bidAmount100,
            true,
            gameInstancePresets.roundIndexes[0]
          )
      ).to.be.revertedWith("cannot bid in live round");
    });

    it("should revert if user try bid in yolo in more than 10 rounds in advance", async () => {
      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            gameInstancePresets.bidAmount100,
            true,
            gameInstancePresets.boundaryBidRound + 1
          )
      ).to.be.revertedWith("cannot bid more than 10 rounds in advance");
    });

    it("should revert if user try bid in yolo with less than 25 tokens", async () => {
      const almostTwentyfiveTokens = toUSDCAmount(5).sub(bnOne).toString();

      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            almostTwentyfiveTokens,
            true,
            gameInstancePresets.roundIndexes[1]
          )
      ).to.be.revertedWith("5 USDC minimum bid");
    });

    it("should revert if user didnt approved the game contract via yolo token", async () => {
      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
            true,
            gameInstancePresets.roundIndexes[1]
          )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("should revert if user hasnt got enough yolo token for bidding the game contract", async () => {
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await expect(
        gameETH_USD
          .connect(bob)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
            true,
            gameInstancePresets.roundIndexes[1]
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("should revert if startTime exceeds max delay time", async () => {
      let lastBlockTime;

      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      lastBlockTime = (await provider.getBlock()).timestamp;
      const delayedStartTime =
        lastBlockTime + THIRTY_MINUTES + THREE_MINUTES + DEFAULT_MINE_TIME;

      await expect(
        gameETH_USD.processRound(
          delayedStartTime,
          gameInstancePresets.processRound0.settlement,
          gameInstancePresets.processRound0.nextStrike
        )
      ).to.be.revertedWith("startTime offset g.t. allowed");

      lastBlockTime = (await provider.getBlock()).timestamp;
      const maxStartTime = lastBlockTime + THIRTY_MINUTES + DEFAULT_MINE_TIME;

      await gameETH_USD.processRound(
        maxStartTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
    });

    it("should update yoloWallet contract yolo token balance once user bid", async () => {
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );

      expect(
        (await stablecoinToken.balanceOf(yoloWallet.address)).toString()
      ).to.be.equal(toUSDCAmount(gameInstancePresets.bidAmount100).toString());

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.transferAmount - gameInstancePresets.bidAmount100
        ).toString()
      );
    });

    it("should update round pool info once user bid", async () => {
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[1]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );

      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[1]
      );

      expect(roundPool.totalUserUp.toString()).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.bidAmount100 + gameInstancePresets.bidAmount100
        ).toString()
      );

      expect(roundPool.totalUserDown.toString()).to.be.equal(
        toUSDCAmount(gameInstancePresets.bidAmount200).toString()
      );

      expect(roundPool.upCount).to.be.equal(2);

      expect(roundPool.downCount).to.be.equal(1);
    });

    it("should not revert if no pending claims", async () => {
      await expect(
        gameETH_USD.connect(alice).claimReturns()
      ).to.be.revertedWith("no pending claims");
    });

    it("should not transfer token when user bid if there is already balance in yoloWallet contract", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.transferAmount - gameInstancePresets.bidAmount100
        ).toString()
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      await gameETH_USD.connect(bob).claimReturns();

      expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
        toUSDCAmount(gameInstancePresets.bidAmount100).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          4
        );

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.transferAmount - gameInstancePresets.bidAmount100
        ).toString()
      );
    });

    it("should maintain headIndex if there are unresolved bids", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[3]
        );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[3]
        );

      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        3
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      expect(await gameETH_USD.getUnclaimedRoundsLength(bob.address)).to.equal(
        3
      );

      await gameETH_USD.connect(bob).claimReturns();

      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        3
      );

      expect(await gameETH_USD.getUnclaimedRoundsLength(bob.address)).to.equal(
        2
      );
    });

    it("should able to collect fee to Liquidity Pool on processing round", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );
      const roundData = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[2]
      );
      const fee = roundPool.totalUserUp
        .mul(lpFeeRate)
        .div(10000)
        .add(roundPool.totalUserDown.mul(lpFeeRate).div(10000));

      console.log("fee amount", fee.toString());

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          fee.toString(),
          gameInstancePresets.processRound2.settlement,
        ]);

      // expect(roundData.fees.toString()).to.be.equal(fee.toString());

      expect(
        (await yoloWallet.balances(liquidityPool.address)).toString()
      ).to.be.equal(fee.toString());

      // expect(
      //   (
      //     await stablecoinToken.balanceOf(liquidityPool.address)
      //   ).toString()
      // ).to.be.equal(fee.toString());
    });

    it("should able to collect fee to Liquidity Pool on processing round (up wins)", async () => {
      const oneThird = yoloWalletPresets.oneThirdSplit;
      const theRest = yoloWalletPresets.splitRemainder;

      await yoloWallet.setTreasuryAddress(treasury.address);
      await yoloWallet.setTreasurySplit(oneThird);

      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );
      const roundData = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[2]
      );
      const fee = roundPool.totalUserUp
        .mul(lpFeeRate)
        .div(10000)
        .add(roundPool.totalUserDown.mul(lpFeeRate).div(10000));

      const upWinSettlementPrice =
        gameInstancePresets.processRound1.settlement + 1;

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          upWinSettlementPrice,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          fee.toString(),
          upWinSettlementPrice,
        ]);

      // expect(roundData.fees.toString()).to.be.equal(fee.toString());

      expect(
        (await yoloWallet.balances(treasury.address)).toString()
      ).to.be.equal(fee.mul(oneThird).div(10000).toString());
      expect(
        (await yoloWallet.balances(liquidityPool.address)).toString()
      ).to.be.equal(fee.mul(theRest).div(10000).toString());
    });

    it("should able to collect fee to Liquidity Pool on processing round (down wins)", async () => {
      const oneThird = yoloWalletPresets.oneThirdSplit;
      const theRest = yoloWalletPresets.splitRemainder;

      await yoloWallet.setTreasuryAddress(treasury.address);
      await yoloWallet.setTreasurySplit(oneThird);

      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );
      const roundData = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[2]
      );
      const fee = roundPool.totalUserUp
        .mul(lpFeeRate)
        .div(10000)
        .add(roundPool.totalUserDown.mul(lpFeeRate).div(10000));

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          fee.toString(),
          gameInstancePresets.processRound2.settlement,
        ]);

      // expect(roundData.fees.toString()).to.be.equal(fee.toString());

      expect(
        (await yoloWallet.balances(treasury.address)).toString()
      ).to.be.equal(fee.mul(oneThird).div(10000).toString());
      expect(
        (await yoloWallet.balances(liquidityPool.address)).toString()
      ).to.be.equal(fee.mul(theRest).div(10000).toString());
    });

    it("should calculate the payout correctly", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );
      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );
      const roundData = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[2]
      );

      const upFee = roundPool.totalUserUp.mul(lpFeeRate).div(10000);
      const downFee = roundPool.totalUserDown.mul(lpFeeRate).div(10000);

      const postYoloUp = roundPool.totalUserUp.sub(upFee);
      const postYoloDown = roundPool.totalUserDown.sub(downFee);

      const totalUserUp = roundPool.totalUserUp;
      const totalUserDown = roundPool.totalUserDown;

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          upFee.add(downFee).toString(),
          gameInstancePresets.processRound2.settlement,
        ]);

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      //bob rewards
      /**
       * totalUserUp = 100 + 100 = 200, totalUserDown = 200, upFee = 6, downFee = 6, postYoloUp = 194, postYoloDown = 194
       * bob reward = (bid.amount * postYoloDown) / totalUserUp + (bid.amount * (10000 - lpFeeRate) / 10000) = (100 * 194) / 200 + (100 * 97 / 100) = 194
       */

      const bobUpBidAmount = gameInstancePresets.bidAmount100;
      const bobPayoutAmount = postYoloDown
        .mul(bobUpBidAmount)
        .div(totalUserUp)
        .add((bobUpBidAmount * (10000 - lpFeeRate)) / 10000);

      expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
        toUSDCAmount(bobPayoutAmount.toString()).toString()
      );

      //alice rewards
      /**
       * totalUserUp = 100 + 100 = 200, totalUserDown = 200, upFee = 6, downFee = 6, postYoloUp = 194, postYoloDown = 194
       * alice reward = (bid.amount * postYoloDown) / totalUserUp + (bid.amount * (10000 - lpFeeRate) / 10000) = (100 * 194) / 200 + (100 * 97 / 100) = 194
       */
      const aliceUpBidAmount = gameInstancePresets.bidAmount100;
      const alicePayoutAmount = postYoloDown
        .mul(aliceUpBidAmount)
        .div(totalUserUp)
        .add((aliceUpBidAmount * (10000 - lpFeeRate)) / 10000);

      expect((await yoloWallet.balances(alice.address)).toString()).to.be.equal(
        toUSDCAmount(bobPayoutAmount.toString()).toString()
      );
    });

    it("should able to collect fee and liquidity back to Liquidity Pool on processing round (up wins)", async () => {
      const oneThird = yoloWalletPresets.oneThirdSplit;
      const theRest = yoloWalletPresets.splitRemainder;
      const maxApproveAmount = toUSDCAmount(
        gameInstancePresets.approveMAX
      ).toString();

      await yoloWallet.setLiquidityPool();

      await stablecoinToken.approve(liquidityPool.address, maxApproveAmount);
      await liquidityPool.mintInitialShares(maxApproveAmount);

      expect(await yoloWallet.balances(liquidityPool.address)).to.equal(
        maxApproveAmount
      );

      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);
      await liquidityPool.setMarketLimit(toUSDCAmount(98).toString());

      await gameETH_USD.acquireMarketLimit();

      await yoloWallet.setTreasuryAddress(treasury.address);
      await yoloWallet.setTreasurySplit(oneThird);

      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(gameETH_USD.address, maxApproveAmount);
      await stablecoinToken
        .connect(alice)
        .approve(gameETH_USD.address, maxApproveAmount);
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD.makeMarketBid(gameInstancePresets.roundIndexes[2], [
        toUSDCAmount(10).toString(),
        toUSDCAmount(20).toString(),
      ]);

      const postLiquidityBalance = toUSDCAmount(gameInstancePresets.approveMAX)
        .sub(toUSDCAmount(10).add(toUSDCAmount(20)))
        .toString();
      expect(await yoloWallet.balances(liquidityPool.address)).to.equal(
        postLiquidityBalance
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );
      const roundData = await gameETH_USD.roundDatas(
        gameInstancePresets.roundIndexes[2]
      );
      const fee = roundPool.totalUserDown
        .add(roundPool.downLiquidity)
        .add(roundPool.totalUserUp)
        .add(roundPool.upLiquidity)
        .mul(lpFeeRate)
        .div(10000);

      const providersReturn = roundPool.upLiquidity
        .mul(roundPool.totalUserDown.add(roundPool.downLiquidity))
        .div(roundPool.upLiquidity.add(roundPool.totalUserUp))
        .add(roundPool.upLiquidity)
        .mul(BigNumber.from(10000).sub(lpFeeRate))
        .div(10000);

      const upWinSettlementPrice =
        gameInstancePresets.processRound1.settlement + 10000;

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          upWinSettlementPrice,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          fee.toString(),
          upWinSettlementPrice,
        ]);

      console.log("providers return:", providersReturn);

      expect(
        (await yoloWallet.balances(treasury.address)).toString()
      ).to.be.equal(fee.mul(oneThird).div(10000).toString());
      expect(
        (await yoloWallet.balances(liquidityPool.address)).toString()
      ).to.be.equal(
        fee
          .mul(theRest)
          .div(10000)
          .add(postLiquidityBalance)
          .add(providersReturn)
          .toString()
      );
    });

    it("should calculate the payout correctly after changing the LPfee", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );
      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      ).to.emit(yoloWallet, "LiquidityReturn");

      // const lpFeeRate = await gameETH_USD.lpFeeRate();
      // const roundPool = await gameETH_USD.gamePools(2);
      // const roundData = await gameETH_USD.roundDatas(2);

      // const upFee = roundPool.totalUserUp.mul(lpFeeRate).div(10000);
      // const downFee = roundPool.totalUserDown.mul(lpFeeRate).div(10000);

      // const postYoloUp = roundPool.totalUserUp.sub(upFee);
      // const postYoloDown = roundPool.totalUserDown.sub(downFee);

      //bob rewards
      /**
       * totalUserUp = 100 + 100 = 200, totalUserDown = 200, upFee = 10, downFee = 10, postYoloUp = 190, postYoloDown = 190
       * bob reward = (bid.amount * postYoloDown) / totalUserUp + (bid.amount * (10000 - lpFeeRate) / 10000) = (100 * 190) / 200 + (100 * 95 / 100) = 190
       */
      //   const bobPayoutAmount = toUSDCAmount(190);
      //   expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
      //     bobPayoutAmount.toString()
      //   );

      //alice rewards
      /**
       * totalUserUp = 100 + 100 = 200, totalUserDown = 200, upFee = 10, downFee = 10, postYoloUp = 190, postYoloDown = 190
       * bob reward = (bid.amount * postYoloDown) / totalUserUp + (bid.amount * (10000 - lpFeeRate) / 10000) = (100 * 190) / 200 + (100 * 95 / 100) = 190
       */
      //   const alicePayoutAmount = toUSDCAmount(190);
      //   expect((await yoloWallet.balances(alice.address)).toString()).to.be.equal(
      //     alicePayoutAmount.toString()
      //   );
    });

    // it("should be able to batch bid in yolo by game admin", async () => {
    //   await gameETH_USD.processRound(
    //     currentTime,
    //     gameInstancePresets.processRound0.settlement,
    //     gameInstancePresets.processRound0.nextStrike
    //   );
    //   await stablecoinToken
    //     .connect(bob)
    //     .approve(
    //       gameETH_USD.address,
    //       toUSDCAmount(gameInstancePresets.approveMAX).toString()
    //     );
    //   await stablecoinToken
    //     .connect(alice)
    //     .approve(
    //       gameETH_USD.address,
    //       toUSDCAmount(gameInstancePresets.approveMAX).toString()
    //     );
    //   await stablecoinToken.transfer(
    //     bob.address,
    //     toUSDCAmount(gameInstancePresets.transferAmount).toString()
    //   );
    //   await stablecoinToken.transfer(
    //     alice.address,
    //     toUSDCAmount(gameInstancePresets.transferAmount).toString()
    //   );
    //   await yoloNFTPack.batchMint([bob.address, alice.address]);

    //   await gameETH_USD.batchBidInYolo(
    //     [
    //       toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
    //       toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
    //       toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
    //     ],
    //     [true, false, true],
    //     gameInstancePresets.roundIndexes[2],
    //     [bob.address, alice.address, alice.address]
    //   );

    //   await gameETH_USD.processRound(
    //     currentTime + THREE_MINUTES,
    //     gameInstancePresets.processRound1.settlement,
    //     gameInstancePresets.processRound1.nextStrike
    //   );

    //   await advanceBlocktime(THREE_MINUTES);

    //   await gameETH_USD.processRound(
    //     currentTime + 360,
    //     gameInstancePresets.processRound2.settlement,
    //     gameInstancePresets.processRound2.nextStrike
    //   );

    //   const bobPayoutAmount = toUSDCAmount(194);
    //   expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
    //     bobPayoutAmount.toString()
    //   );

    //   const alicePayoutAmount = toUSDCAmount(194);

    //   expect((await yoloWallet.balances(alice.address)).toString()).to.be.equal(
    //     alicePayoutAmount.toString()
    //   );
    // }).skip();

    // it("should revert if other user try batch bid in yolo", async () => {
    //   await expectRevert(
    //     gameETH_USD
    //       .connect(bob)
    //       .batchBidInYolo(
    //         [
    //           gameInstancePresets.bidAmount100,
    //           gameInstancePresets.bidAmount100,
    //         ],
    //         [true, false],
    //         2,
    //         [bob.address, alice.address]
    //       ),
    //     "must have authorization"
    //   );
    // }).skip();

    // it("should revert if bot length is less than 1", async () => {
    //   await expectRevert(
    //     gameETH_USD.batchBidInYolo([], [], 2, []),
    //     "There should at least one bot address"
    //   );
    // }).skip();

    // it("should revert if arr length is different", async () => {
    //   await expectRevert(
    //     gameETH_USD.batchBidInYolo(
    //       [
    //         gameInstancePresets.bidAmount100,
    //         gameInstancePresets.bidAmount100,
    //       ],
    //       [true],
    //       2,
    //       [bob.address, alice.address]
    //     ),
    //     "argument array length mismatch"
    //   );
    // }).skip();
  });

  describe("Tests with bidding setup", async () => {
    async function bidSetupFixture() {
      await loadFixture(fixture);

      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await stablecoinToken.approve(
        liquidityPool.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await liquidityPool.approve(
        admin.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await yoloWallet.setLiquidityPool();

      await liquidityPool.mintInitialShares(toUSDCAmount(10000).toString());

      await liquidityPool.setMarketLimit(5);

      await gameETH_USD.acquireMarketLimit();

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.largeTransfer).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.largeTransfer).toString()
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.largeTransfer).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.largeTransfer).toString()
      );

      await stablecoinToken.approve(
        liquidityPool.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await liquidityPool.approve(
        admin.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );
    }

    beforeEach(async function () {
      await loadFixture(bidSetupFixture);
    });

    it("user can claim 250 rounds", async () => {
      let range = 250 / 10;

      // start bidding from round 2
      for (let j = 0; j < range; j++) {
        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD.makeMarketBid(i, [1, 2]);
        }

        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD
            .connect(bob)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[1]).toString(),
              false,
              i
            );

          await gameETH_USD
            .connect(alice)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[2]).toString(),
              true,
              i
            );
        }

        const currentTime = +(await provider.getBlock()).timestamp;
        for (let i = 1; i <= 10; i++) {
          await advanceBlock(THREE_MINUTES);
          let startTime = currentTime + THREE_MINUTES * i;

          await gameETH_USD.processRound(
            startTime,
            gameInstancePresets.processRound0.settlement,
            gameInstancePresets.processRound0.nextStrike
          );
        }
        await advanceBlock(THREE_MINUTES);
      }

      console.log(
        "estimate all winner claims",
        (await gameETH_USD.connect(bob).estimateGas.claimReturns()).toString()
      );

      console.log(
        "estimate all loser claims",
        (await gameETH_USD.connect(alice).estimateGas.claimReturns()).toString()
      );

      // remove unprocessed round
      await advanceBlock(THREE_MINUTES);
      const startTime = +(await provider.getBlock()).timestamp + THREE_MINUTES;
      await gameETH_USD.processRound(
        startTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      expect(
        (await gameETH_USD.bidsManager(alice.address)).unsettledBidCount
      ).to.be.equal(0);
      expect(
        (await gameETH_USD.bidsManager(bob.address)).unsettledBidCount
      ).to.be.equal(0);
      expect(
        (await gameETH_USD.bidsManager(alice.address)).headIdx
      ).to.be.equal(0);
      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        0
      );
    });

    it("user can claim more than 250 rounds in 2 steps", async () => {
      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);
      let range = 251 / 10;

      console.log(
        "market bid est gas:",
        await gameETH_USD.estimateGas.makeMarketBid(2, [1, 2])
      );

      for (let j = 0; j < range; j++) {
        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD.makeMarketBid(i, [1, 2]);
        }

        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD
            .connect(bob)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[1]).toString(),
              false,
              i
            );

          await gameETH_USD
            .connect(alice)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[2]).toString(),
              true,
              i
            );
        }

        const currentTime = +(await provider.getBlock()).timestamp;
        for (let i = 1; i <= 10; i++) {
          await advanceBlock(THREE_MINUTES);
          let startTime = currentTime + THREE_MINUTES * i;

          await gameETH_USD.processRound(
            startTime,
            gameInstancePresets.processRound0.settlement,
            gameInstancePresets.processRound0.nextStrike
          );
        }
      }

      // remove unprocessed round
      await advanceBlock(THREE_MINUTES);
      const startTime = +(await provider.getBlock()).timestamp + THREE_MINUTES;
      console.log(
        "estimate process round: ",
        await gameETH_USD.estimateGas.processRound(
          startTime,
          gameInstancePresets.processRound0.settlement,
          gameInstancePresets.processRound0.nextStrike
        )
      );
      await gameETH_USD.processRound(
        startTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      expect(
        (await gameETH_USD.bidsManager(alice.address)).unsettledBidCount
      ).to.be.equal(10);
      expect(
        (await gameETH_USD.bidsManager(bob.address)).unsettledBidCount
      ).to.be.equal(10);
      expect(
        (await gameETH_USD.bidsManager(alice.address)).headIdx
      ).to.be.equal(20);
      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        19
      );

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      expect(
        (await gameETH_USD.bidsManager(alice.address)).unsettledBidCount
      ).to.be.equal(0);
      expect(
        (await gameETH_USD.bidsManager(bob.address)).unsettledBidCount
      ).to.be.equal(0);
      expect(
        (await gameETH_USD.bidsManager(alice.address)).headIdx
      ).to.be.equal(0);
      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        0
      );
    });

    it("user can claim more than 250 rounds with an unprocessed round in 2 steps", async () => {
      let range = 251 / 10;

      for (let j = 0; j < range; j++) {
        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD.makeMarketBid(i, [1, 2]);
        }

        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD
            .connect(bob)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[1]).toString(),
              false,
              i
            );

          await gameETH_USD
            .connect(alice)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[2]).toString(),
              true,
              i
            );
        }

        const currentTime = +(await provider.getBlock()).timestamp;
        for (let i = 1; i <= 10; i++) {
          await advanceBlock(THREE_MINUTES);
          let startTime = currentTime + THREE_MINUTES * i;

          await gameETH_USD.processRound(
            startTime,
            gameInstancePresets.processRound0.settlement,
            gameInstancePresets.processRound0.nextStrike
          );
        }
      }

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      expect(
        (await gameETH_USD.bidsManager(alice.address)).unsettledBidCount
      ).to.be.equal(11);
      expect(
        (await gameETH_USD.bidsManager(bob.address)).unsettledBidCount
      ).to.be.equal(11);
      expect(
        (await gameETH_USD.bidsManager(alice.address)).headIdx
      ).to.be.equal(520);
      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        519
      );

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();

      expect(
        (await gameETH_USD.bidsManager(alice.address)).unsettledBidCount
      ).to.be.equal(1);
      expect(
        (await gameETH_USD.bidsManager(bob.address)).unsettledBidCount
      ).to.be.equal(1);
      expect(
        (await gameETH_USD.bidsManager(alice.address)).headIdx
      ).to.be.equal(520);
      expect((await gameETH_USD.bidsManager(bob.address)).headIdx).to.be.equal(
        519
      );
    });

    it("user bid 250 times in one round", async () => {
      await gameETH_USD.makeMarketBid(2, [1, 2]);

      for (let i = 0; i < 250; i++) {
        await gameETH_USD
          .connect(alice)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
            true,
            gameInstancePresets.roundIndexes[2]
          );
      }

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      console.log(
        "estimate claim",
        (await gameETH_USD.connect(alice).estimateGas.claimReturns()).toString()
      );

      await gameETH_USD.connect(alice).claimReturns();
    });
  });

  describe("GameInstanceWithNftPack", () => {
    async function transferToAliceSetup() {
      await loadFixture(fixture);

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );
    }

    beforeEach(async function () {
      await loadFixture(transferToAliceSetup);
    });

    it("Should correct bid", async () => {
      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[1]
        );
    });

    it("Should fail bid with no error", async () => {
      await expect(
        gameETH_USD
          .connect(random)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
            true,
            gameInstancePresets.roundIndexes[0]
          )
      ).to.be.revertedWith("cannot bid in live round");
    });

    it("Should bid with shortfall amount", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.transferAmount - gameInstancePresets.bidAmount100
        ).toString()
      );

      await advanceBlocktime(THREE_MINUTES);
      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      await gameETH_USD.connect(bob).claimReturns();

      expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
        toUSDCAmount(gameInstancePresets.bidAmount100).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount200).toString(),
          true,
          4
        );

      expect(
        (await stablecoinToken.balanceOf(yoloWallet.address)).toString()
      ).to.be.equal(toUSDCAmount(gameInstancePresets.bidAmount200).toString());

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(
        toUSDCAmount(
          gameInstancePresets.transferAmount - gameInstancePresets.bidAmount200
        ).toString()
      );
    });

    // TODO: expected returns test with users AND liquidity
    it("Should correct market making bid", async () => {
      await stablecoinToken.approve(
        gameETH_USD.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await stablecoinToken.approve(
        liquidityPool.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await yoloWallet.setLiquidityPool();

      await liquidityPool.mintInitialShares(toUSDCAmount(10000).toString());

      await liquidityPool.setMarketLimit(250);

      await gameETH_USD.acquireMarketLimit();

      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await gameETH_USD.makeMarketBid(gameInstancePresets.roundIndexes[1], [
        gameInstancePresets.bidAmount100,
        gameInstancePresets.bidAmount100,
      ]);
    });

    it("Should fail because of market limit market making bid", async () => {
      await stablecoinToken
        .connect(admin)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await expect(
        gameETH_USD
          .connect(admin)
          .makeMarketBid(gameInstancePresets.roundIndexes[1], [
            gameInstancePresets.bidAmount100,
            gameInstancePresets.bidAmount200,
          ])
      ).to.be.revertedWith("amount exceeds limit");
    });

    it("Should fail market making bid in live round", async () => {
      await stablecoinToken
        .connect(admin)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        admin.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await expect(
        gameETH_USD
          .connect(admin)
          .makeMarketBid(gameInstancePresets.roundIndexes[0], [
            gameInstancePresets.bidAmount100,
            gameInstancePresets.bidAmount200,
          ])
      ).to.be.revertedWith("cannot bid in live round");
    });

    it("Should fail market making bid in more than 10 rounds ahead", async () => {
      await stablecoinToken
        .connect(admin)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        admin.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await expect(
        gameETH_USD
          .connect(admin)
          .makeMarketBid(20, [
            gameInstancePresets.bidAmount100,
            gameInstancePresets.bidAmount200,
          ])
      ).to.be.revertedWith("cannot bid more than 10 rounds in advance");
    });

    it("Should test when down wins", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          false,
          gameInstancePresets.roundIndexes[3]
        );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          false,
          gameInstancePresets.roundIndexes[4]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[4]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[3]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + THREE_MINUTES,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 540,
        gameInstancePresets.processRound3.settlement,
        gameInstancePresets.processRound3.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 720,
        gameInstancePresets.processRound4.settlement,
        gameInstancePresets.processRound4.nextStrike
      );

      // TODO: missing assertions on user returns
    });

    it("user can claim 200 rounds", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await stablecoinToken.approve(
        liquidityPool.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await liquidityPool.approve(
        admin.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await yoloWallet.setLiquidityPool();

      await liquidityPool.mintInitialShares(toUSDCAmount(10000).toString());

      await liquidityPool.setMarketLimit(5);

      await gameETH_USD.acquireMarketLimit();

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.largeTransfer).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.largeTransfer).toString()
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.largeTransfer).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.largeTransfer).toString()
      );

      let range = 250 / 10;

      for (let j = 0; j < range; j++) {
        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD.makeMarketBid(i, [1, 2]);
        }

        for (let i = 2 + j * 10; i < 12 + j * 10; i++) {
          await gameETH_USD
            .connect(bob)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[1]).toString(),
              false,
              i
            );

          await gameETH_USD
            .connect(alice)
            .bidInYolo(
              toUSDCAmount(gameInstancePresets.bidAmounts[2]).toString(),
              true,
              i
            );
        }

        const currentTime = +(await provider.getBlock()).timestamp;
        for (let i = 1; i <= 10; i++) {
          await advanceBlock(THREE_MINUTES);
          let startTime = currentTime + THREE_MINUTES * i;

          await gameETH_USD.processRound(
            startTime,
            gameInstancePresets.processRound0.settlement,
            gameInstancePresets.processRound0.nextStrike
          );
        }
        await advanceBlock(THREE_MINUTES);
      }

      console.log(
        "estimate all winner claims",
        (await gameETH_USD.connect(bob).estimateGas.claimReturns()).toString()
      );

      console.log(
        "estimate all loser claims",
        (await gameETH_USD.connect(alice).estimateGas.claimReturns()).toString()
      );

      await gameETH_USD.connect(alice).claimReturns();
      await gameETH_USD.connect(bob).claimReturns();
    });

    it("user bid 250 times in one round", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );
      await gameETH_USD.grantRole(HashedRoles.MARKET_MAKER_ROLE, admin.address);

      await stablecoinToken.approve(
        liquidityPool.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await liquidityPool.approve(
        admin.address,
        toUSDCAmount(gameInstancePresets.approveMAX).toString()
      );

      await yoloWallet.setLiquidityPool();

      await liquidityPool.mintInitialShares(toUSDCAmount(10000).toString());

      await liquidityPool.setMarketLimit(5);

      await gameETH_USD.acquireMarketLimit();

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.largeTransfer).toString()
        );

      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.largeTransfer).toString()
      );

      await gameETH_USD.makeMarketBid(2, [1, 2]);

      for (let i = 0; i < 250; i++) {
        await gameETH_USD
          .connect(alice)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
            true,
            gameInstancePresets.roundIndexes[2]
          );
      }

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      await gameETH_USD.processRound(
        currentTime + 360,
        gameInstancePresets.processRound2.settlement,
        gameInstancePresets.processRound2.nextStrike
      );

      console.log(
        "estimate claim",
        (await gameETH_USD.connect(alice).estimateGas.claimReturns()).toString()
      );

      await gameETH_USD.connect(alice).claimReturns();
    });

    // TODO: calculate same with down wins
    it("should calculate payout to multiple participants correctly - up wins", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      const approves = accounts.map((account) =>
        stablecoinToken
          .connect(account)
          .approve(
            gameETH_USD.address,
            toUSDCAmount(gameInstancePresets.approveMAX).toString()
          )
      );

      await Promise.all(approves);

      const transfers = accounts.map((account, idx) =>
        stablecoinToken.transfer(
          account.address,
          toUSDCAmount(gameInstancePresets.transferAmount).toString()
        )
      );

      await Promise.all(transfers);

      const bids = accounts.map((account, idx) =>
        gameETH_USD
          .connect(account)
          .bidInYolo(
            toUSDCAmount(gameInstancePresets.bidAmounts[idx]).toString(),
            idx % 2 ? true : false,
            gameInstancePresets.roundIndexes[2]
          )
      );

      await Promise.all(bids);

      // TODO: have a user make an extra bid on same side and one on different side
      // have her make an extra bid
      // await gameETH_USD
      //   .connect(alice)
      //   .bidInYolo(
      //     toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
      //     true,
      //     gameInstancePresets.roundIndexes[2]
      //   );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );
      await advanceBlocktime(THREE_MINUTES);

      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );

      const upFee = roundPool.totalUserUp.mul(lpFeeRate).div(10000);
      const downFee = roundPool.totalUserDown.mul(lpFeeRate).div(10000);

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          upFee.add(downFee).toString(),
          gameInstancePresets.processRound2.settlement,
        ]);

      // await gameETH_USD.connect(alice).claimReturns();
      // await gameETH_USD.connect(bob).claimReturns();

      // TODO: use big number for fee arithmetic
      // up wins
      const calculateUpWinPayout = async (idx) => {
        const roundPool = await gameETH_USD.gamePools(
          gameInstancePresets.roundIndexes[2]
        );
        const lpFeeRate = (await gameETH_USD.roundDatas(2)).lpFeeRate;

        const upFee = roundPool.totalUserUp.mul(lpFeeRate).div(10000);
        const downFee = roundPool.totalUserDown.mul(lpFeeRate).div(10000);

        const postYoloUp = roundPool.totalUserUp.sub(upFee);
        const postYoloDown = roundPool.totalUserDown.sub(downFee);

        const totalUserUp = roundPool.totalUserUp;
        const totalUserDown = roundPool.totalUserDown;

        const accountBidAmount = toUSDCAmount(
          gameInstancePresets.bidAmounts[idx]
        ).toString();

        const isBidUp = idx % 2 ? true : false;

        let payout;

        if (
          gameInstancePresets.processRound2.settlement >
            gameInstancePresets.processRound1.nextStrike &&
          isBidUp
        ) {
          payout = postYoloDown
            .mul(accountBidAmount)
            .div(totalUserUp)
            .add(
              BigNumber.from(accountBidAmount)
                .mul(BigNumber.from(10000).sub(lpFeeRate))
                .div(BigNumber.from(10000))
            )
            .toString();
        } else {
          payout = "0";
        }
        return payout;
      };

      // //bob rewards
      // /**
      //  * totalUserUp = 100 + 100 = 200, totalUserDown = 200, upFee = 6, downFee = 6, postYoloUp = 194, postYoloDown = 194
      //  * bob reward = (bid.amount * postYoloDown) / totalUserUp + (bid.amount * (10000 - lpFeeRate) / 10000) = (100 * 194) / 200 + (100 * 97 / 100) = 194
      //  */

      const balancesBeforeClaimPromises = accounts.map(async (account) => {
        return await await yoloWallet.balances(account.address);
      });

      const balancesBeforeClaim = await Promise.all(
        balancesBeforeClaimPromises
      );

      const claims = accounts.map((account, idx) =>
        gameETH_USD.connect(account).claimReturns()
      );

      await Promise.all(claims);

      const balancesAfterClaimPromises = accounts.map(async (account) => {
        return await await yoloWallet.balances(account.address);
      });

      const balancesAfterClaim = await Promise.all(balancesAfterClaimPromises);

      const acc = accounts.map(async (undf, idx) => {
        const expectedPayout = await calculateUpWinPayout(idx);

        expect(balancesAfterClaim[idx].toString()).to.equal(
          balancesBeforeClaim[idx].add(expectedPayout).toString()
        );
      });

      await Promise.all(acc);
    });

    it("Should fail with minimum game time settlement ", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );
      await expect(
        gameETH_USD.processRound(
          currentTime,
          gameInstancePresets.processRound1.settlement,
          gameInstancePresets.processRound1.nextStrike
        )
      ).to.be.revertedWith("min duration for start required");
    });

    it("Should expect fee for current round to not change after updating lpfee", async () => {
      await gameETH_USD.processRound(
        currentTime,
        gameInstancePresets.processRound0.settlement,
        gameInstancePresets.processRound0.nextStrike
      );

      await stablecoinToken
        .connect(bob)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken
        .connect(alice)
        .approve(
          gameETH_USD.address,
          toUSDCAmount(gameInstancePresets.approveMAX).toString()
        );

      await stablecoinToken.transfer(
        bob.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await stablecoinToken.transfer(
        alice.address,
        toUSDCAmount(gameInstancePresets.transferAmount).toString()
      );

      await gameETH_USD
        .connect(bob)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          false,
          gameInstancePresets.roundIndexes[2]
        );

      await gameETH_USD
        .connect(alice)
        .bidInYolo(
          toUSDCAmount(gameInstancePresets.bidAmount100).toString(),
          true,
          gameInstancePresets.roundIndexes[2]
        );

      expect((await gameETH_USD.lpFeeRate()).toString()).to.be.equal(
        toBN(gameInstancePresets.initialLPFee).toString()
      );

      await advanceBlocktime(THREE_MINUTES);

      const secondRoundStartTime = currentTime + THREE_MINUTES;
      await gameETH_USD.processRound(
        secondRoundStartTime,
        gameInstancePresets.processRound1.settlement,
        gameInstancePresets.processRound1.nextStrike
      );

      await advanceBlocktime(THREE_MINUTES);

      //calculate fees
      const lpFeeRate = await gameETH_USD.lpFeeRate();
      const roundPool = await gameETH_USD.gamePools(
        gameInstancePresets.roundIndexes[2]
      );

      const fee = roundPool.totalUserUp
        .mul(lpFeeRate)
        .div(10000)
        .add(roundPool.totalUserDown.mul(lpFeeRate).div(10000));

      await gameETH_USD.updateLpFee(
        toBN(gameInstancePresets.updatedLPFee).toString()
      );

      expect((await gameETH_USD.lpFeeRate()).toString()).to.be.equal(
        toBN(gameInstancePresets.updatedLPFee).toString()
      );

      await expect(
        gameETH_USD.processRound(
          currentTime + 360,
          gameInstancePresets.processRound2.settlement,
          gameInstancePresets.processRound2.nextStrike
        )
      )
        .to.emit(gameETH_USD, "RoundSettled")
        .withArgs(2, [
          secondRoundStartTime,
          300,
          gameInstancePresets.processRound1.nextStrike,
          fee.toString(),
          gameInstancePresets.processRound2.settlement,
        ]);
    });

    it("Should fail with args g.t. 0", async () => {
      await expect(
        gameETH_USD.processRound(currentTime, 0, 0)
      ).to.be.revertedWith("args must be g.t. 0");
    });
  });
});
