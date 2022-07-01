pragma solidity 0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {YoloRegistry} from "../core/YoloRegistry.sol";
import {YoloNFTPack} from "../tokens/YoloNFTPack.sol";
import {SplitBitId} from "../utils/SplitBitId.sol";
import {YOLO_NFT_PACK} from "../utils/constants.sol";

/**
 * @title WhitelistSFTClaims
 * @author Garen Vartanian (@cryptokiddies)
 * @notice Provide time-limited mechanism for beta waitlistees to claim a limited Level 1 Yolo SFT for beta participation and rewards tracking.
 * @dev Give this {WhitelistSFTClaims} contract the `MINTER_ROLE` role in {YoloNFTPack}. Otherwise `mintBaseSFT` call will revert. Make sure the user can only claim for limited time (one month). Also, beta token admin should approve claims contract access to transfer (assuming same admin controls both here).
 */
contract WhitelistSFTClaims is RegistrySatellite {
    IERC20 public immutable usdcContract;

    uint256 immutable BASE_SFT_ID =
        SplitBitId.TYPE_SEMI_BIT | (uint256(1) << 128);

    uint256 public claimCounter;
    uint256 public campaignLimit;

    YoloNFTPack yoloNFTPackContract;

    mapping(address => uint256) public claimeesRegister;

    event SftTokensOffered(
        uint256 indexed startNftIndex,
        address[] claimees,
        uint256 expirationTime
    );
    event SFTIssuance(uint256 indexed tokenIndex, address indexed user);
    event SFTClaimExpiration(address indexed user, uint256 expirationTime);
    event Withdrawal(address indexed receiver, uint256 contractBalance);

    constructor(address registryContractAddress_, address usdcAddress_)
        RegistrySatellite(registryContractAddress_)
    {
        YoloRegistry yoloRegistryContract = YoloRegistry(
            registryContractAddress_
        );

        address yoloNFTPackAddress = yoloRegistryContract.getContractAddress(
            YOLO_NFT_PACK
        );

        require(
            yoloNFTPackAddress != address(0),
            "nft contract address must be specified"
        );

        yoloNFTPackContract = YoloNFTPack(yoloNFTPackAddress);

        // TODO: hardcode for production
        require(usdcAddress_ != address(0), "usdc address must be specified");

        usdcContract = IERC20(usdcAddress_);

        campaignLimit = 20000;
    }

    function setCampaignLimit(uint256 newLimit) external onlyAdmin {
        require(newLimit < 30000, "no insane numbers");

        campaignLimit = newLimit;
    }

    /**
     * @notice Encumber a batch of Level 1 Yolo SFTs for participants to claim.
     * @param claimees All beta participants who can claim a L1 SFT.
     * @param expirationWindow Expiration window offset in seconds, after which claims are ineligible and cleared.
     **/
    function batchOffer(address[] calldata claimees, uint256 expirationWindow)
        external
        onlyAdmin
    {
        uint256 startIndex = yoloNFTPackContract.maxIndexes(BASE_SFT_ID);
        uint256 claimeesLength = claimees.length;
        uint256 expirationTime = block.timestamp + expirationWindow;

        for (uint256 i = 0; i < claimeesLength; i++) {
            claimeesRegister[claimees[i]] = expirationTime;
        }

        emit SftTokensOffered(startIndex, claimees, expirationTime);
    }

    /**
     * @notice Beta participants who have tokens to claim call this.
     * @dev Requires `MINTER_ROLE` to be granted in {YoloNFT}.
     **/
    function claimNft() external {
        address sender = msg.sender;
        uint256 expireTime = claimeesRegister[sender];

        require(expireTime > 0, "invalid claim");

        if (block.timestamp < expireTime) {
            usdcContract.transferFrom(sender, address(this), 10e6);
            // will revert if level at capacity
            yoloNFTPackContract.mintBaseSFT(sender);

            uint256 tokenIndex = yoloNFTPackContract.maxIndexes(BASE_SFT_ID);
            uint256 id = BASE_SFT_ID | tokenIndex;

            require(claimCounter++ < campaignLimit, "campaign limit reached");

            emit SFTIssuance(id, sender);
        } else {
            emit SFTClaimExpiration(sender, expireTime);
        }

        claimeesRegister[sender] = 0;
    }

    function withdrawUSDC(address receiver) external onlyAdmin {
        uint256 contractBalance = usdcContract.balanceOf(address(this));

        usdcContract.transfer(receiver, contractBalance);

        emit Withdrawal(receiver, contractBalance);
    }
}
