const { expect } = require("chai");
const {
  ethers,
  waffle: { loadFixture },
} = require("hardhat");

const { deployContracts, getContracts } = require("./utils/deployUtils");
const { toTokenAmount } = require("./utils/BNUtils");
const { createRandomAddress } = require("./utils/helpers");
const { getPackedEncodingNameHash } = require("./utils/helpers");

const yoloConstants = require("./constants");
const { doesNotMatch } = require("assert");

// *** Yolo NFT Pack Unit Test ***

// Preset Values
const {
  Math: { ZERO_ADDRESS, EMPTY_BYTES },
  TestPresets: {
    YOLO_NFT_PACK: { l1FirstToken, l2FirstToken, nftFirstToken, UNITY },
    NFT_TRACKER: { level1Id, level2Id, nftBasetype },
  },
  Globals: { InterfaceIds, HashedRoles },
} = yoloConstants;

const gameInstancePresets = yoloConstants.TestPresets.GAME_INSTANCE;

describe("YOLOrekt YoloNFTPack Test", () => {
  //  *** Addresses ***
  let admin, alice, bob;

  //  *** Contracts ***
  let stablecoinToken;
  let yoloNFTPack;
  let nftTracker;
  let gameETH_USD_W_NFT_Pack;
  let yoloRegistry;
  let gameFactoryWithNFTPack;

  async function fixture() {
    const accounts = await ethers.getSigners();
    (admin = accounts[0]), (alice = accounts[1]), (bob = accounts[2]);

    console.log("runner");
    await deployContracts(admin);

    const contracts = getContracts();

    stablecoinToken = contracts.stablecoinToken;
    yoloNFTPack = contracts.yoloNFTPack;
    nftTracker = contracts.nftTracker;
    gameETH_USD_W_NFT_Pack = contracts.gameETH_USD_W_NFT_Pack;
    yoloRegistry = contracts.yoloRegistry;
    gameFactoryWithNFTPack = contracts.gameFactoryWithNFTPack;

    await gameETH_USD_W_NFT_Pack.unpause();
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("ERC1155 Basic Methods", () => {
    it("supports correct interfaces", async () => {
      expect(await yoloNFTPack.supportsInterface(InterfaceIds.IERC1155)).to.be
        .true;

      expect(await yoloNFTPack.supportsInterface(InterfaceIds.IERC1155METADATA))
        .to.be.true;

      expect(await yoloNFTPack.supportsInterface(InterfaceIds.IERC165)).to.be
        .true;
    });

    it("reverts wrong interfaces", async () => {
      expect(await yoloNFTPack.supportsInterface(InterfaceIds.RANDOM)).to.be
        .false;
    });

    it("returns empty uri on zero index", async () => {
      expect(await yoloNFTPack.uri("0")).to.be.equal("");
    });

    it("returns empty uri on first level nft", async () => {
      expect(await yoloNFTPack.uri(level1Id)).to.be.equal("");
    });

    it("reverts on zero addr balance query", async () => {
      await expect(yoloNFTPack.balanceOf(ZERO_ADDRESS, 0)).to.be.revertedWith(
        "balance query for the zero address"
      );
    });

    it("reverts on zero addr batch balance query", async () => {
      await expect(
        yoloNFTPack.balanceOfBatch([ZERO_ADDRESS], [0])
      ).to.be.revertedWith("balance query for the zero address");
    });

    it("reverts on zero addr batch balance query 2", async () => {
      await expect(
        yoloNFTPack.balanceOfBatch(
          [createRandomAddress(), ZERO_ADDRESS],
          [0, 0]
        )
      ).to.be.revertedWith("balance query for the zero address");
    });

    it("sets setApprovalForAll", async () => {
      await yoloNFTPack.connect(bob).setApprovalForAll(alice.address, true);

      expect(await yoloNFTPack.isApprovedForAll(bob.address, alice.address)).to
        .be.true;
    });

    it("allows operator to transfer SFT", async () => {
      await yoloNFTPack.connect(bob).setApprovalForAll(alice.address, true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(bob.address);

      expect(await yoloNFTPack.isApprovedForAll(bob.address, alice.address)).to
        .be.true;

      expect(await yoloNFTPack.ownerOf(l1FirstToken)).to.equal(bob.address);

      await yoloNFTPack
        .connect(alice)
        .safeTransferFrom(
          bob.address,
          admin.address,
          l1FirstToken,
          UNITY,
          EMPTY_BYTES
        );

      expect(await yoloNFTPack.ownerOf(l1FirstToken)).to.equal(admin.address);
    });

    it("reverts token transfer due to owner restriction", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack.safeTransferFrom(
          alice.address,
          bob.address,
          l1FirstToken,
          UNITY,
          EMPTY_BYTES
        )
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
    });

    it("reverts token transfer due to insufficient balance", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeTransferFrom(alice.address, bob.address, 111, UNITY, EMPTY_BYTES)
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("reverts token batchTransfer due to insufficient balance with random id", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeBatchTransferFrom(
            alice.address,
            bob.address,
            [111],
            [UNITY],
            EMPTY_BYTES
          )
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("transfers token", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeTransferFrom(
            alice.address,
            bob.address,
            l1FirstToken,
            UNITY,
            EMPTY_BYTES
          )
      )
        .to.emit(yoloNFTPack, "TransferSingle")
        .withArgs(
          alice.address,
          alice.address,
          bob.address,
          l1FirstToken,
          UNITY
        );
    });

    it("reverts additional mint base SFT calls", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(yoloNFTPack.mintBaseSFT(alice.address)).to.be.revertedWith(
        "receiver already has a token"
      );
    });

    it("batch transfers token", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeBatchTransferFrom(
            alice.address,
            bob.address,
            [l1FirstToken],
            [UNITY],
            EMPTY_BYTES
          )
      )
        .to.emit(yoloNFTPack, "TransferBatch")
        .withArgs(
          alice.address,
          alice.address,
          bob.address,
          [l1FirstToken],
          [UNITY]
        );
    });

    it("reverts improper id encoded max cap set", async () => {
      await yoloNFTPack.createBaseType(true);
      await expect(yoloNFTPack.setTokenLevelMaxCap(222, 1)).to.be.revertedWith(
        "improper id base type encoding"
      );
    });

    it("reverts transfer to existing token holder", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await expect(yoloNFTPack.mintBaseSFT(bob.address)).to.be.revertedWith(
        "mint exceeds token level cap"
      );
    });

    it("reverts transfer to existing token holder", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 2);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeTransferFrom(
            alice.address,
            bob.address,
            l1FirstToken,
            UNITY,
            EMPTY_BYTES
          )
      ).to.be.revertedWith("receiver already has a token");
    });

    it("reverts batchTransfer to existing token holder", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 2);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.mintBaseSFT(bob.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeBatchTransferFrom(
            alice.address,
            bob.address,
            [l1FirstToken],
            [UNITY],
            EMPTY_BYTES
          )
      ).to.be.revertedWith("receiver already has a token");
    });

    it("reverts batch transfer length mismatch", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeBatchTransferFrom(
            alice.address,
            bob.address,
            [],
            [UNITY],
            EMPTY_BYTES
          )
      ).to.be.revertedWith("ids length must be one");
    });
  });

  describe("ERC1155 Dynamic URI", () => {
    it("should be able to setTokenURI by admin", async () => {
      await yoloNFTPack.setURI(level1Id, "New URI");
      expect(await yoloNFTPack.uri(level1Id)).to.be.equal("New URI");

      await yoloNFTPack.setURI(nftFirstToken, "New URI 2");
      expect(await yoloNFTPack.uri(nftFirstToken)).to.be.equal("New URI 2");
    });

    it("should revert setTokenURI if not called by admin", async () => {
      await expect(
        yoloNFTPack.connect(alice).revokeSetURI(l1FirstToken)
      ).to.be.revertedWith(
        "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
      );
    });

    it("should revert revokeSetURI if token has not been minted", async () => {
      await expect(yoloNFTPack.revokeSetURI(l1FirstToken)).to.be.revertedWith(
        "no revoke on nonexistant token"
      );
    });

    it("should revert revokeSetURI if ipfs compatible CID not present", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(yoloNFTPack.revokeSetURI(l1FirstToken)).to.be.revertedWith(
        "must be CID v0 or greater"
      );
    });

    it("should revert setURI if SFT id is used instead of its basetype", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack.setURI(
          l1FirstToken,
          "iofs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR"
        )
      ).to.be.revertedWith("must be SFT basetype or NFT");

      await expect(
        yoloNFTPack.setURI(
          UNITY,
          "iofs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR"
        )
      ).to.be.revertedWith("must be SFT basetype or NFT");
    });

    it("should revert revokeSetURI if ipfs prefix is missing", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await yoloNFTPack.setURI(
        level1Id,
        "iofs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR"
      );

      await expect(yoloNFTPack.revokeSetURI(l1FirstToken)).to.be.revertedWith(
        "uri prefix must be: ipfs://"
      );
    });

    it("should revert if revokeSetURI already called successfully", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await yoloNFTPack.setURI(
        level1Id,
        "ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR"
      );

      await yoloNFTPack.revokeSetURI(l1FirstToken);

      await expect(yoloNFTPack.revokeSetURI(l1FirstToken)).to.be.revertedWith(
        "setURI on id already revoked"
      );
    });

    it("should revert if other user try setTokenURI", async () => {
      await expect(
        yoloNFTPack.connect(bob).setURI(1, "New URI")
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
          bob.address.toLowerCase() +
          " is missing role " +
          HashedRoles.MINTER_ROLE.toLowerCase() +
          "'"
      );
    });
  });

  describe("ERC1155 Burnable", () => {
    it("owner should be able to burn", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(UNITY);

      await expect(
        yoloNFTPack.connect(alice).burn(alice.address, l1FirstToken, UNITY)
      )
        .to.emit(yoloNFTPack, "TransferSingle")
        .withArgs(
          alice.address,
          alice.address,
          ZERO_ADDRESS,
          l1FirstToken,
          UNITY
        );

      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(0);
    });

    it("operator should be able to burn", async () => {
      await yoloNFTPack.connect(bob).setApprovalForAll(alice.address, true);
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(bob.address);

      expect(
        await yoloNFTPack.balanceOf(bob.address, l1FirstToken)
      ).to.be.equal(UNITY);

      await expect(
        yoloNFTPack.connect(alice).burn(bob.address, l1FirstToken, UNITY)
      )
        .to.emit(yoloNFTPack, "TransferSingle")
        .withArgs(
          alice.address,
          bob.address,
          ZERO_ADDRESS,
          l1FirstToken,
          UNITY
        );

      expect(
        await yoloNFTPack.balanceOf(bob.address, l1FirstToken)
      ).to.be.equal(0);
    });

    it("burnBatch should be disabled", async () => {
      await expect(
        yoloNFTPack
          .connect(alice)
          .burnBatch(alice.address, [l1FirstToken], [UNITY])
      ).to.be.revertedWith("burnBatch disabled");

      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(UNITY);

      await expect(
        yoloNFTPack
          .connect(alice)
          .burnBatch(alice.address, [l1FirstToken], [UNITY])
      ).to.be.revertedWith("burnBatch disabled");

      await expect(
        yoloNFTPack.burnBatch(alice.address, [l1FirstToken], [UNITY])
      ).to.be.revertedWith("burnBatch disabled");
    });

    it("reverts burn due to owner restriction", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack.burn(bob.address, l1FirstToken, UNITY)
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
    });

    // zero address revert unreachable
    it("reverts burn due to bad caller and not zero address", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 2);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack.connect(alice).burn(ZERO_ADDRESS, l1FirstToken, UNITY)
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

      await yoloNFTPack.connect(bob).setApprovalForAll(alice.address, true);
      await yoloNFTPack.mintBaseSFT(bob.address);

      await expect(
        yoloNFTPack.connect(alice).burn(ZERO_ADDRESS, l1FirstToken, UNITY)
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
    });

    it("reverts token burn due to insufficient balance", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);

      await expect(
        yoloNFTPack.connect(alice).burn(alice.address, 111, UNITY)
      ).to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });
  });

  describe("ERC1155 Pauser", () => {
    it("can pause minting", async () => {
      await yoloNFTPack.pause();
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);

      await expect(yoloNFTPack.mintBaseSFT(alice.address)).to.be.revertedWith(
        "ERC1155Pausable: token transfer while paused"
      );
    });

    it("can unpause", async () => {
      await yoloNFTPack.pause();
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.unpause();

      await yoloNFTPack.mintBaseSFT(alice.address);

      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(UNITY);
    });

    it("reverts pause from unauthorized", async () => {
      await expect(yoloNFTPack.connect(alice).pause()).to.be.revertedWith(
        "must have pauser role to pause"
      );
    });

    it("reverts unpause from unauthorized", async () => {
      await expect(yoloNFTPack.connect(alice).unpause()).to.be.revertedWith(
        "must have pauser role to unpause"
      );
    });

    it("can pause transfers", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.pause();

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeTransferFrom(
            alice.address,
            bob.address,
            l1FirstToken,
            0,
            EMPTY_BYTES
          )
      ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");

      await expect(
        yoloNFTPack
          .connect(alice)
          .safeBatchTransferFrom(
            alice.address,
            bob.address,
            [l1FirstToken],
            [0],
            EMPTY_BYTES
          )
      ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");
    });

    it("can resume transfers", async () => {
      await yoloNFTPack.createBaseType(true);
      await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
      await yoloNFTPack.mintBaseSFT(alice.address);
      await yoloNFTPack.pause();
      await yoloNFTPack.unpause();

      await yoloNFTPack
        .connect(alice)
        .safeTransferFrom(
          alice.address,
          bob.address,
          l1FirstToken,
          0,
          EMPTY_BYTES
        );

      expect(
        await yoloNFTPack.balanceOf(bob.address, l1FirstToken)
      ).to.be.equal(1);
      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(0);

      expect(
        (await yoloNFTPack.balanceOfBatch([bob.address], [l1FirstToken]))[0]
      ).to.be.equal(1);
      expect(
        (await yoloNFTPack.balanceOfBatch([alice.address], [l1FirstToken]))[0]
      ).to.be.equal(0);

      await yoloNFTPack
        .connect(bob)
        .safeBatchTransferFrom(
          bob.address,
          alice.address,
          [l1FirstToken],
          [0],
          EMPTY_BYTES
        );

      expect(
        await yoloNFTPack.balanceOf(bob.address, l1FirstToken)
      ).to.be.equal(0);
      expect(
        await yoloNFTPack.balanceOf(alice.address, l1FirstToken)
      ).to.be.equal(1);
    });

    // TODO: setup with game and nft tracker thresholds
    // it("pauses nft upgrades", async () => {
    //   // should pauser design prevent nft upgrades? likely
    // })
  });

  describe("Integrated actions", () => {
    describe("Token creation", () => {
      it("mint reverts without basetype creation", async () => {
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await expect(yoloNFTPack.mintBaseSFT(alice.address)).to.be.revertedWith(
          "base type not yet created"
        );
      });
    });

    describe("Upgrading token level", () => {
      it("rejects token upgrade without level thresholds initialized", async () => {
        await yoloNFTPack.createBaseType(true);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.mintBaseSFT(alice.address);

        await expect(
          yoloNFTPack.connect(alice).upgradeToken(l1FirstToken)
        ).to.be.revertedWith("next level requirements not set");
      });

      it("rejects token upgrade WITH level thresholds initialized", async () => {
        await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

        await yoloNFTPack.createBaseType(true);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.mintBaseSFT(alice.address);

        await nftTracker.setYoloNFTPackContract();
        await nftTracker.setLevelRequirement(level1Id, 1, 1, 1);

        await expect(
          yoloNFTPack.connect(alice).upgradeToken(l1FirstToken)
        ).to.be.revertedWith("next level requirements not set");
      });

      it("upgrades token", async () => {
        await nftTracker.setYoloNFTPackContract();

        await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

        await yoloNFTPack.createBaseType(true);
        // sanction 2nd level
        await yoloNFTPack.createBaseType(true);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.setTokenLevelMaxCap(level2Id, 1);

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
            toTokenAmount(gameInstancePresets.bidAmount200).toString(),
            false,
            gameInstancePresets.roundIndexes[1]
          );

        await nftTracker.setLevelRequirement(level1Id, 1, 1, 1);

        await nftTracker.setLevelRequirement(level2Id, 2, 2, 2);

        expect(await yoloNFTPack.ownerOf(l1FirstToken)).to.equal(alice.address);

        await yoloNFTPack.connect(alice).upgradeToken(l1FirstToken);

        expect(await yoloNFTPack.ownerOf(l2FirstToken)).to.equal(alice.address);
      });

      it("upgrades token to NFT", async () => {
        await nftTracker.setYoloNFTPackContract();

        await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

        await yoloNFTPack.createBaseType(true);
        // sanction 2nd level
        await yoloNFTPack.createBaseType(false);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.setTokenLevelMaxCap(nftBasetype, 1);

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
            toTokenAmount(gameInstancePresets.bidAmount200).toString(),
            false,
            gameInstancePresets.roundIndexes[1]
          );

        await nftTracker.setLevelRequirement(level1Id, 1, 1, 1);

        await nftTracker.setLevelRequirement(nftBasetype, 2, 2, 2);

        expect(await yoloNFTPack.ownerOf(l1FirstToken)).to.equal(alice.address);

        await yoloNFTPack.connect(alice).upgradeToken(l1FirstToken);

        expect(await yoloNFTPack.ownerOf(nftFirstToken)).to.equal(
          alice.address
        );
      });

      it("reverts with threshold req not met", async () => {
        await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);

        await yoloNFTPack.createBaseType(true);
        // sanction 2nd level
        await yoloNFTPack.createBaseType(true);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.setTokenLevelMaxCap(level2Id, 1);
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

        await nftTracker.setYoloNFTPackContract();

        await nftTracker.setLevelRequirement(level1Id, 1, 1, 1);
        await nftTracker.setLevelRequirement(level2Id, 2, 2, 2);

        await expect(
          yoloNFTPack.connect(alice).upgradeToken(l1FirstToken)
        ).to.be.revertedWith("threshold requirements not met");
      });
    });

    describe("Revert setURI after revoking", () => {
      it("should revert if setURI on ID already revoked", async () => {
        await nftTracker.grantRole(HashedRoles.MINTER_ROLE, admin.address);
        await nftTracker.setYoloNFTPackContract();

        await yoloNFTPack.createBaseType(true);
        // sanction 2nd level
        await yoloNFTPack.createBaseType(false);
        await yoloNFTPack.setTokenLevelMaxCap(level1Id, 1);
        await yoloNFTPack.setTokenLevelMaxCap(nftBasetype, 1);
        await yoloNFTPack.mintBaseSFT(alice.address);

        await nftTracker.setLevelRequirement(level1Id, 1, 1, 1);
        await nftTracker.setLevelRequirement(nftBasetype, 2, 2, 2);

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
            toTokenAmount(gameInstancePresets.bidAmount200).toString(),
            false,
            gameInstancePresets.roundIndexes[1]
          );

        await yoloNFTPack.connect(alice).upgradeToken(l1FirstToken);

        await yoloNFTPack.setURI(
          nftFirstToken,
          "ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR"
        );

        await yoloNFTPack.revokeSetURI(nftFirstToken);

        await expect(
          yoloNFTPack.setURI(
            nftFirstToken,
            "ipfs://QmbWqxBsKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnS"
          )
        ).to.be.revertedWith("setter role revoked for id");
      });
    });
  });
});
