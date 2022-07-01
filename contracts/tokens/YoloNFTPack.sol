pragma solidity 0.8.13;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {YoloRegistry} from "../core/YoloRegistry.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {ERC1155SemiFungible} from "./extensions/ERC1155SemiFungible.sol";
import {NFTTracker} from "../core/NFTTracker.sol";
import {BiddersRewardsFactory} from "../accessory/BiddersRewardsFactoryDummy.sol";
import {BiddersRewards} from "../accessory/BiddersRewardsDummy.sol";
import {SplitBitId} from "../utils/SplitBitId.sol";
import {NFT_TRACKER, ADMIN_ROLE, MINTER_ROLE, BIDDERS_REWARDS_FACTORY} from "../utils/constants.sol";

/**
 * @dev {YoloNFTPack} is a wrapper around custom Yolo ERC1155 extensions with functions for creating participation tokens for members and allowing them to upgrade their token based on criteria.
 */
contract YoloNFTPack is RegistrySatellite, ERC1155SemiFungible {
    // tracker data
    // struct NftData {
    //     uint64 roundCount;
    //     uint192 cumulativeBidAmount;
    //     mapping(bytes32 => mapping(uint256 => bool)) hasUserBid;
    // }

    using SplitBitId for uint256;

    uint256 immutable BASE_SFT_ID =
        SplitBitId.TYPE_SEMI_BIT | (uint256(1) << 128);

    NFTTracker nftTrackerContract;
    BiddersRewardsFactory biddersRewardsFactoryContract;

    event TokenUpgrade(
        uint256 indexed prevBaseType,
        address sender,
        uint256 indexed newBaseType
    );

    /**
     * @dev Give {BiddersRewardsFactory} privelages `ADMIN_ROLE` to call `setBiddersRewardsContract` .
     */
    constructor(address yoloRegistryAddress_)
        RegistrySatellite(yoloRegistryAddress_)
        ERC1155SemiFungible()
    {
        address nftTrackerAddress = YoloRegistry(yoloRegistryAddress_)
            .getContractAddress(NFT_TRACKER);

        require(
            nftTrackerAddress != address(0),
            "nftTracker addr cannot be zero"
        );

        nftTrackerContract = NFTTracker(nftTrackerAddress);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155SemiFungible, AccessControlEnumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Set {NFTTracker} instance.
     * @dev Required in order for `upgradeToken` functionality to work.
     **/
    function setNFTTrackerContract() external onlyAuthorized(ADMIN_ROLE) {
        address nftTrackerAddress = yoloRegistryContract.getContractAddress(
            NFT_TRACKER
        );

        require(
            nftTrackerAddress != address(0),
            "tracker address cannot be zero"
        );

        nftTrackerContract = NFTTracker(nftTrackerAddress);

        emit AddressSet(NFT_TRACKER, nftTrackerAddress);
    }

    /**
     * @notice Set {BiddersRewardsFactory} instance address.
     * @dev  `upgradeToken` checks for nonzero address, then calls `biddersRewardsContract.harvestBeforeUpgrade` call. This should always point to the latest active rewards contract. Give {BiddersRewardsFactory} privelages with `ADMIN_ROLE`
     **/
    function setBiddersRewardsFactoryContract(
        address biddersRewardsFactoryAddress
    ) external onlyAuthorized(ADMIN_ROLE) {
        require(
            biddersRewardsFactoryAddress != address(0),
            "rewards address cannot be zero"
        );

        biddersRewardsFactoryContract = BiddersRewardsFactory(
            biddersRewardsFactoryAddress
        );

        emit AddressSet(BIDDERS_REWARDS_FACTORY, biddersRewardsFactoryAddress);
    }

    /**
     * @notice Remove {BiddersRewardsFactory} instance address. Called when rewards schedule has concluded.
     * @dev Give {BiddersRewardsFactory} privelages with `ADMIN_ROLE`
     **/
    function removeBiddersRewardsFactoryContract()
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        biddersRewardsFactoryContract = BiddersRewardsFactory(address(0));

        emit AddressSet(BIDDERS_REWARDS_FACTORY, address(0));
    }

    /**
     * @notice User can call in order to create a participation tracking SFT for rewards program.
     * @dev This is an unrestricted call to mint the base SFT. The base type must be initialized with a single call to `createBaseType` passing `isSFT` as true.
     **/
    function mintBaseSFT(address to) external onlyAuthorized(MINTER_ROLE) {
        _mintNFT(to, BASE_SFT_ID, EMPTY_STR);
    }

    /**
     * @notice User can upgrade after upgrade criteria met to receive boosted portion rewards disbursements. Round bid count and cumulative bid amounts used as metrics.
     * @dev note: user MUST harvest old rewards from previous epoch/cycle biddrs rewards contracts before `upgradeToken` is called, as their old token is burned on upgrade. Dependencies: {NFTTracker} with optional {BiddersRewardsFactory}. If for some reason, `nextLevelId` is improperly encoded, call will revert. Functionality does not break - once next level is fixed, can be called again.
     * @param id Token id.
     **/
    function upgradeToken(uint256 id) external {
        uint64 bidThreshold;
        uint192 cumulativeBidThreshold;
        uint256 nextLevelId;
        uint256 baseType;
        address sender;

        sender = msg.sender;

        require(id == usersTokens[sender], "not token owner");

        baseType = id.getBaseType();

        (
            bidThreshold,
            cumulativeBidThreshold,
            nextLevelId,

        ) = nftTrackerContract.levelRequirements(baseType);

        require(
            bidThreshold > 0 && cumulativeBidThreshold > 0 && nextLevelId > 0,
            "next level requirements not set"
        );

        uint64 roundCount;
        uint192 cumulativeBidAmount;

        (roundCount, cumulativeBidAmount) = nftTrackerContract.nftTrackingMap(
            id
        );

        require(
            roundCount >= bidThreshold &&
                cumulativeBidAmount >= cumulativeBidThreshold,
            "threshold requirements not met"
        );

        burn(sender, id, UNITY);

        // should we retrieve a URI if available or too gassy?
        if (
            nextLevelId.isSemiFungibleBaseType() ||
            nextLevelId.isNonFungibleBaseType()
        ) {
            _mintNFT(sender, nextLevelId, EMPTY_STR);
        } else {
            revert("improper nextLevelId encoding");
        }

        uint256 index = maxIndexes[nextLevelId];
        uint256 newTokenId = nextLevelId | index;

        // if rewards contract is updated, harvest on old rewards contract called to get rewards on old id BEFORE upgrading
        if (address(biddersRewardsFactoryContract) != address(0)) {
            uint256 rewardsAddressesLength = biddersRewardsFactoryContract
                .getRewardsAddressesLength();

            if (rewardsAddressesLength > 1) {
                address previousRewardsContract = biddersRewardsFactoryContract
                    .rewardsAddresses(rewardsAddressesLength - 2);

                BiddersRewards(previousRewardsContract).harvestOnUpgrade(
                    msg.sender,
                    id
                );
            }

            if (rewardsAddressesLength > 0) {
                BiddersRewards(
                    biddersRewardsFactoryContract.rewardsAddresses(
                        rewardsAddressesLength - 1
                    )
                ).bumpDuringUpgrade(id, newTokenId);
            }
        }

        emit TokenUpgrade(baseType, sender, nextLevelId);
    }
}
