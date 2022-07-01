const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");
const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toBN, bnZero } = require("./utils/BNUtils");

const provider = ethers.provider;
const { BigNumber } = ethers;

const yoloConstants = require("./constants");

// *** WhitelistSFTClaims Contract Unit Test ***
const {
  TestPresets: {
    NFT_CLAIMS: nftClaimsPresets,
    NFT_TRACKER: yoloNFTTrackerPresets,
  },
  Globals: {
    HashedRoles,
    DeployedContractAddresses: { USDC_ADDRESS },
  },
} = yoloConstants;

describe("YOLOrekt WhitelistSFTClaims Test", () => {
  //  *** Addresses ***

  let admin, alice, bob;

  //  *** Contracts ***
  let yoloNFTPack;
  let whitelistClaims;
  let stablecoinToken;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    await deployContracts(admin);

    const contracts = getContracts();

    yoloNFTPack = contracts.yoloNFTPack;
    whitelistClaims = contracts.whitelistClaims;
    stablecoinToken = contracts.stablecoinToken;
  }

  const setUSDCTokenBalance = async (userAddress) => {
    if (process.env.IS_FORK === "true") {
      // ABI Encode the first level of the mapping
      // abi.encode(address(TOKEN0), uint256(MAPPING_SLOT))
      // The keccak256 of this value will be the "slot" of the  mapping
      const abiCoder = new ethers.utils.AbiCoder();

      const firstLevelEncoded = abiCoder.encode(
        ["address", "uint256"],
        [userAddress, 0]
      );

      // keccak256(abi.encode(address(TOKEN), uint256(MAPPING_SLOT)))
      const slot = ethers.utils.keccak256(firstLevelEncoded);

      // console.log(
      //   "before usdc bal",
      //   await provider.getStorageAt(USDC_ADDRESS, slot)
      // );

      await network.provider.send("hardhat_setStorageAt", [
        USDC_ADDRESS,
        slot,
        abiCoder.encode(
          ["bytes32"],
          [
            ethers.utils.hexZeroPad(
              ethers.utils.hexValue(BigNumber.from(10e6)),
              32
            ),
          ]
        ),
      ]);

      // console.log(
      //   "after usdc bal",
      //   await provider.getStorageAt(USDC_ADDRESS, slot)
      // );}
    } else {
      await stablecoinToken.transfer(userAddress, (10e6).toFixed());
    }
  };

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("WhitelistSFTClaims", () => {
    it("should revert if expire time is not set", async () => {
      await expect(whitelistClaims.connect(bob).claimNft()).to.be.revertedWith(
        "invalid claim"
      );
    });

    it("should able to batchOffer by admin", async () => {
      await whitelistClaims.batchOffer(
        [bob.address, alice.address],
        nftClaimsPresets.expireTime
      );
      const { timestamp } = await ethers.provider.getBlock();

      expect(
        (await whitelistClaims.claimeesRegister(bob.address)).toString()
      ).to.be.equal(toBN(timestamp + nftClaimsPresets.expireTime).toString());

      expect(
        (await whitelistClaims.claimeesRegister(alice.address)).toString()
      ).to.be.equal(toBN(timestamp + nftClaimsPresets.expireTime).toString());
    });

    it("should revert if whitelistClaims hasn't got minter role", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(yoloNFTTrackerPresets.level1Id, 2);
      await setUSDCTokenBalance(alice.address);
      await setUSDCTokenBalance(bob.address);

      await whitelistClaims.batchOffer(
        [bob.address, alice.address],
        nftClaimsPresets.expireTime
      );

      await stablecoinToken
        .connect(alice)
        .approve(whitelistClaims.address, toBN(10, 7).toString());
      await stablecoinToken
        .connect(bob)
        .approve(whitelistClaims.address, toBN(10, 7).toString());

      await await expect(
        whitelistClaims.connect(bob).claimNft()
      ).to.be.revertedWith(
        `VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${whitelistClaims.address.toLowerCase()} is missing role ${
          HashedRoles.MINTER_ROLE
        }'`
      );
    });

    it("should revert if whitelistClaims hasn't got allowance of USDC token", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(yoloNFTTrackerPresets.level1Id, 2);
      await setUSDCTokenBalance(alice.address);

      await whitelistClaims.batchOffer(
        [alice.address],
        nftClaimsPresets.expireTime
      );

      if (process.env.IS_FORK === "true") {
        await expect(
          whitelistClaims.connect(alice).claimNft()
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
      } else {
        await expect(
          whitelistClaims.connect(alice).claimNft()
        ).to.be.revertedWith("ERC20: insufficient allowance");
      }
    });

    it("should mint NFT to user once minted", async () => {
      await yoloNFTPack.grantRole(
        HashedRoles.MINTER_ROLE,
        whitelistClaims.address
      );
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(yoloNFTTrackerPresets.level1Id, 2);
      await setUSDCTokenBalance(alice.address);

      await whitelistClaims.batchOffer(
        [alice.address],
        nftClaimsPresets.expireTime
      );

      await stablecoinToken
        .connect(alice)
        .approve(whitelistClaims.address, toBN(10, 7).toString());

      expect(await yoloNFTPack.usersTokens(alice.address)).to.be.equal("0");

      await whitelistClaims.connect(alice).claimNft();

      expect(await yoloNFTPack.usersTokens(alice.address)).to.be.above("0");
    });

    it("should transfer 10 USDC dollars to the contract on claimNft", async () => {
      await yoloNFTPack.grantRole(
        HashedRoles.MINTER_ROLE,
        whitelistClaims.address
      );
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(yoloNFTTrackerPresets.level1Id, 2);
      await setUSDCTokenBalance(alice.address);

      await whitelistClaims.batchOffer(
        [alice.address],
        nftClaimsPresets.expireTime
      );

      await stablecoinToken
        .connect(alice)
        .approve(whitelistClaims.address, toBN(10, 7).toString());

      // await whitelistClaims.connect(alice).claimNft();
      await expect(() =>
        whitelistClaims.connect(alice).claimNft()
      ).to.changeTokenBalances(
        stablecoinToken,
        [alice, whitelistClaims],
        [-10000000, 10000000]
      );
    });

    it("should clear the expire time once user claimNft", async () => {
      await yoloNFTPack.grantRole(
        HashedRoles.MINTER_ROLE,
        whitelistClaims.address
      );
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(yoloNFTTrackerPresets.level1Id, 2);
      await setUSDCTokenBalance(alice.address);

      const blockTimestamp = (await provider.getBlock()).timestamp + 1;

      await whitelistClaims.batchOffer(
        [alice.address, bob.address],
        nftClaimsPresets.expireTime
      );

      expect(await whitelistClaims.claimeesRegister(alice.address)).to.be.equal(
        blockTimestamp + nftClaimsPresets.expireTime
      );

      expect(await whitelistClaims.claimeesRegister(bob.address)).to.be.equal(
        blockTimestamp + nftClaimsPresets.expireTime
      );

      await stablecoinToken
        .connect(alice)
        .approve(whitelistClaims.address, toBN(10, 7).toString());

      await whitelistClaims.connect(alice).claimNft();

      expect(await whitelistClaims.claimeesRegister(alice.address)).to.be.equal(
        bnZero.toString()
      );

      expect(await whitelistClaims.claimeesRegister(bob.address)).to.be.equal(
        blockTimestamp + nftClaimsPresets.expireTime
      );
    });
  });
});
