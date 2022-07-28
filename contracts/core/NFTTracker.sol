pragma solidity 0.8.13;

import {RegistrySatellite} from "./RegistrySatellite.sol";
import {BiddersRewards} from "../accessory/BiddersRewards.sol";
import {YoloNFTPack} from "../tokens/YoloNFTPack.sol";
import {SplitBitId} from "../utils/SplitBitId.sol";
import {ADMIN_ROLE, MINTER_ROLE, BIDDERS_REWARDS, YOLO_NFT_PACK} from "../utils/constants.sol";
import {ZAA_BiddersRewards, ZAA_YoloNFTPack} from "../utils/errors.sol";

/**
 * @title NFTTracker
 * @author Garen Vartanian (@cryptokiddies)
 * @author Yogesh Srihari
 * @notice Tracks bids made by participants in order to calculate future token rewards.
 * @dev Make sure the tracker only counts one point per round (aside from adding all amounts cumulatively), as multiple bids in same round will game the incentive mechanism.
 */
contract NFTTracker is RegistrySatellite {
    struct NftData {
        uint64 roundCount;
        uint192 cumulativeBidAmount;
        mapping(bytes32 => mapping(uint256 => bool)) hasUserBid;
    }

    struct LevelTracking {
        uint64 totalRoundCount;
        uint192 totalCumulativeBidAmount;
    }

    struct LevelRequirement {
        uint64 roundCountThreshold;
        uint192 cumulativeAmountThreshold;
        uint256 nextLevelId;
        uint256 prevLevelId;
    }

    using SplitBitId for uint256;

    /**
     * key The nft id of the token that is tracked
     * @notice Tracking activity for calculating token's total participation.
     * @dev The param is Yolo NFT token index. Public function will return `roundCount` and `cumulativeBidAmount`. Nested noniterables, i.e., `hasUserBid` are not returned with generic struct getter.
     * @return roundCount cumulativeBidAmount Struct `roundCount` and `cumulativeBidAmount` fields.
     **/
    mapping(uint256 => NftData) public nftTrackingMap;

    /**
     * key The SFT/NFT basetype id.
     * @notice Provides thresholds required to upgrade token and points to next level token id.
     * @dev The struct `LevelRequirement` is a quasi linked list.
     * @return roundCountThreshold cumulativeAmountThreshold nextLevelId prevLevelId.
     **/
    mapping(uint256 => LevelRequirement) public levelRequirements;

    /**
     * key The SFT/NFT basetype id.
     * @notice Tracks total round bid count and cumulative amounts within a SFT/NFT tier.
     * @dev compact uint types are sufficient for tracking tokens.
     * @return totalRoundCount totalCumulativeBidAmount.
     **/
    mapping(uint256 => LevelTracking) public levelTrackingMap;

    // TODO: move to rewards contract?
    /**
     * key The SFT/NFT basetype id.
     * @notice Provides level rewards multiplier weightings for {BiddersRewards}
     * @dev SFT/NFT ids to rewards multipler.
     * @return totalRoundCount totalCumulativeBidAmount.
     **/
    mapping(uint256 => uint256) public rewardsMultipliers;

    // List of NftLevels to iterate over in rewards
    uint256[] public nftLevelIds;

    BiddersRewards biddersRewardsContract;
    YoloNFTPack yoloNFTPackContract;

    // TODO: track and emit game id?
    event BidTracking(
        uint256 indexed tokenIndex,
        uint64 roundCount,
        uint192 cumulativeAmount
    );

    event LevelSet(
        uint256 indexed baseId,
        uint64 roundCountThreshold,
        uint192 cumulativeAmountThreshold
    );

    event UserIncentiveModification(
        uint256 indexed tokenBase,
        uint16 multiplier
    );

    error MultiplierBelow100();

    constructor(address registryAddress_) RegistrySatellite(registryAddress_) {}

    function getNFTLevelIdsLength() public view returns (uint256) {
        return nftLevelIds.length;
    }

    /**
     * @notice Returns a range of the `nftLevels` list of SFT/NFT level basetypes.
     * @dev Use `getNFTLevelIdsLength` to retrieve array length.
     **/
    function getNFTLevelsListRange(uint256 startIndex, uint256 length)
        public
        view
        returns (uint256[] memory nftLevels)
    {
        require(
            startIndex + length <= nftLevelIds.length,
            "range out of array bounds"
        );

        require(length > 0, "length must be g.t. 0");

        nftLevels = new uint256[](length);

        for (uint256 i; i < length; i++) {
            nftLevels[i] = nftLevelIds[i + startIndex];
        }

        return nftLevels;
    }

    /**
     * @notice Set {BiddersRewards} instance.
     * @dev  `upgradeToken` checks for nonzero address, then calls `biddersRewardsContract.harvestBeforeUpgrade` call. This should always point to the latest active rewards contract. Give {BiddersRewardsFactory} privelages `ADMIN_ROLE` to call `setBiddersRewardsContract`.
     **/
    function setBiddersRewardsContract(address biddersRewardsAddress)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        if (biddersRewardsAddress == address(0)) revert ZAA_BiddersRewards();

        biddersRewardsContract = BiddersRewards(biddersRewardsAddress);

        emit AddressSet(BIDDERS_REWARDS, biddersRewardsAddress);
    }

    /**
     * @notice Remove {BiddersRewards} instance address. Called when rewards schedule has concluded.
     * @dev Give {BiddersRewardsFactory} privelages with `ADMIN_ROLE`
     **/
    function removeBiddersRewardsContract()
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        biddersRewardsContract = BiddersRewards(address(0));

        emit AddressSet(BIDDERS_REWARDS, address(0));
    }

    /**
     * @notice Set {YoloNFTPack} instance.
     * @dev Required currently for `updateTracking` functionality to work due to `biddersRewardsContract.updatePool` call.
     **/
    function setYoloNFTPackContract() external onlyAuthorized(ADMIN_ROLE) {
        address yoloNFTPackAddress = yoloRegistryContract.getContractAddress(
            YOLO_NFT_PACK
        );

        if (yoloNFTPackAddress == address(0)) revert ZAA_YoloNFTPack();

        yoloNFTPackContract = YoloNFTPack(yoloNFTPackAddress);

        emit AddressSet(YOLO_NFT_PACK, yoloNFTPackAddress);
    }

    /**
     * @notice Track user activity for calculating token rewards.
     * @dev Bid count should be incremented only once per round. Since blockchain cannot check ownership history internally, cannot batch call this later. Must be on bid.
     * @param tokenIndex Yolo NFT token index.
     * @param amount Amount bid.
     * @param gameId Game pair (by extension, game instance) in which bid occurs.
     * @param bidRound Bid round of game instance.
     **/
    function updateTracking(
        uint256 tokenIndex,
        uint192 amount,
        bytes32 gameId,
        uint256 bidRound
    ) external onlyGameContract {
        require(
            (tokenIndex.isSemiFungibleItem() || tokenIndex.isNonFungibleItem()),
            "incorrect token id encoding"
        );

        NftData storage nftTracking = nftTrackingMap[tokenIndex];
        mapping(uint256 => bool) storage hasUserBid = nftTracking.hasUserBid[
            gameId
        ];

        uint256 tokenBase;
        uint256 newRoundBid;

        tokenBase = tokenIndex.getBaseType();

        LevelTracking storage levelTracker = levelTrackingMap[tokenBase];

        nftTracking.cumulativeBidAmount += amount;
        levelTracker.totalCumulativeBidAmount += amount;

        if (hasUserBid[bidRound] == false) {
            newRoundBid = 1;
            nftTracking.roundCount++;
            hasUserBid[bidRound] = true;
            levelTracker.totalRoundCount += 1;
        }

        if (address(biddersRewardsContract) != address(0)) {
            biddersRewardsContract.updateTracking(
                tokenIndex,
                newRoundBid,
                amount
            );
        }

        emit BidTracking(
            tokenIndex,
            nftTracking.roundCount,
            nftTracking.cumulativeBidAmount
        );
    }

    /**
     * @notice This call sets thresholds for levels, which dictates when SFT/NFT can be upgraded.
     * @dev No need to delete indexes as entire set must be totaled in rewards contract. This quasi linked list approach can be expanded in the future to add or delete intermediate levels. Otherwise, enumerable set pattern can also be sufficient.
     **/
    function setLevelRequirement(
        uint256 baseIndex,
        uint64 roundCountThreshold,
        uint192 cumulativeAmountThreshold,
        uint16 multiplier
    ) external onlyAuthorized(MINTER_ROLE) {
        require(
            baseIndex.isSemiFungibleBaseType() ||
                baseIndex.isNonFungibleBaseType(),
            "incorrect token base encoding"
        );

        if (address(yoloNFTPackContract) == address(0))
            revert ZAA_YoloNFTPack();

        require(
            yoloNFTPackContract.typeBirthCertificates(baseIndex) == true,
            "base type does not exist"
        );

        LevelRequirement storage currentLevel = levelRequirements[baseIndex];

        uint256 prevLevelId;
        LevelRequirement memory prevLevel;

        if (currentLevel.roundCountThreshold == 0) {
            uint256 levelIdsLength;

            levelIdsLength = nftLevelIds.length;

            if (levelIdsLength > 0) {
                prevLevelId = nftLevelIds[nftLevelIds.length - 1];
                currentLevel.prevLevelId = prevLevelId;
                levelRequirements[prevLevelId].nextLevelId = baseIndex;
            }

            nftLevelIds.push(baseIndex);
        } else {
            prevLevelId = currentLevel.prevLevelId;
        }

        prevLevel = levelRequirements[prevLevelId];

        require(
            roundCountThreshold > prevLevel.roundCountThreshold &&
                cumulativeAmountThreshold > prevLevel.cumulativeAmountThreshold,
            "new thresholds must be greater than lower level"
        );

        if (multiplier < 100) revert MultiplierBelow100();

        require(
            multiplier > rewardsMultipliers[prevLevelId],
            "mult must be g.t. prevLevel"
        );

        if (currentLevel.nextLevelId > 0) {
            LevelRequirement memory nextLevel = levelRequirements[
                currentLevel.nextLevelId
            ];

            require(
                roundCountThreshold < nextLevel.roundCountThreshold &&
                    cumulativeAmountThreshold <
                    nextLevel.cumulativeAmountThreshold,
                "new thresholds must be less than next level"
            );

            require(
                multiplier < rewardsMultipliers[currentLevel.nextLevelId],
                "mult must be l.t. nextLevel"
            );
        }

        rewardsMultipliers[baseIndex] = multiplier;
        currentLevel.roundCountThreshold = roundCountThreshold;
        currentLevel.cumulativeAmountThreshold = cumulativeAmountThreshold;
        // note: manual next levels should bot be set - discuss with team design logic
        // dont do this: currentLevel.nextLevelId = nextLevelId;
        // difficulty is if NFT must be swapped for SFT level then SOL

        emit LevelSet(
            baseIndex,
            roundCountThreshold,
            cumulativeAmountThreshold
        );
    }

    /**
     * @notice multiplier in smallish integer
     * @dev uint16 calldata more expensive, but handles overflow check and required for struct fields
     */
    function modifyUserIncentives(uint256 baseIndex, uint16 multiplier)
        external
        onlyAuthorized(MINTER_ROLE)
    {
        require(
            baseIndex.isSemiFungibleBaseType() ||
                baseIndex.isNonFungibleBaseType(),
            "incorrect token base encoding"
        );

        LevelRequirement memory currentLevel = levelRequirements[baseIndex];

        require(currentLevel.roundCountThreshold != 0, "level does not exist");

        if (multiplier < 100) revert MultiplierBelow100();

        require(
            multiplier > rewardsMultipliers[currentLevel.prevLevelId],
            "mult must be g.t. prevLevel"
        );

        if (currentLevel.nextLevelId > 0) {
            require(
                multiplier < rewardsMultipliers[currentLevel.nextLevelId],
                "mult must be l.t. nextLevel"
            );
        }

        rewardsMultipliers[baseIndex] = multiplier;

        emit UserIncentiveModification(baseIndex, multiplier);
    }
}
