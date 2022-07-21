pragma solidity 0.8.13;

import {YoloRegistry} from "../core/YoloRegistry.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {BiddersRewards} from "./BiddersRewards.sol";
import {NFTTracker} from "../core/NFTTracker.sol";
import {YoloNFTPack} from "../tokens/YoloNFTPack.sol";
import {ADMIN_ROLE} from "../utils/constants.sol";
import {YOLO_NFT_PACK, NFT_TRACKER} from "../utils/constants.sol";
import {ZAA_NFTTracker, ZAA_YoloNFTPack, ZAA_rewardsAdmin} from "../utils/errors.sol";

contract BiddersRewardsFactory is RegistrySatellite {
    bool _hasStarted;
    uint256 public epoch;

    address[] public rewardsAddresses;

    event BiddersRewardsCreation(
        uint256 indexed epoch,
        address newRewardsAddress
    );

    constructor(address registryContractAddress_)
        RegistrySatellite(registryContractAddress_)
    {}

    /**
     * @notice Get `rewardsAddresses` array length.
     * @return uint256 length.
     **/
    function getRewardsAddressesLength() public view returns (uint256) {
        return rewardsAddresses.length;
    }

    function rotateRewardsContracts(address rewardsAdmin)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        if (rewardsAdmin == address(0)) revert ZAA_rewardsAdmin();

        address nftTrackerContractAddress = yoloRegistryContract
            .getContractAddress(NFT_TRACKER);

        if (nftTrackerContractAddress == address(0)) revert ZAA_NFTTracker();

        NFTTracker nftTrackerContract = NFTTracker(nftTrackerContractAddress);

        address yoloNftPackContractAddress = yoloRegistryContract
            .getContractAddress(YOLO_NFT_PACK);

        if (yoloNftPackContractAddress == address(0)) revert ZAA_YoloNFTPack();

        YoloNFTPack yoloNFTPackContract = YoloNFTPack(
            yoloNftPackContractAddress
        );

        address newRewardsAddress = address(
            new BiddersRewards(
                rewardsAdmin,
                address(yoloRegistryContract),
                ++epoch,
                nftTrackerContract,
                yoloNFTPackContract
            )
        );

        if (_hasStarted == true) {
            BiddersRewards priorRewardsContract = BiddersRewards(
                rewardsAddresses[getRewardsAddressesLength() - 1]
            );

            require(
                priorRewardsContract.hasFunding(),
                "prior cntct requires funds"
            );

            priorRewardsContract.releaseFunds();
        }

        rewardsAddresses.push(newRewardsAddress);

        nftTrackerContract.setBiddersRewardsContract(newRewardsAddress);

        if (_hasStarted == false) {
            _hasStarted = true;
        }

        emit BiddersRewardsCreation(epoch, newRewardsAddress);
    }

    function endRewards() external onlyAuthorized(ADMIN_ROLE) {
        require(_hasStarted == true, "rewards not started");

        address nftTrackerContractAddress = yoloRegistryContract
            .getContractAddress(NFT_TRACKER);

        if (nftTrackerContractAddress == address(0)) revert ZAA_NFTTracker();

        NFTTracker nftTrackerContract = NFTTracker(nftTrackerContractAddress);

        address yoloNftPackContractAddress = yoloRegistryContract
            .getContractAddress(YOLO_NFT_PACK);

        if (yoloNftPackContractAddress == address(0)) revert ZAA_YoloNFTPack();

        YoloNFTPack yoloNFTPackContract = YoloNFTPack(
            yoloNftPackContractAddress
        );

        BiddersRewards(rewardsAddresses[getRewardsAddressesLength() - 1])
            .releaseFunds();

        _hasStarted = false;

        nftTrackerContract.removeBiddersRewardsContract();
        yoloNFTPackContract.removeBiddersRewardsFactoryContract();
    }
}
