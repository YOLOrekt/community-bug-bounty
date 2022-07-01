const {
  constants: ozConstants, // Common constants, like the zero address and largest integers
  BN,
} = require("@openzeppelin/test-helpers");

const bnOne = new BN(1);
const bnTwo = new BN(2);
const bnThree = new BN(3);
const bnFour = new BN(4);
const nonFungibleFlag = bnTwo.pow(new BN(255));
const semiFungibleFlag = nonFungibleFlag.add(bnTwo.pow(new BN(254)));
const level1Id = semiFungibleFlag.add(bnOne.shln(128));
const level2Id = semiFungibleFlag.add(bnTwo.shln(128));
const level3Id = semiFungibleFlag.add(bnThree.shln(128));
const nftBasetype = nonFungibleFlag.add(bnOne.shln(128));
const l1FirstToken = level1Id.add(bnOne);
const l1SecondToken = level1Id.add(bnTwo);
const l1ThirdToken = level1Id.add(bnThree);
const l1FourthToken = level1Id.add(bnFour);
const l2FirstToken = level2Id.add(bnOne);
const l3FirstToken = level3Id.add(bnOne);
const nftFirstToken = nftBasetype.add(bnOne);

module.exports = {
  Math: {
    MAX_UINT256: ozConstants.MAX_UINT256.toString(),
    ZERO_ADDRESS: ozConstants.ZERO_ADDRESS.toString(),
    ZERO_BYTES32: ozConstants.ZERO_BYTES32.toString(),
    EMPTY_BYTES: "0x",
  },
  NFTConfig: {
    name: "yoloBeta",
    symbol: "YBETA",
    baseTokenURI: "",
  },
  UTConfig: {
    name: "Beta YOLO",
    symbol: "BYOLO",
    totalSupply: "1e27",
  },
  STConfig: {
    name: "Yolo Liquidity Provider Shares",
    symbol: "BYLP",
  },
  Globals: {
    DeployedContractAddresses: {
      USDC_ADDRESS: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    },
    AccessControl: {
      ADMIN_ROLE: "ADMIN_ROLE",
      DEFAULT_ADMIN_ROLE: "DEFAULT_ADMIN_ROLE",
      GAME_ADMIN_ROLE: "GAME_ADMIN_ROLE",
      MINTER_ROLE: "MINTER_ROLE",
      PAUSER_ROLE: "PAUSER_ROLE",
      MARKET_MAKER_ROLE: "MARKET_MAKER_ROLE",
    },
    // packed encoding - no length prefix
    HashedRoles: {
      ADMIN_ROLE:
        "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775",
      DEFAULT_ADMIN_ROLE:
        "0x1effbbff9c66c5e59634f24fe842750c60d18891155c32dd155fc2d661a4c86d",
      GAME_ADMIN_ROLE:
        "0x9b7946abd96dccbe6cfc6cc2c13300ab429d93e16fa72dc459eeccda73817f08",
      MINTER_ROLE:
        "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
      PAUSER_ROLE:
        "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
      MARKET_MAKER_ROLE:
        "0x75e5bf8b7de9fd9f24c97951733c6410a040b7a07b543096cb36c6dda365aa8b",
      LIQUIDITY_POOL:
        "0xfcc2a095bc87e4f587dbeee571b5746ed121049d43150cc8dc494f2e2598ab93",
    },
    Assets: {
      YOLO: "YOLO",
    },
    ContractNames: {
      GAME_FACTORY: "GAME_FACTORY",
      GAME_FACTORY_WITH_NFT_PACK: "GAME_FACTORY_WITH_NFT_PACK",
      LIQUIDITY_POOL: "LIQUIDITY_POOL",
      YOLO_WALLET: "YOLO_WALLET",
      USDC_TOKEN: "USDC_TOKEN",
      YOLO_SHARES: "YOLO_SHARES",
      YOLO_NFT: "YOLO_NFT",
      YOLO_NFT_PACK: "YOLO_NFT_PACK",
      NFT_CLAIMS: "NFT_CLAIMS",
      NFT_TRACKER: "NFT_TRACKER",
      BETA_NFT_TRACKER: "BETA_NFT_TRACKER",
      ETH_USD: "ETH_USD",
      DOGE_USD: "DOGE_USD",
      TSLA_USD: "TSLA_USD",
      BIDDERS_REWARDS: "BIDDERS_REWARDS",
      BIDDERS_REWARDS_FACTORY: "BIDDERS_REWARDS_FACTORY",
      STAKING_REWARDS: "STAKING_REWARDS",
    },
    // packed encoding
    HashedContractNames: {
      GAME_FACTORY:
        "0x7e1e2de4fcf19641545eff14bdef5f2c81f6dad4b1226c4ca6f5e13b67463e65",
      GAME_FACTORY_WITH_NFT_PACK:
        "0x61d2ac561ebc2e3f1cf41101dc06544cf469fd4a06d192f5fc237b8b5244fe03",
      LIQUIDITY_POOL:
        "0xfcc2a095bc87e4f587dbeee571b5746ed121049d43150cc8dc494f2e2598ab93",
      YOLO_WALLET:
        "0x56093c742c4cfb4a43e9a93530f3c53cd244a6a58e31a15b4a8075d8f2ba6776",
      USDC_TOKEN:
        "0x3e12a650288c427adbf7021d3e3bd4f67ecad350b59d4388ab9405bd95ccbce1",
      YOLO_SHARES:
        "0x5b6b2c3191a81d0b82df4422bd61c7fa786c195cc2f9f8a093a4380f756c914f",
      YOLO_NFT:
        "0xeac12af4a1247e3fe4b1042980212124b914c296cdab14ffd4b8fde6fbf134ef",
      YOLO_NFT_PACK:
        "0xf6261777d40c99b1f002ed52b650fd3cc3f76f31eb07ec723ee56f1bc7aab628",
      NFT_CLAIMS:
        "0xc07bac758801bd3204ed80dbea6f6cbe97f93c03c94f502dc661a1310fc90195",
      NFT_TRACKER:
        "0xf4c274b8143c709470db1b2e9d6735ee6f35b05749248e7aa1873d64220e81a2",
      BETA_NFT_TRACKER:
        "0x57aeede9575b0fb5fb5442b544b3b5e2e45306b8055d40d21c7e054a6081474b",
      BIDDERS_REWARDS:
        "0xca2c9143d42c3f6f3c8e67a51f1032e1964dd67c224a646b4137fda1a6ae5aed",
      STAKING_REWARDS:
        "0x17787fbcbc3eb09562edeaabb54ae2a49e6712b1b2b2c5651943ccfc8e08c5a0",
    },
    GamePairHashes: {
      ETH_USD:
        "0x7ffda7a2f43427562e5fee12d8c875cfc089dab65bc5edaa49a9737c5c49338c",
      TSLA_USD:
        "0x4f45826ce9874a8dca27b8cf3d34688c5de2f164050b1182ac352dfd8ba926ae",
      DOGE_USD:
        "0x05e395e82420212637afaadd0968781adb673e346fe05ae6a1b5d5d6a45d17be",
    },
    InterfaceIds: {
      IERC20: "0x36372b07",
      IERC165: "0x01ffc9a7",
      IERC721: "0x80ac58cd",
      IERC721METADATA: "0x5b5e139f",
      IERC721ENUMERABLE: "0x780e9d63",
      IERC1155: "0xd9b67a26",
      IERC1155METADATA: "0x0e89341c",
      RANDOM: "0x12345678",
    },
    Params: {
      FEE_MIN: "FEE_MIN",
      FEE_MAX: "FEE_MAX",
    },
  },
  TestPresets: {
    Miner: {
      FIFTEEN_MINUTES: 15 * 60,
      THIRTY_MINUTES: 30 * 60,
      THREE_MINUTES: 3 * 60,
      DEFAULT_MINE_TIME: 1,
    },
    YOLO_SHARES: {
      mintAmount: 10,
    },
    USDC_TOKEN: {},
    YOLO_NFT: {
      batchMintNftSupply: 3,
      tokenURIIndex: 1,
    },
    YOLO_NFT_PACK: {
      nonFungibleFlag: nonFungibleFlag.toString(),
      semiFungibleFlag: semiFungibleFlag.toString(),
      l1FirstToken: l1FirstToken.toString(),
      l1SecondToken: l1SecondToken.toString(),
      l1ThirdToken: l1ThirdToken.toString(),
      l1FourthToken: l1FourthToken.toString(),
      l2FirstToken: l2FirstToken.toString(),
      l3FirstToken: l3FirstToken.toString(),
      nftFirstToken: nftFirstToken.toString(),
      UNITY: 1,
    },
    YOLO_WALLET: {
      bobAmount: 10,
      aliceAmount: 20,
      offsetAmount: 3,
      tokenTransferAmount: 10000,
      oneThirdSplit: 3333,
      splitRemainder: 6667,
    },
    GAME_FACTORY: {},
    GAME_INSTANCE: {
      roundIndexes: [0, 1, 2, 3, 4, 5],
      initialLPFee: 300,
      updatedLPFee: 500,
      updatedFeeMin: 100,
      processRound0: { settlement: 3000, nextStrike: 3000 },
      processRound1: { settlement: 4000, nextStrike: 4010 },
      processRound2: { settlement: 5000, nextStrike: 5000 },
      processRound3: { settlement: 3000, nextStrike: 2900 },
      processRound4: { settlement: 1000, nextStrike: 2000 },
      bidAmount100: 100,
      bidAmount200: 200,
      bidAmounts: [100, 200, 300, 400, 500, 600, 700, 800],
      transferAmount: 900,
      approveMAX: 99999,
      largeTransfer: 999999,
      advanceBlockNumber: 70,
      boundaryBidRound: 10,
    },
    NFT_TRACKER: {
      roundIndexes: [0, 1, 2, 3, 4, 5],
      bidAmount100: 100,
      bidAmount200: 200,
      transferAmount: 900,
      approveMAX: 99999,
      tokenIndex: 0,
      level1Id: level1Id.toString(),
      level2Id: level2Id.toString(),
      level3Id: level3Id.toString(),
      nftBasetype: nftBasetype.toString(),
      sixtyDays: 5184000,
    },
    NFT_CLAIMS: {
      expireTime: 100000,
      fiveThousandsTokens: 5000,
      tokenIndex: 0,
    },
    LIQUIDITY_POOL: {},
    YOLO_REGISTRY: {
      contractVersion: 1,
      interfaceId: 0x36372b07,
      updatedFeeMin: 100,
      updatingFeeMax: 100,
    },
  },
};
