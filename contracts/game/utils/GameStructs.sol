pragma solidity 0.8.13;

struct BidInfo {
    uint96 amount; // amount (in USDC initially)
    bool isUp; // bid above (`isUp = true`) or bid below
    uint72 bidRound; // round in which bid was made
    uint72 next; // next linked list item key
}

struct BidManager {
    uint72 headIdx;
    uint128 unsettledBidCount;
}

struct RoundPool {
    uint32 upCount;
    uint32 downCount;
    uint96 totalUserUp;
    uint96 totalUserDown;
    uint128 upLiquidity;
    uint128 downLiquidity;
}

struct RoundData {
    uint112 startTime;
    uint16 lpFeeRate; // b.p. out of 10,000 - rate set at start of round
    uint128 strikePrice;
    uint128 fees;
    uint128 settlementPrice; // price at `startTime + GAME_LENGTH`
}
