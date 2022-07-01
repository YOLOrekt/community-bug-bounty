const { ethers } = require("hardhat");
const yoloConstants = require("../constants");
const { getPackedEncodingNameHash } = require("./helpers");
const provider = ethers.provider;

const {
  Globals: {
    HashedRoles,
    HashedContractNames,
    DeployedContractAddresses: { USDC_ADDRESS },
  },
} = yoloConstants;

const contracts = {};

const deployContracts = async (admin) => {
  /// ---- Add provider ----
  contracts.provider = provider;

  // --- YoloRegistry ---
  const YoloRegistry = await ethers.getContractFactory("YoloRegistry");
  contracts.yoloRegistry = await YoloRegistry.deploy();

  // --- StablecoinToken ---
  // const StablecoinToken = await ethers.getContractFactory("StablecoinToken");
  // contracts.stablecoinToken = await StablecoinToken.deploy(
  //   yoloConstants.UTConfig.name,
  //   yoloConstants.UTConfig.symbol,
  //   admin.address
  // );
  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.USDC_TOKEN),
  //   [contracts.stablecoinToken.address, 1, 1]
  // );

  // const yolo_token_set = await contracts.yoloRegistry.getContractAddress(
  //   getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.USDC_TOKEN)
  // );

  // --- USDC Contract ---
  if (process.env.IS_FORK !== "true") {
    const StablecoinToken = await ethers.getContractFactory("StablecoinToken");
    contracts.stablecoinToken = await StablecoinToken.deploy(
      "Generic",
      "GEN",
      admin.address
    );
  } else {
    contracts.stablecoinToken = new ethers.Contract(
      USDC_ADDRESS,
      [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function balanceOf(address owner) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
      ],
      admin
    );
  }
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.USDC_TOKEN),
    [contracts.stablecoinToken.address, 1, 1]
  );

  // --- YoloNFT ---
  // const YoloNFT = await ethers.getContractFactory("YoloNFT");
  // contracts.yoloNFT = await YoloNFT.deploy(
  //   yoloConstants.NFTConfig.name,
  //   yoloConstants.NFTConfig.symbol,
  //   yoloConstants.NFTConfig.baseTokenURI
  // );
  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.YOLO_NFT),
  //   [contracts.yoloNFT.address, 1, 1]
  // );

  // --- NFTTracker ---
  const NFTTracker = await ethers.getContractFactory("NFTTracker");
  contracts.nftTracker = await NFTTracker.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.NFT_TRACKER),
    [contracts.nftTracker.address, 1, 1]
  );

  // --- YoloNFTPack - requires nft tracker ---
  const YoloNFTPack = await ethers.getContractFactory("YoloNFTPack");
  contracts.yoloNFTPack = await YoloNFTPack.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(
      yoloConstants.Globals.ContractNames.YOLO_NFT_PACK
    ),
    [contracts.yoloNFTPack.address, 1, 1]
  );

  // --- BiddersRewards - requires nft tracker ---
  // const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
  // let startBlockNumber = (await provider.getBlockNumber()) + 1;

  // contracts.biddersRewards = await BiddersRewards.deploy(
  //   admin.address,
  //   contracts.yoloRegistry.address,
  //   1,
  //   contracts.nftTracker.address,
  //   contracts.yoloNFTPack.address
  // );
  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(
  //     yoloConstants.Globals.ContractNames.BIDDERS_REWARDS
  //   ),
  //   [contracts.biddersRewards.address, 1]
  // );
  // contracts.biddersRewards.data_startBlockNumber = startBlockNumber;

  // --- BiddersRewardsFactory ---
  // const BiddersRewardsFactory = await ethers.getContractFactory(
  //   "BiddersRewardsFactory"
  // );
  // contracts.biddersRewardsFactory = await BiddersRewardsFactory.deploy(
  //   contracts.yoloRegistry.address
  // );
  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(
  //     yoloConstants.Globals.ContractNames.BIDDERS_REWARDS_FACTORY
  //   ),
  //   [contracts.biddersRewardsFactory.address, 1, 1]
  // );

  // await contracts.yoloNFTPack.grantRole(
  //   HashedRoles.ADMIN_ROLE,
  //   contracts.biddersRewardsFactory.address
  // );

  // await contracts.nftTracker.grantRole(
  //   HashedRoles.ADMIN_ROLE,
  //   contracts.biddersRewardsFactory.address
  // );

  // await contracts.biddersRewardsFactory.rotateRewardsContracts(admin.address);

  // const biddersRewardsAddress =
  //   await contracts.biddersRewardsFactory.rewardsAddresses(0);

  // const BiddersRewards = await ethers.getContractFactory("BiddersRewards");
  // contracts.biddersRewards = await BiddersRewards.attach(biddersRewardsAddress);

  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(
  //     yoloConstants.Globals.ContractNames.BIDDERS_REWARDS
  //   ),
  //   [contracts.biddersRewards.address, 1, 1]
  // );

  // --- WhitelistSFTClaims ---
  const usdcAddress =
    process.env.USDC_ADDRESS !== "true"
      ? contracts.stablecoinToken.address
      : USDC_ADDRESS;

  const WhitelistSFTClaims = await ethers.getContractFactory(
    "WhitelistSFTClaims"
  );
  contracts.whitelistClaims = await WhitelistSFTClaims.deploy(
    contracts.yoloRegistry.address,
    usdcAddress
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.NFT_CLAIMS),
    [contracts.whitelistClaims.address, 1, 1]
  );

  // --- YoloWallet ---
  const YoloWallet = await ethers.getContractFactory("YoloWallet");
  contracts.yoloWallet = await YoloWallet.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.YOLO_WALLET),
    [contracts.yoloWallet.address, 1, 1]
  );

  // --- LiquidityPool ---
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  contracts.liquidityPool = await LiquidityPool.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(
      yoloConstants.Globals.ContractNames.LIQUIDITY_POOL
    ),
    [contracts.liquidityPool.address, 1, 1]
  );

  //  --- Staking Rewards ---
  // const StakingRewards = await ethers.getContractFactory("StakingRewards");
  // startBlockNumber = (await provider.getBlockNumber()) + 1;
  // stakingRewards = await StakingRewards.deploy(contracts.yoloRegistry.address);
  // contracts.stakingRewards = stakingRewards;

  // await contracts.yoloRegistry.setContract(
  //   getPackedEncodingNameHash(
  //     yoloConstants.Globals.ContractNames.STAKING_REWARDS
  //   ),
  //   [stakingRewards.address, 1, 1]
  // );
  // contracts.stakingRewards.data_startBlockNumber = startBlockNumber;

  // --- GameFactory ---
  const GameFactory = await ethers.getContractFactory("GameFactoryWithNFTPack");

  contracts.gameFactory = await GameFactory.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(yoloConstants.Globals.ContractNames.GAME_FACTORY),
    [contracts.gameFactory.address, 1, 1]
  );

  // --- GameInstanceWithNft ---
  const GameInstanceWithNft = await ethers.getContractFactory(
    "GameInstanceWithNFTPack"
  );
  const roundIndex = 0;
  const maxStartDelay = yoloConstants.TestPresets.Miner.THIRTY_MINUTES;

  // --- GameETH_USD ---
  const game1Pair = yoloConstants.Globals.GamePairHashes.ETH_USD;
  const game1Length = 70;

  const game1InstanceAddress =
    await contracts.gameFactory.getPredictedGameAddress(
      admin.address,
      contracts.yoloRegistry.address,
      game1Pair,
      game1Length,
      roundIndex,
      maxStartDelay
    );
  await contracts.yoloRegistry.setApprovedGame(game1InstanceAddress, true);
  await contracts.gameFactory.createGame(
    admin.address,
    contracts.yoloRegistry.address,
    game1Pair,
    game1Length,
    roundIndex,
    maxStartDelay
  );
  contracts.gameETH_USD = await GameInstanceWithNft.attach(
    game1InstanceAddress
  );

  // --- GameDoge_USD ---
  const game2Pair = yoloConstants.Globals.GamePairHashes.DOGE_USD;
  const game2Length = 70;

  const game2InstanceAddress =
    await contracts.gameFactory.getPredictedGameAddress(
      admin.address,
      contracts.yoloRegistry.address,
      game2Pair,
      game2Length,
      roundIndex,
      maxStartDelay
    );
  await contracts.yoloRegistry.setApprovedGame(game2InstanceAddress, true);
  await contracts.gameFactory.createGame(
    admin.address,
    contracts.yoloRegistry.address,
    game2Pair,
    game2Length,
    roundIndex,
    maxStartDelay
  );
  contracts.gameDoge_USD = await GameInstanceWithNft.attach(
    game2InstanceAddress
  );

  // // --- GameTesla_USD ---
  // const game3Pair = yoloConstants.Globals.GamePairHashes.TSLA_USD;
  // const game3Length = 70;

  // const game3InstanceAddress = await contracts.gameFactory.getPredictedGameAddress(
  //   admin.address,
  //   contracts.yoloRegistry.address,
  //   game3Pair,
  //   game3Length,
  //   roundIndex
  // );
  // await contracts.yoloRegistry.setApprovedGame(game3InstanceAddress, true);
  // await contracts.gameFactory.createGame(
  //   admin.address,
  //   contracts.yoloRegistry.address,
  //   game3Pair,
  //   game3Length,
  //   roundIndex
  // );
  // contracts.gameTSLA_USD = await GameInstanceWithNft.attach(game3InstanceAddress);

  // --- GameFactoryWithNFTPack ---
  const GameFactoryWithNFTPack = await ethers.getContractFactory(
    "GameFactoryWithNFTPack"
  );
  contracts.gameFactoryWithNFTPack = await GameFactoryWithNFTPack.deploy(
    contracts.yoloRegistry.address
  );
  await contracts.yoloRegistry.setContract(
    getPackedEncodingNameHash(
      yoloConstants.Globals.ContractNames.GAME_FACTORY_WITH_NFT_PACK
    ),
    [contracts.gameFactoryWithNFTPack.address, 1, 1]
  );

  // --- GameInstanceWithNFTPack ---
  const GameInstanceWithNFTPack = await ethers.getContractFactory(
    "GameInstanceWithNFTPack"
  );

  // --- GameETH_USD_NFT_PACK ---
  const game1PairWNFTPack = yoloConstants.Globals.GamePairHashes.ETH_USD;
  const game1LengthWNFTPack = 70;

  const gameWithNFTPackInstanceAddress =
    await contracts.gameFactoryWithNFTPack.getPredictedGameAddress(
      admin.address,
      contracts.yoloRegistry.address,
      game1PairWNFTPack,
      game1LengthWNFTPack,
      roundIndex,
      maxStartDelay
    );
  await contracts.yoloRegistry.setApprovedGame(
    gameWithNFTPackInstanceAddress,
    true
  );
  await contracts.gameFactoryWithNFTPack.createGame(
    admin.address,
    contracts.yoloRegistry.address,
    game1PairWNFTPack,
    game1LengthWNFTPack,
    roundIndex,
    maxStartDelay
  );
  contracts.gameETH_USD_W_NFT_Pack = await GameInstanceWithNFTPack.attach(
    gameWithNFTPackInstanceAddress
  );
};

const getContracts = () => contracts;

module.exports = { deployContracts, getContracts };
