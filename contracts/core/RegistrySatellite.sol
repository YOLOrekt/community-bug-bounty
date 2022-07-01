pragma solidity 0.8.13;

import {CoreCommon} from "./CoreCommon.sol";
import {YoloRegistry} from "./YoloRegistry.sol";
import {ADMIN_ROLE} from "../utils/constants.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title RegistrySatellite
 * @author Garen Vartanian (@cryptokiddies)
 * @dev Base contract for all Yolo contracts that depend on {YoloRegistry} for references on other contracts (particularly their active addresses), supported assets (and their token addresses if applicable), registered game contracts, and master admins
 */
abstract contract RegistrySatellite is CoreCommon {
    // TODO: make `yoloRegistryContract` a constant hard-coded value after registry deployment

    YoloRegistry public immutable yoloRegistryContract;

    constructor(address yoloRegistryAddress_) {
        require(
            yoloRegistryAddress_ != address(0),
            "yoloRegistry cannot be zero address"
        );

        yoloRegistryContract = YoloRegistry(yoloRegistryAddress_);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    event AddressSet(
        bytes32 indexed contractIdentifier,
        address indexed contractAddress
    );

    /**
     * @notice Check for authorization on local contract and fallback to {YoloRegistry} for additional checks.
     * @dev !!! should we simplify and replace access control on satellite contracts to simple owner address role, i.e., replace first check `hasRole(role, msg.sender)` with `msg.sender == owner`? Or do we move all role checks into registry contract?
     * @param role Role key to check authorization on.
     **/
    modifier onlyAuthorized(bytes32 role) {
        // require(
        //     hasRole(role, msg.sender) ||
        //         yoloRegistryContract.hasRole(role, msg.sender) ||
        //         yoloRegistryContract.hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
        //         yoloRegistryContract.hasRole(ADMIN_ROLE, msg.sender),
        //     "must have authorization"
        // );
        if (
            !hasRole(role, msg.sender) &&
            !yoloRegistryContract.hasRole(role, msg.sender)
        ) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        Strings.toHexString(uint160(msg.sender), 20),
                        " is missing role ",
                        Strings.toHexString(uint256(role), 32)
                    )
                )
            );
        }
        _;
    }

    /**
     * @notice Check for authorization on {GameInstance} contract registered in {YoloRegistry}.
     * @dev important to audit security on this call
     **/
    modifier onlyGameContract() {
        require(
            yoloRegistryContract.registeredGames(msg.sender),
            "caller isnt approved game cntrct"
        );
        _;
    }
}