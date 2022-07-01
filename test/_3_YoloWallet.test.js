const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");
const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toBN } = require("./utils/BNUtils");

const { getPackedEncodingNameHash } = require("./utils/helpers");

const yoloConstants = require("./constants");

// *** YoloWallet Contract Unit Test ***

const yoloWalletPresets = yoloConstants.TestPresets.YOLO_WALLET;

describe("YOLOrekt YoloWallet Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let stablecoinToken;
  let yoloWallet;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    const contracts = getContracts();

    stablecoinToken = contracts.stablecoinToken;
    yoloWallet = contracts.yoloWallet;
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("YoloWallet", () => {
    it("should revert if other user try updateLiquidityPoolBalance", async () => {
      await expect(
        yoloWallet.connect(bob).updateLiquidityPoolBalance(1)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          yoloConstants.Globals.HashedRoles.LIQUIDITY_POOL.toLowerCase() +
          "'"
      );
    });

    it("should revert if yoloWallet(not GameContract) calls gameUpdateUserBalance function", async () => {
      await expect(
        yoloWallet.gameUpdateUserBalance(
          bob.address,
          yoloWalletPresets.bobAmount
        )
      ).to.be.revertedWith("caller isnt approved game cntrct");
    });

    it("should revert if yoloWallet(not GameContract) calls gameReduceUserBalance function", async () => {
      await expect(
        yoloWallet.gameReduceUserBalance(
          bob.address,
          yoloWalletPresets.offsetAmount
        )
      ).to.be.revertedWith("caller isnt approved game cntrct");
    });

    it("should revert if yoloWallet(not GameContract) calls returnLiquidity function", async () => {
      await expect(
        yoloWallet.returnLiquidity(
          bob.address,
          yoloWalletPresets.offsetAmount,
          yoloWalletPresets.offsetAmount
        )
      ).to.be.revertedWith("caller isnt approved game cntrct");
    });

    it("should be able to withdraw by user", async () => {
      await stablecoinToken.transfer(bob.address, yoloWalletPresets.bobAmount);

      await stablecoinToken
        .connect(bob)
        .approve(yoloWallet.address, yoloWalletPresets.tokenTransferAmount);

      await yoloWallet.connect(bob).deposit(yoloWalletPresets.bobAmount);

      // await yoloWallet.adminUpdateUserBalances(
      //   [bob.address],
      //   [yoloWalletPresets.bobAmount],
      //   [false]
      // );
      await yoloWallet.connect(bob).withdraw(yoloWalletPresets.offsetAmount);

      expect(
        (await stablecoinToken.balanceOf(bob.address)).toString()
      ).to.be.equal(toBN(yoloWalletPresets.offsetAmount).toString());

      expect((await yoloWallet.balances(bob.address)).toString()).to.be.equal(
        toBN(
          yoloWalletPresets.bobAmount - yoloWalletPresets.offsetAmount
        ).toString()
      );
    });

    it("should revert if the withdraw amount is 0", async () => {
      await stablecoinToken.transfer(bob.address, yoloWalletPresets.bobAmount);

      await stablecoinToken
        .connect(bob)
        .approve(yoloWallet.address, yoloWalletPresets.tokenTransferAmount);

      await yoloWallet.connect(bob).deposit(yoloWalletPresets.bobAmount);

      await expect(yoloWallet.connect(bob).withdraw(0)).to.be.revertedWith(
        "amount must be greater than 0"
      );
    });

    it("should revert if the deposit amount is 0", async () => {
      await stablecoinToken.transfer(bob.address, yoloWalletPresets.bobAmount);

      await stablecoinToken
        .connect(bob)
        .approve(yoloWallet.address, yoloWalletPresets.tokenTransferAmount);

      await expect(yoloWallet.connect(bob).deposit(0)).to.be.revertedWith(
        "amount must be greater than 0"
      );
    });

    it("should revert if withdraw amount exceeds the balance", async () => {
      await stablecoinToken.transfer(bob.address, yoloWalletPresets.bobAmount);

      await stablecoinToken
        .connect(bob)
        .approve(yoloWallet.address, yoloWalletPresets.tokenTransferAmount);

      await yoloWallet.connect(bob).deposit(yoloWalletPresets.bobAmount);

      await expect(
        yoloWallet.connect(bob).withdraw(yoloWalletPresets.bobAmount + 1)
      ).to.be.revertedWith("withdraw amount exceeds balance");
    });

    it("allows user to set his name", async () => {
      await yoloWallet
        .connect(bob)
        .setUserNames(getPackedEncodingNameHash("Bob set by Bob"));

      expect(await yoloWallet.userNames(bob.address)).to.be.equal(
        getPackedEncodingNameHash("Bob set by Bob")
      );
    });

    it("should be set userNameChecks to true once the userName set", async () => {
      await yoloWallet
        .connect(bob)
        .setUserNames(getPackedEncodingNameHash("Bob set by Bob"));

      expect(
        await yoloWallet.userNameChecks(await yoloWallet.userNames(bob.address))
      ).to.be.equal(true);
    });

    it("should revert if username already exists", async () => {
      await yoloWallet
        .connect(bob)
        .setUserNames(getPackedEncodingNameHash("Bob set by admin"));

      expect(await yoloWallet.userNames(bob.address)).to.be.equal(
        getPackedEncodingNameHash("Bob set by admin")
      );

      await expect(
        yoloWallet.setUserNames(getPackedEncodingNameHash("Bob set by admin"))
      ).to.be.revertedWith("username already exists");
    });

    it("should revert if username is null", async () => {
      await expect(
        yoloWallet.setUserNames(ethers.constants.HashZero)
      ).to.be.revertedWith("username cannot be null value");
    });
  });
});
