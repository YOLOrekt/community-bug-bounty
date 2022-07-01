// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

interface IYoloGame {
    function updateLpFee(uint256 newFee) external;

    function bidInYolo(
        uint96 amount,
        bool isUp,
        uint72 bidRound
    ) external;

    function makeMarketBid(uint256 bidRound, uint128[2] calldata amounts)
        external;

    function processRound(
        uint112 startTime,
        uint128 settlementPrice,
        uint128 nextStrikePrice
    ) external;
}
