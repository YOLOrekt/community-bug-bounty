pragma solidity 0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BiddersRewardsFactory} from "./BiddersRewardsFactory.sol";
import {YoloRegistry} from "../core/YoloRegistry.sol";
import {NFTTracker} from "../core/NFTTracker.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {YoloNFTPack} from "../tokens/YoloNFTPack.sol";
import {SplitBitId} from "../utils/SplitBitId.sol";
import {USDC_TOKEN, NFT_TRACKER, YOLO_NFT_PACK, BIDDERS_REWARDS_FACTORY, REWARDER_ROLE, USDC_DECIMALS_FACTOR} from "../utils/constants.sol";
import {ZAA_USDCToken, ZAA_receiver} from "../utils/errors.sol";

// import "hardhat/console.sol";
// import "../utils/LogBinary.sol";

/**
 * @title BiddersRewards
 * @author Garen Vartanian (@cryptokiddies)
 * @notice Reward participants vis-a-vis NFT linked data on bid count and cumulative amount bid, i.e., ids are linked to the users' NFT, not user addresses. Reward amount is based on nft tranche that nft base id is linked to. "Participation units" are measured by weighting bid count and amounts.
 * @dev SFT/NFT tranches are determined via bit masking upper bits for base type. Funds are split among tranches based on reward multiplier normalization at end of ~30 days. {BiddersRewardsFactory} is config controller, which switches the {NFTTracker} & {YoloNFTPack} to point to the new rewards contract synchronously. Funding is more straightforward as directly called on this contract for admin actions like funding and releasing.
 */
