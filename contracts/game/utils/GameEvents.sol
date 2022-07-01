pragma solidity 0.8.13;

import "./GameStructs.sol";

abstract contract GameEvents {
    /**
     * @dev Currently emitted simultaneously with `RoundSettled` in same block as coupled.
     */
    event RoundStarted(
        uint256 indexed roundIndex,
        uint112 startTime,
        uint16 feeRate,
        uint128 strikePrice
    );

    /**
     * @dev Important log emitted after round is ended and processed with `RoundData` and `winningAmounts`. Combined with `FeeUpdate` event, accounts for all value processed in a round.
     */
    event RoundSettled(uint256 indexed roundIndex, RoundData finalGameInfo);

    event UserClaims(
        address indexed user,
        uint256[] winningRounds,
        uint256[] winningAmounts
    );

    /**
     * @dev Emitted when the bidder/user calls a game {bid**} method.
     * `gameId` gives the exact game,
     * `isUp` indicates whether bid is up or down in binary type markets
     */
    event BidMade(
        uint256 indexed roundIndex,
        address indexed bidder,
        uint96 amount,
        bool isUp
    );

    /**
     * @dev Liquidity provided on behalf of the {LiquidityPool} to a {GameInstance}
     */
    event LiquidityProvision(
        uint256 indexed bidRound,
        address provider,
        address lpContractAddress,
        uint128 upAmount,
        uint128 downAmount
    );

    /**
     * @dev Anytime a {GameInstance} instance has its round fee updated (in basis points).
     */
    event FeeUpdate(uint256 newFee);
}
