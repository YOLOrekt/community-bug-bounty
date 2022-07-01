// contract names
bytes32 constant USDC_TOKEN = keccak256("USDC_TOKEN");
bytes32 constant YOLO_NFT = keccak256("YOLO_NFT");
bytes32 constant YOLO_SHARES = keccak256("YOLO_SHARES");
bytes32 constant YOLO_WALLET = keccak256("YOLO_WALLET");
bytes32 constant LIQUIDITY_POOL = keccak256("LIQUIDITY_POOL");
bytes32 constant BETA_NFT_TRACKER = keccak256("BETA_NFT_TRACKER");
bytes32 constant NFT_TRACKER = keccak256("NFT_TRACKER");
bytes32 constant YOLO_NFT_PACK = keccak256("YOLO_NFT_PACK");
bytes32 constant BIDDERS_REWARDS = keccak256("BIDDERS_REWARDS");
bytes32 constant BIDDERS_REWARDS_FACTORY = keccak256("BIDDERS_REWARDS_FACTORY");
bytes32 constant LIQUIDITY_REWARDS = keccak256("LIQUIDITY_REWARDS");
bytes32 constant GAME_FACTORY = keccak256("GAME_FACTORY");

// game pairs
bytes32 constant ETH_USD = keccak256("ETH_USD");
bytes32 constant TSLA_USD = keccak256("TSLA_USD");
bytes32 constant DOGE_USD = keccak256("DOGE_USD");

// access control roles
bytes32 constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");
bytes32 constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
bytes32 constant REWARDER_ROLE = keccak256("REWARDER_ROLE");
bytes32 constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
bytes32 constant MARKET_MAKER_ROLE = keccak256("MARKET_MAKER_ROLE");

// assets config
uint256 constant USDC_DECIMALS = 10**6;

// global parameters
bytes32 constant FEE_RATE_MIN = keccak256("FEE_RATE_MIN"); // in basis points
bytes32 constant FEE_RATE_MAX = keccak256("FEE_RATE_MAX"); // basis points

// Token Names and Symbols
string constant LIQUIDITY_POOL_TOKENS_NAME = "Yolo Liquidity Provider Shares";
string constant LIQUIDITY_POOL_TOKENS_SYMBOL = "BYLP";