contract BiddersRewards is RegistrySatellite {
    // TODO: reduce type sizes - can go to 128 on all, lower on some
    struct LevelPoolInfo {
        uint128 reward;
        uint128 totalPaidOut;
    }

    struct NftData {
        uint64 roundCount;
        uint192 cumulativeBidAmount;
    }

    struct LevelTracking {
        uint64 totalRoundCount;
        uint192 totalCumulativeBidAmount;
    }

    using SplitBitId for uint256;
    using SafeERC20 for IERC20;
    // using LogBinary for uint256;

    // divide weights out in denominator - integer truncation should not be concern as rewards multiplier covers wei decimals
    uint256 constant CUM_AMOUNT_WEIGHT = 1;
    // TODO: count weight reduce to about min bid amount
    // TODO: make dynamic var to adjust before releasing funds if needed
    uint256 constant COUNT_WEIGHT = 25 * USDC_DECIMALS_FACTOR; // add 10**6 factor to balance token factor (USDC)
    // absolute max fund amount at one time - 2.5M tokens
    uint256 constant MAX_FUND_LIMIT = 1.5 * 10**5 * USDC_DECIMALS_FACTOR;

    uint256 public immutable startTime;
    uint256 public immutable epoch;

    // Maximum allowable fund amount, sanity check
    uint256 maxFundAmount;
    // process funds amongst levels
    bool public isReleased;
    bool public hasFunding;

    // Address of the USDC ERC20 Token contract.
    IERC20 stablecoinTokenContract;
    NFTTracker nftTrackerContract;
    YoloNFTPack yoloNFTPackContract;
    BiddersRewardsFactory rewardsFactoryContract;

    /**
     * key The nft id of the token that is tracked
     * @notice Token activity for calculating this epoch's token mapped USDC token rewards.
     * @dev The param is Yolo NFT token index. Public function will return `roundCount` and `cumulativeBidAmount`.
     * @return roundCount cumulativeBidAmount Struct `roundCount` and `cumulativeBidAmount` fields.
     **/
    mapping(uint256 => NftData) public epochTokenTracker;

    /**
     * key The SFT/NFT basetype id.
     * @notice Tracks total round bid count and cumulative amounts within a SFT/NFT tier.
     * @dev compact uint types are sufficient for tracking tokens.
     * @return totalRoundCount totalCumulativeBidAmount.
     **/
    mapping(uint256 => LevelTracking) public levelTrackingMap;

    mapping(uint256 => LevelPoolInfo) public poolInfos;
    // nftId returns rewardDebt
    mapping(uint256 => bool) public harvestLogs;

    event RewardsBidTracking(
        uint256 indexed tokenIndex,
        uint256 newRoundBid,
        uint192 amount
    );

    event FundRelease(uint256 indexed epoch, address caller);

    event RedundantReleaseRequest(uint256 indexed epoch, address caller);

    event Funding(address indexed admin, uint256 amount);

    event Harvest(
        address indexed caller,
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 amount
    );

    event MaxFundSet(uint256 newMaxFundAmount);

    error CallerNotNFTPack();
    error CallerNotNFTTracker();

    constructor(
        address rewardsAdmin_,
        address registryContractAddress_,
        uint256 epoch_,
        NFTTracker trackerInstance_,
        YoloNFTPack nftPackInstance_
    ) RegistrySatellite(registryContractAddress_) {
        YoloRegistry registryContract = YoloRegistry(registryContractAddress_);

        address stablecoinTokenContractAddress = registryContract
            .getContractAddress(USDC_TOKEN);

        if (stablecoinTokenContractAddress == address(0))
            revert ZAA_USDCToken();

        require(
            msg.sender ==
                registryContract.getContractAddress(BIDDERS_REWARDS_FACTORY),
            "sender must be rewards factory"
        );

        rewardsFactoryContract = BiddersRewardsFactory(msg.sender);
        stablecoinTokenContract = IERC20(stablecoinTokenContractAddress);
        nftTrackerContract = trackerInstance_;
        yoloNFTPackContract = nftPackInstance_;

        _grantRole(REWARDER_ROLE, rewardsAdmin_);
        _grantRole(YOLO_NFT_PACK, address(nftPackInstance_));
        _grantRole(NFT_TRACKER, address(trackerInstance_));

        startTime = block.timestamp;
        epoch = epoch_;
    }

    function getUserPendingReward(uint256 id)
        external
        view
        returns (uint256 pendingReward)
    {
        uint256 participationWeight = getUserParticipationWeight(id);

        if (!harvestLogs[id]) {
            uint256 totalLevelWeighting = getTotalLevelWeighting(id);
            uint256 latestYOLOInLevel = getLatestLevelReward(id);

            pendingReward =
                (participationWeight * latestYOLOInLevel) /
                totalLevelWeighting;
        } else {
            pendingReward = 0;
        }
    }

    function getUserParticipationWeight(uint256 _nftId)
        public
        view
        returns (uint256)
    {
        uint64 roundCount;
        uint192 cumulativeAmount;

        (roundCount, cumulativeAmount) = _getNFTStats(_nftId);

        return roundCount * COUNT_WEIGHT + cumulativeAmount * CUM_AMOUNT_WEIGHT;
    }

    function getLatestLevelReward(uint256 id)
        public
        view
        returns (uint256 levelYoloReward)
    {
        uint256 baseType = id.getBaseType();

        uint256 yoloReward = stablecoinTokenContract.balanceOf(address(this));
        uint256 multiplier = nftTrackerContract.rewardsMultipliers(baseType);

        uint256 totalLevelWeighting = getTotalLevelWeighting(baseType);
        uint256 allLevelsWeighting = getCombinedLevelsWeighting();

        levelYoloReward =
            (yoloReward * totalLevelWeighting * multiplier) /
            allLevelsWeighting;
    }

    function getTotalLevelWeighting(uint256 baseType)
        public
        view
        returns (uint256 totalLevelWeighting)
    {
        (
            uint256 totalRoundCount,
            uint256 totalCumulativeBidAmount
        ) = getLevelCountAndAmount(baseType);

        if (totalRoundCount > 0) {
            totalLevelWeighting =
                totalRoundCount *
                COUNT_WEIGHT +
                totalCumulativeBidAmount *
                CUM_AMOUNT_WEIGHT;
        }
    }

    function getLevelCountAndAmount(uint256 baseType)
        public
        view
        returns (uint256 totalRoundCount, uint256 totalCumulativeBidAmount)
    {
        require(
            baseType.isSemiFungibleBaseType() ||
                baseType.isNonFungibleBaseType(),
            "improper encoding for base type"
        );

        LevelTracking memory levelTracking = levelTrackingMap[baseType];

        totalRoundCount = levelTracking.totalRoundCount;
        totalCumulativeBidAmount = levelTracking.totalCumulativeBidAmount;
    }

    function getCombinedLevelsWeighting()
        public
        view
        returns (uint256 weightedMultiplierSum)
    {
        uint256 nftLevelIdsListLength = nftTrackerContract
            .getNFTLevelIdsLength();
        uint256[] memory nftLevelIdsList;

        require(nftLevelIdsListLength > 0, "no NFT levels exist");

        // repeated calls to previously accessed external contracts should be cheaper
        nftLevelIdsList = nftTrackerContract.getNFTLevelsListRange(
            0,
            nftLevelIdsListLength
        );

        uint256 nftLevelId;
        uint256 rewardsMultiplier;

        for (uint256 i; i < nftLevelIdsListLength; i++) {
            nftLevelId = nftLevelIdsList[i];

            LevelTracking memory levelTracking = levelTrackingMap[nftLevelId];

            uint64 totalRoundCount = levelTracking.totalRoundCount;
            uint192 totalCumulativeBidAmount = levelTracking
                .totalCumulativeBidAmount;

            rewardsMultiplier = nftTrackerContract.rewardsMultipliers(
                nftLevelId
            );

            require(rewardsMultiplier > 0, "set all rewards multipliers");

            uint256 levelWeighting = rewardsMultiplier *
                (totalRoundCount *
                    COUNT_WEIGHT +
                    totalCumulativeBidAmount *
                    CUM_AMOUNT_WEIGHT);

            weightedMultiplierSum += levelWeighting;
        }
    }

    function _getNFTStats(uint256 id)
        private
        view
        returns (uint64 roundCount, uint192 cumulativeBidAmount)
    {
        NftData memory tracking = epochTokenTracker[id];
        roundCount = tracking.roundCount;
        cumulativeBidAmount = tracking.cumulativeBidAmount;
    }

    function setMaxFundAmount(uint256 newMaxFundAmount)
        external
        onlyAuthorized(REWARDER_ROLE)
    {
        require(newMaxFundAmount <= MAX_FUND_LIMIT, "new max exceeds limit");
        maxFundAmount = newMaxFundAmount;

        emit MaxFundSet(newMaxFundAmount);
    }

    // sanity check with maxFundAmount
    function fund(uint256 amount) external onlyAuthorized(REWARDER_ROLE) {
        require(amount <= maxFundAmount, "amount exceeds max allowable");
        require(!isReleased, "rewards previously processed");

        stablecoinTokenContract.safeTransferFrom(
            address(msg.sender),
            address(this),
            amount
        );

        hasFunding = true;
        // console.log(
        //     "token balance: %s",
        //     stablecoinTokenContract.balanceOf(address(this))
        // );

        emit Funding(msg.sender, amount);
    }

    // note: care to keep level list small - alternate approach, have each level processed individually on first harvest call by basetype holder
    function releaseFunds() external {
        if (isReleased == true) {
            emit RedundantReleaseRequest(epoch, msg.sender);
            return;
        }

        require(
            msg.sender == address(rewardsFactoryContract) ||
                block.timestamp > startTime + 30 days,
            "factory call or seasoned 30 days"
        );

        // get nft levels list and grab highest level for the highest multiplier and THEN require best reward per block lower than amount sent

        uint256 nftLevelIdsListLength = nftTrackerContract
            .getNFTLevelIdsLength();
        uint256[] memory levelWeightings = new uint256[](nftLevelIdsListLength);
        uint256[] memory nftLevelIdsList;
        uint256 weightingSum;

        require(nftLevelIdsListLength > 0, "no NFT levels exist");

        // repeated calls to previously accessed external contracts should be cheaper
        nftLevelIdsList = nftTrackerContract.getNFTLevelsListRange(
            0,
            nftLevelIdsListLength
        );

        for (uint256 i = 0; i < nftLevelIdsListLength; i++) {
            uint256 nftLevelId;
            uint256 rewardsMultiplier;

            nftLevelId = nftLevelIdsList[i];
            rewardsMultiplier = nftTrackerContract.rewardsMultipliers(
                nftLevelId
            );

            require(rewardsMultiplier > 0, "set all rewards multipliers");

            LevelTracking memory levelTracking = levelTrackingMap[nftLevelId];

            uint64 totalRoundCount = levelTracking.totalRoundCount;
            uint192 totalCumulativeBidAmount = levelTracking
                .totalCumulativeBidAmount;

            uint256 levelWeighting = rewardsMultiplier *
                (totalRoundCount *
                    COUNT_WEIGHT +
                    totalCumulativeBidAmount *
                    CUM_AMOUNT_WEIGHT);

            levelWeightings[i] = levelWeighting;

            weightingSum += levelWeighting;

            // console.log(
            //     "multiplier %s",
            //     nftTrackerContract.rewardsMultipliers(nftLevelId)
            // );
            // console.log("bid count total %s", totalRoundCount);
            // console.log("multiplier sum %s", weightingSum);
        }

        uint256 totalRewardsBalance = stablecoinTokenContract.balanceOf(
            address(this)
        );

        for (uint256 i; i < nftLevelIdsListLength; i++) {
            // do rewards proportions per level
            // will throw panic code is no users have bid
            // note: reward should have correct token decimal factor for division for this expression to be acceptable
            poolInfos[nftLevelIdsList[i]].reward = uint128(
                (totalRewardsBalance * levelWeightings[i]) / weightingSum
            );
        }

        // console.log(
        //     "token balance: %s",
        //     stablecoinTokenContract.balanceOf(address(this))
        // );
        // console.log("total reward per block: %s", totalRewardsBalance);

        isReleased = true;

        emit FundRelease(epoch, msg.sender);
    }

    /**
     * @notice Only for this rewards epoch, track user activity for calculating USDC token rewards.
     * @dev Bid count should be incremented only once per round. Since blockchain cannot check ownership history internally, cannot batch call this later. Must be on bid. Bypass tracking if rewards distribution already calculated to prevent unlikely but undesired edge case.
     * @param tokenIndex Yolo NFT token index.
     * @param amount Amount bid in USDC.
     * @param newRoundBid Bid round of game instance.
     **/
    function updateTracking(
        uint256 tokenIndex,
        uint256 newRoundBid,
        uint192 amount
    ) external onlyAuthorized(NFT_TRACKER) {
        if (msg.sender != address(nftTrackerContract))
            revert CallerNotNFTTracker();

        // TODO: add unit test for isReleased and token encoding
        if (isReleased == true) {
            return;
        }

        require(
            tokenIndex.isSemiFungibleItem() || tokenIndex.isNonFungibleItem(),
            "invalid token encoding"
        );

        NftData storage nftTracking = epochTokenTracker[tokenIndex];

        uint256 tokenBase = tokenIndex.getBaseType();

        LevelTracking storage levelTracker = levelTrackingMap[tokenBase];

        nftTracking.cumulativeBidAmount += amount;
        levelTracker.totalCumulativeBidAmount += amount;

        if (newRoundBid == 1) {
            nftTracking.roundCount++;
            levelTracker.totalRoundCount++;
        }

        emit RewardsBidTracking(tokenIndex, newRoundBid, amount);
    }

    /// @dev not using recursion to support multiple level advances, kiss
    function bumpDuringUpgrade(uint256 oldTokenId, uint256 newTokenId)
        external
        onlyAuthorized(YOLO_NFT_PACK)
    {
        if (msg.sender != address(yoloNFTPackContract))
            revert CallerNotNFTPack();

        NftData storage oldNftTracking = epochTokenTracker[oldTokenId];
        NftData storage newNftTracking = epochTokenTracker[newTokenId];
        LevelTracking storage oldLevelTracking = levelTrackingMap[
            oldTokenId.getBaseType()
        ];
        LevelTracking storage newLevelTracking = levelTrackingMap[
            newTokenId.getBaseType()
        ];

        uint64 roundCount = oldNftTracking.roundCount;
        uint192 cumulativeBidAmount = oldNftTracking.cumulativeBidAmount;

        oldNftTracking.roundCount = 0;
        oldNftTracking.cumulativeBidAmount = 0;

        oldLevelTracking.totalRoundCount -= roundCount;
        oldLevelTracking.totalCumulativeBidAmount -= cumulativeBidAmount;

        newNftTracking.roundCount = roundCount;
        newNftTracking.cumulativeBidAmount = cumulativeBidAmount;

        newLevelTracking.totalRoundCount += roundCount;
        newLevelTracking.totalCumulativeBidAmount += cumulativeBidAmount;
    }

    // cant allow operators to call this
    function harvest(address to) public {
        require(isReleased == true, "funds must be processed");
        if (to == address(0)) revert ZAA_receiver();

        uint256 tokenId;
        uint256 userParticipationUnits;

        tokenId = yoloNFTPackContract.usersTokens(msg.sender);

        userParticipationUnits = getUserParticipationWeight(tokenId);

        require(userParticipationUnits > 0, "no participation units on token");
        require(!harvestLogs[tokenId], "has harvested this epoch");

        LevelPoolInfo storage levelPoolInfo = poolInfos[tokenId.getBaseType()];

        require(levelPoolInfo.reward > 0, "no rewards to harvest");

        _harvest(to, tokenId, userParticipationUnits, levelPoolInfo);
    }

    function harvestOnUpgrade(address user, uint256 tokenId)
        external
        onlyAuthorized(YOLO_NFT_PACK)
    {
        // TODO: make sure factory is used to control releasing or breaks upgrade
        if (msg.sender != address(yoloNFTPackContract))
            revert CallerNotNFTPack();

        require(isReleased == true, "funds must be processed");

        uint256 userParticipationUnits;

        userParticipationUnits = getUserParticipationWeight(tokenId);
        // console.log("user participation: %s", userParticipationUnits);

        LevelPoolInfo storage levelPoolInfo = poolInfos[tokenId.getBaseType()];

        if (
            userParticipationUnits > 0 &&
            !harvestLogs[tokenId] &&
            levelPoolInfo.reward > 0
        ) {
            _harvest(user, tokenId, userParticipationUnits, levelPoolInfo);
        }
    }

    // keep args uint256, don't need to mask and encode
    function _harvest(
        address to,
        uint256 tokenId,
        uint256 userParticipationUnits,
        LevelPoolInfo storage levelPoolInfo
    ) private {
        // roundCount * COUNT_WEIGHT + cumulativeBidAmount * CUM_AMOUNT_WEIGHT;

        uint256 totalLevelUnits = getTotalLevelWeighting(tokenId.getBaseType());

        uint256 rewardsYolo = (userParticipationUnits * levelPoolInfo.reward) /
            totalLevelUnits;

        harvestLogs[tokenId] = true;

        stablecoinTokenContract.safeTransfer(to, rewardsYolo);
        levelPoolInfo.totalPaidOut += uint128(rewardsYolo);
        emit Harvest(msg.sender, to, tokenId, rewardsYolo);
    }

    function recoverFunds(address receiver)
        external
        onlyAuthorized(REWARDER_ROLE)
    {
        require(
            block.timestamp > startTime + 60 days,
            "requires 60 days post deployment"
        );

        if (receiver == address(0)) revert ZAA_receiver();

        stablecoinTokenContract.safeTransfer(
            receiver,
            stablecoinTokenContract.balanceOf(address(this))
        );
    }
}
