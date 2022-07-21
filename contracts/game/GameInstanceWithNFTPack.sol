// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GameInstance} from "./GameInstance.sol";
import {YoloRegistry} from "../core/YoloRegistry.sol";
import {NFTTracker} from "../core/NFTTracker.sol";
import {YoloNFTPack} from "../tokens/YoloNFTPack.sol";
import {USDC_TOKEN, YOLO_NFT_PACK, NFT_TRACKER} from "../utils/constants.sol";
import {ZAA_NFTTracker, ZAA_YoloNFTPack} from "../utils/errors.sol";

/**
 * @title GameInstanceWithNFTPack
 * @author Garen Vartanian (@cryptokiddies)
 * @notice Bespoke {GameInstance} child contract to handle YOLO NFT checks for platform participation.
 * @dev Make sure to revisit {GameInstanceWithNft} before production as well as using new {NFTTracker} contract to enhance participation tracking.
 */
contract GameInstanceWithNFTPack is GameInstance {
    YoloNFTPack yoloNFTPackContract;
    NFTTracker nftTrackerContract;

    /**
     * @dev See {GameInstance}.
     **/
    constructor(
        address gameAdmin_,
        address registryContractAddress_,
        bytes32 gamePair_,
        uint256 gameLength_,
        uint256 roundIndex_,
        uint256 maxStartDelay_
    )
        GameInstance(
            gameAdmin_,
            registryContractAddress_,
            gamePair_,
            gameLength_,
            roundIndex_,
            maxStartDelay_
        )
    {
        YoloRegistry yoloRegistryContract = YoloRegistry(
            registryContractAddress_
        );

        address yoloNftAddress = yoloRegistryContract.getContractAddress(
            YOLO_NFT_PACK
        );

        if (yoloNftAddress == address(0)) revert ZAA_YoloNFTPack();

        yoloNFTPackContract = YoloNFTPack(yoloNftAddress);

        address nftTrackerAddress = yoloRegistryContract.getContractAddress(
            NFT_TRACKER
        );

        if (nftTrackerAddress == address(0)) revert ZAA_NFTTracker();

        nftTrackerContract = NFTTracker(nftTrackerAddress);
    }

    /**
     * @notice Bid in USDC token within a prediction round. Tracks participation, if user holds yolo SFT/NFT.
     * @dev Will call base {GameInstance} after {YoloNFTPack} check. Will call {NFTTracker} after successful bid. Yolo S|NFT ownership is optional.
     * @param amount Amount of bid in USDC token.
     * @param isUp Direction of bid.
     * @param bidRound Round value.
     **/
    function bidInYolo(
        uint96 amount,
        bool isUp,
        uint72 bidRound
    ) public override {
        super.bidInYolo(amount, isUp, bidRound);

        uint256 tokenId = yoloNFTPackContract.usersTokens(msg.sender);

        if (tokenId > 0) {
            nftTrackerContract.updateTracking(
                tokenId,
                uint192(amount),
                GAME_ID,
                bidRound
            );
        }
    }
}
