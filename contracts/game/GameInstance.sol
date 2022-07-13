// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {IYoloGame} from "./IYoloGame.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./utils/GameStructs.sol";
import {GameEvents} from "./utils/GameEvents.sol";
import {YoloRegistry} from "../core/YoloRegistry.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {LiquidityPool} from "../core/LiquidityPool.sol";
import {YoloWallet} from "../core/YoloWallet.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {GAME_ADMIN_ROLE, MARKET_MAKER_ROLE, USDC_TOKEN, YOLO_WALLET, LIQUIDITY_POOL, FEE_RATE_MIN, USDC_DECIMALS_FACTOR} from "../utils/constants.sol";

// import "hardhat/console.sol";

/**
 * @title GameInstance
 * @author Garen Vartanian (@cryptokiddies)
 * @author Yogesh Srihari (@yogeshgo05)
 * @notice A binary prediction market for a given asset pair, `GAME_PAIR`, and round duration denoted in seconds, `GAME_LENGTH`. Uniquely identified by `GAME_ID`.
 * @dev This is the meat of the Yolo contract system and manages game round starts and settlements, and handles bids executed by users.
 */
contract GameInstance is RegistrySatellite, IYoloGame, Pausable, GameEvents {
    using SafeERC20 for IERC20;

    uint256 constant MAX_ROUND_OFFSET = 10;
    uint256 constant BASIS_FACTOR = 10000;
    uint256 constant EXTANT_BIDS_LIMIT = 250;

    uint256 immutable MAX_START_DELAY;
    uint256 immutable GAME_LENGTH;
    bytes32 immutable GAME_PAIR;
    bytes32 public immutable GAME_ID;
    address public immutable lpAddress; // {LiquidityPool} contract address

    uint256 bidNonce;
    uint256 public marketLimit; // local copy of marketLimit from {LiquidityPool} for gas efficiency
    uint256 public roundIndex; // index denoting current round number
    uint256 public lpFeeRate = 300; // fee in basis points earned per round to liquidity providers

    IERC20 public immutable stablecoinTokenContract; // get this address from registry
    YoloWallet public immutable yoloWalletContract;

    mapping(uint256 => RoundData) public roundDatas; // General round data for a round
    mapping(uint256 => RoundPool) public gamePools; // Game Pool by round
    mapping(uint256 => BidInfo) public allBids; // nonce to `BidInfo`
    mapping(address => BidManager) public bidsManager; // latest key in a user's `allBids` linked list

    /**
     * @dev If this is coming from {GameFactory}, arguments are passed in from there. Starts in paused state.
     */
    constructor(
        address gameAdmin_,
        address registryContractAddress_,
        bytes32 gamePair_,
        uint256 gameLength_,
        uint256 roundIndex_,
        uint256 maxStartDelay_
    ) RegistrySatellite(registryContractAddress_) {
        require(gameAdmin_ != address(0), "owner address must be specified");

        address stablecoinTokenAddress = YoloRegistry(registryContractAddress_)
            .getContractAddress(USDC_TOKEN);

        require(
            stablecoinTokenAddress != address(0),
            "yolo token addr not registered"
        );

        roundIndex = roundIndex_;

        stablecoinTokenContract = IERC20(stablecoinTokenAddress);

        address yoloWalletAddress = YoloRegistry(registryContractAddress_)
            .getContractAddress(YOLO_WALLET);

        require(
            yoloWalletAddress != address(0),
            "wallet cntct addr not registered"
        );

        yoloWalletContract = YoloWallet(yoloWalletAddress);

        lpAddress = YoloRegistry(registryContractAddress_).getContractAddress(
            LIQUIDITY_POOL
        );

        require(lpAddress != address(0), "lp contract addr not registered");

        MAX_START_DELAY = maxStartDelay_;

        GAME_PAIR = gamePair_;
        GAME_LENGTH = gameLength_;
        // note encoding is NOT packed, though same result
        GAME_ID = keccak256(abi.encode(gamePair_, gameLength_));

        _grantRole(GAME_ADMIN_ROLE, gameAdmin_);
        _grantRole(DEFAULT_ADMIN_ROLE, gameAdmin_);

        _pause();
    }

    /**
     * @dev Calls Open zeppelin internal pause from {Pausable} to stop bidding.
     */
    function pause() external onlyAuthorized(GAME_ADMIN_ROLE) {
        _pause();

        yoloRegistryContract.setGameInactive();
    }

    /**
     * @dev Calls Open zeppelin internal unpause from {Pausable} to restart bidding.
     */
    function unpause() external onlyAuthorized(GAME_ADMIN_ROLE) {
        _unpause();

        yoloRegistryContract.setGameActive();
    }

    function getUnclaimedRoundsLength(address user)
        external
        view
        returns (uint256 unclaimedRoundsLength)
    {
        unclaimedRoundsLength = bidsManager[user].unsettledBidCount;
    }

    function calculateExpectedReturns(address user)
        external
        view
        returns (
            uint256[] memory roundsClaimed,
            uint256[] memory roundPayoutAmounts
        )
    {
        BidManager memory bidManager = bidsManager[user];
        uint256 headIdx = bidManager.headIdx;

        if (headIdx > 0) {
            uint256 cursor = headIdx;

            roundsClaimed = new uint256[](bidManager.unsettledBidCount);
            roundPayoutAmounts = new uint256[](bidManager.unsettledBidCount);

            uint256 i = bidManager.unsettledBidCount;

            while (cursor > 0) {
                --i;
                uint256 userRound;

                BidInfo memory bidInfo = allBids[cursor];
                userRound = bidInfo.bidRound;

                RoundData memory roundData = roundDatas[userRound];

                if (roundData.settlementPrice != 0) {
                    RoundPool memory roundPool = gamePools[userRound];

                    uint256 payoutAmount = _calculatePayout(
                        roundPool,
                        roundData,
                        bidInfo
                    );

                    if (payoutAmount > 0) {
                        roundsClaimed[i] = userRound;
                        roundPayoutAmounts[i] = payoutAmount;
                    }
                }
                cursor = bidInfo.next;
            }
        }
    }

    /**
     * @notice Sets fresh fee in basis points earned by liquidity providers in each round.
     * @dev In addition to a fee floor, `FEE_RATE_MIN`, a fee ceiling, `FEE_MAX`, can provide add'l validation
     * @param newFee The new fee in basis points
     **/
    function updateLpFee(uint256 newFee)
        external
        override
        onlyAuthorized(GAME_ADMIN_ROLE)
    {
        require(
            newFee >= yoloRegistryContract.globalParameters(FEE_RATE_MIN),
            "fee must be within bounds"
        );

        lpFeeRate = newFee;

        emit FeeUpdate(newFee);
    }

    /**
     * @notice Grab market limit periodically from {LiquidityPool} to save on external call costs
     * @dev This is called in sync with market limit changes in {LiquidityPool}.
     **/
    function acquireMarketLimit() external onlyAuthorized(GAME_ADMIN_ROLE) {
        marketLimit = LiquidityPool(lpAddress).marketLimit();
    }

    /**
     * @notice Bids in specified round with USDC token for bots only
     * @dev This function bypasses balance checks in `bidInYolo` function. Underflow will revert in reduction
     TODO: remove bid round checks to save gas and have special recover function in case bid round is a past round or is fat fingered far in advance
     **/
    function makeMarketBid(uint256 bidRound, uint128[2] calldata amounts)
        external
        override
        onlyAuthorized(MARKET_MAKER_ROLE)
        whenNotPaused
    {
        require(bidRound > roundIndex, "cannot bid in live round");
        require(
            bidRound <= 10 + roundIndex,
            "cannot bid more than 10 rounds in advance"
        );

        uint256 combinedAmount = amounts[0] + amounts[1];

        require(combinedAmount < marketLimit, "amount exceeds limit");

        address lpAddr = lpAddress;

        yoloWalletContract.gameReduceUserBalance(lpAddr, combinedAmount);

        RoundPool storage roundPool = gamePools[bidRound];
        // first bid up amount
        roundPool.upLiquidity += (amounts[0]);
        // then bid down amount
        roundPool.downLiquidity += (amounts[1]);

        emit LiquidityProvision(
            bidRound,
            msg.sender,
            lpAddr,
            amounts[0],
            amounts[1]
        );
    }

    /**
     * @notice Bid in specified round with USDC token within a prediction round. There is a minimum bid amount.
     * @dev There is a streamlined approach where tokens are transferred from the user's USDC token contract balance, if there is insufficient balance in the user's platform token balance. Currently a public function to expose to super call from child contract. TODO: need to add time decay
     * @param amount Amount of bid in USDC token.
     * @param isUp Direction of bid.
     * @param bidRound Round value.
     **/
    function bidInYolo(
        uint96 amount,
        bool isUp,
        uint72 bidRound // later rounds
    ) public virtual override whenNotPaused {
        require(bidRound > roundIndex, "cannot bid in live round");
        require(
            bidRound <= MAX_ROUND_OFFSET + roundIndex,
            "cannot bid more than 10 rounds in advance"
        );
        require(amount >= 5 * USDC_DECIMALS_FACTOR, "5 USDC minimum bid");

        address sender = msg.sender;
        uint256 userBalance = yoloWalletContract.balances(sender);

        if (amount <= userBalance) {
            yoloWalletContract.gameReduceUserBalance(sender, amount);
        } else {
            uint256 shortfall;

            unchecked {
                shortfall = amount - userBalance;
            }

            if (userBalance > 0) {
                yoloWalletContract.gameReduceUserBalance(sender, userBalance);
            }

            stablecoinTokenContract.safeTransferFrom(
                sender,
                address(yoloWalletContract),
                shortfall
            );
        }

        _bidInYolo(amount, isUp, bidRound);
    }

    /**
     * @notice End current live round, passing in settlement price to compare with strike price. Payout winning bidders and liquidity provider fees. Then starts a round, meaning the round is "live" and cannot accept further bids.
     * @dev Game admin (`GAME_ADMIN_ROLE` or `DEFAULT_ADMIN_ROLE`) can call this method to lock in a round. The `roundIndex` provides the index number value for each round. Critical to keep `processingRoundIndex` and `newRoundIndex` sorted and pass these values to save ~1000 gas on every call rather than read state.
     * @param startTime The start time in UNIX seconds.
     * @param settlementPrice The asset settlement price.
     * @param nextStrikePrice The asset settlement price.
     **/
    function processRound(
        uint112 startTime,
        uint128 settlementPrice,
        uint128 nextStrikePrice
    ) external override onlyAuthorized(GAME_ADMIN_ROLE) {
        require(
            settlementPrice > 0 && nextStrikePrice > 0,
            "args must be g.t. 0"
        );

        // note: critical - index values
        uint256 processingRoundIndex; // current round index
        uint256 newRoundIndex;

        unchecked {
            newRoundIndex = ++roundIndex;
        }

        processingRoundIndex = newRoundIndex - 1;

        RoundData storage currentRoundData = roundDatas[processingRoundIndex];
        // console.log("process round index %s", processingRoundIndex);

        require(
            startTime <= block.timestamp + MAX_START_DELAY,
            "startTime offset g.t. allowed"
        );

        require(
            startTime >= currentRoundData.startTime + GAME_LENGTH,
            "min duration for start required"
        );

        currentRoundData.settlementPrice = settlementPrice;

        _processFees(currentRoundData, settlementPrice, processingRoundIndex);

        _startRound(startTime, nextStrikePrice, newRoundIndex);
    }

    /**
    @dev note that `userNonces` must be memory - critical for correct behavior. Only `userNoncesStorage` is a storage pointer.
     */
    function claimReturns() external {
        BidManager storage bidManager = bidsManager[msg.sender];
        uint72 headIdx = bidManager.headIdx;

        // also means unsettledBidCount should be zero
        require(headIdx > 0, "no pending claims");

        uint256 bound = bidManager.unsettledBidCount < EXTANT_BIDS_LIMIT
            ? bidManager.unsettledBidCount
            : EXTANT_BIDS_LIMIT;

        // console.log("bound %s", bound);

        bool hasUnsettledBid;
        uint256 payoutSum;
        uint256 settlementCount;
        uint256 unsettledBidKey;
        uint72 cursor = headIdx;

        // TODO: get winning length method or use event tracking?
        uint256[] memory roundsClaimed = new uint256[](bound);
        uint256[] memory roundPayoutAmounts = new uint256[](bound);

        for (uint256 i = 0; i < bound; i++) {
            BidInfo memory bidInfo = allBids[cursor];
            uint256 userRound = bidInfo.bidRound;

            // console.log("userRound %s", userRound);
            // console.log("bid info next %s", bidInfo.next);

            RoundData memory roundData = roundDatas[userRound];

            if (roundData.settlementPrice > 0) {
                RoundPool memory roundPool = gamePools[userRound];

                // console.log("totalUserUp %s", roundPool.totalUserUp);
                // console.log("totalUserDown %s", roundPool.totalUserDown);

                if (
                    roundPool.totalUserUp != 0 && roundPool.totalUserDown != 0
                ) {
                    uint256 payoutAmount = _calculatePayout(
                        roundPool,
                        roundData,
                        bidInfo
                    );
                    roundsClaimed[i] = userRound;
                    roundPayoutAmounts[i] = payoutAmount;
                    payoutSum += payoutAmount;
                } else {
                    // in this case either upCount or downCount must be 0
                    roundsClaimed[i] = userRound;
                    roundPayoutAmounts[i] = bidInfo.amount;
                    payoutSum += bidInfo.amount;
                }

                ++settlementCount;
                cursor = bidInfo.next;
                // console.log("settled. cursor %s", cursor);
            } else {
                if (unsettledBidKey != 0) {
                    allBids[unsettledBidKey].next = cursor;
                } else {
                    hasUnsettledBid = true;
                    bidManager.headIdx = cursor;
                }

                unsettledBidKey = cursor;
                cursor = bidInfo.next;
                // console.log("unsettled round hit. cursor %s", cursor);
            }
        }

        if (!hasUnsettledBid && bound < EXTANT_BIDS_LIMIT) {
            bidManager.headIdx = 0;
            bidManager.unsettledBidCount -= uint128(settlementCount);
        } else if (!hasUnsettledBid && bound == EXTANT_BIDS_LIMIT) {
            bidManager.headIdx = cursor;
            bidManager.unsettledBidCount -= uint128(settlementCount);
        } else if (bound < EXTANT_BIDS_LIMIT) {
            allBids[unsettledBidKey].next = 0;
            bidManager.unsettledBidCount -= uint128(settlementCount);
        } else if (bound == EXTANT_BIDS_LIMIT) {
            allBids[unsettledBidKey].next = cursor;
            bidManager.unsettledBidCount -= uint128(settlementCount);
        }

        // console.log("payout sum %s", payoutSum);

        // Update Users balance from other contract calling the register contracts to get its address
        yoloWalletContract.gameUpdateUserBalance(msg.sender, payoutSum);

        emit UserClaims(msg.sender, roundsClaimed, roundPayoutAmounts);
    }

    function _calculatePayout(
        RoundPool memory roundPool,
        RoundData memory roundData,
        BidInfo memory bidInfo
    ) private pure returns (uint256 payoutAmount) {
        uint256 payoutFactor;
        uint256 totalUp;
        uint256 totalDown;
        uint256 postYoloDown;
        uint256 postYoloUp;

        totalUp = roundPool.totalUserUp + roundPool.upLiquidity;
        totalDown = roundPool.totalUserDown + roundPool.downLiquidity;

        // console.log("totalUp %s", totalUp);
        // console.log("totalDown %s", totalDown);

        // get fees from global params contract

        payoutFactor = BASIS_FACTOR - roundData.lpFeeRate;

        postYoloUp = totalUp - (totalUp * roundData.lpFeeRate) / BASIS_FACTOR;
        postYoloDown =
            totalDown -
            (totalDown * roundData.lpFeeRate) /
            BASIS_FACTOR;

        // console.log("postYoloUp %s", postYoloUp);
        // console.log("postYoloDown %s", postYoloDown);

        {
            if (roundData.settlementPrice > roundData.strikePrice) {
                // Up wins
                if (bidInfo.isUp) {
                    payoutAmount =
                        ((bidInfo.amount * postYoloDown) / totalUp) +
                        ((bidInfo.amount * payoutFactor) / BASIS_FACTOR);
                }
            } else {
                // Down wins, as do ties for now
                if (!bidInfo.isUp) {
                    payoutAmount =
                        ((bidInfo.amount * postYoloUp) / totalDown) +
                        ((bidInfo.amount * payoutFactor) / BASIS_FACTOR);
                }
            }
        }
    }

    // can pass adjusted fee value here as well
    function _startRound(
        uint112 startTime,
        uint128 strikePrice,
        uint256 newRoundIndex
    ) private {
        RoundData storage currentRoundData = roundDatas[newRoundIndex];
        require(currentRoundData.startTime == 0, "round already initialized");

        uint16 lpFeeRateU16 = uint16(lpFeeRate);

        currentRoundData.startTime = startTime;
        currentRoundData.lpFeeRate = lpFeeRateU16;
        currentRoundData.strikePrice = strikePrice;

        emit RoundStarted(newRoundIndex, startTime, lpFeeRateU16, strikePrice);
    }

    function _bidInYolo(
        uint96 amount,
        bool isUp,
        uint72 bidRound // later rounds
    ) private {
        BidManager storage bidManager = bidsManager[msg.sender];
        RoundPool storage roundPool = gamePools[bidRound];

        BidInfo memory newBid = BidInfo({
            amount: amount,
            isUp: isUp,
            bidRound: bidRound,
            next: bidManager.headIdx
        });

        // console.log("amount %s", amount);
        // console.log("sender %s", sender);
        // console.log("bidRound %s", bidRound);

        allBids[++bidNonce] = newBid;
        bidManager.headIdx = uint72(bidNonce);
        ++bidManager.unsettledBidCount;

        // note: safety based on minimum bid amount and round offset limits
        unchecked {
            if (isUp) {
                roundPool.totalUserUp += amount;
                ++roundPool.upCount;
            } else {
                roundPool.totalUserDown += amount;
                ++roundPool.downCount;
            }
        }

        // console.log("totalUserUp %s", roundPool.totalUserUp);
        // console.log("totalUserDown %s", roundPool.totalUserDown);

        emit BidMade(bidRound, msg.sender, amount, isUp);
    }

    /**
     * @dev  Game admin (`GAME_ADMIN_ROLE`) can call this method to lock in a round. The fee can be set as a state variable instead of constant. This fee can be validated against min and max boundaries. Note that `currentRoundData` is storage pointer in invoking function, but memory instance in this `_processFees` because of good gas savings. This is intentional.
     */
    function _processFees(
        RoundData memory currentRoundData,
        uint256 settlementPrice,
        uint256 processingRoundIndex
    ) private {
        // console.log("process fees block timestamp %s", block.timestamp);
        // console.log(
        //     "currentRoundData.startTime + GAME_LENGTH %s",
        //     currentRoundData.startTime + GAME_LENGTH
        // );

        require(
            block.timestamp >= currentRoundData.startTime + GAME_LENGTH,
            "minimum game settlement time not reached"
        );

        RoundPool memory roundPool = gamePools[processingRoundIndex];
        // console.log("process fees round index %s", processingRoundIndex);

        uint256 totalFees;
        uint256 returnAmount;

        if (roundPool.totalUserUp != 0 && roundPool.totalUserDown != 0) {
            uint256 payoutFactor;
            uint256 totalUp;
            uint256 totalDown;

            totalUp = roundPool.totalUserUp + roundPool.upLiquidity;
            totalDown = roundPool.totalUserDown + roundPool.downLiquidity;

            // get fees from global params contract
            totalFees =
                ((totalUp + totalDown) * currentRoundData.lpFeeRate) /
                BASIS_FACTOR;
            payoutFactor = BASIS_FACTOR - currentRoundData.lpFeeRate;

            if (
                settlementPrice > currentRoundData.strikePrice &&
                roundPool.upLiquidity > 0
            ) {
                returnAmount =
                    (((roundPool.upLiquidity * totalDown) /
                        totalUp +
                        roundPool.upLiquidity) * payoutFactor) /
                    BASIS_FACTOR;
            } else if (
                settlementPrice <= currentRoundData.strikePrice &&
                roundPool.downLiquidity > 0
            ) {
                returnAmount =
                    (((roundPool.downLiquidity * totalUp) /
                        totalDown +
                        roundPool.downLiquidity) * payoutFactor) /
                    BASIS_FACTOR;
            }

            currentRoundData.fees = uint128(totalFees);
        } else {
            returnAmount = roundPool.upLiquidity + roundPool.downLiquidity;
        }

        yoloWalletContract.returnLiquidity(lpAddress, returnAmount, totalFees);

        emit RoundSettled(processingRoundIndex, currentRoundData);
    }
}
