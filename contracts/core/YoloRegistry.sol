pragma solidity 0.8.13;

import {CoreCommon} from "./CoreCommon.sol";
import {ADMIN_ROLE} from "../utils/constants.sol";

/**
 * @title YoloRegistry
 * @author Garen Vartanian (@cryptokiddies)
 * @dev Controller contract which keeps track of critical yolo contracts info, including latest contract addresses and versions, and access control, incl. multisignature calls
 * review access control of satellites to simplify process. also review contract address management in line with contract version and instance deprecation pattern
 *
 */
contract YoloRegistry is CoreCommon {
    /**
     * @dev ContractDetails struct handles information for recognized contracts in the Yolo ecosystem.
     */
    struct ContractDetails {
        address contractAddress;
        uint48 version;
        uint48 latestVersion;
    }

    struct ContractArchiveDetails {
        bytes32 identifier;
        uint48 version;
    }

    bytes32 constant EMPTY_BYTES_HASH =
        0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    // recognized contracts in the Yolo ecosystem
    mapping(bytes32 => ContractDetails) contractRegistry;
    // game instances preapproved for factory minting
    mapping(address => bool) public registeredGames;
    // values used by system, e.g., min (or max) fee required in game/market
    mapping(bytes32 => uint256) public globalParameters;
    // game paused state statuses
    mapping(address => bool) public activeGames;
    // all contracts including those that have been rescinded or replaced mapped to their respective version numbers
    mapping(address => ContractArchiveDetails) public contractsArchive;

    event ContractRegistry(
        bytes32 indexed identifier,
        address indexed newAddress,
        address indexed oldAddress,
        uint96 newVersion
    );

    event ContractAddressRegistryRemoval(
        bytes32 indexed indentifier,
        address indexed rescindedAddress,
        uint96 version
    );

    event GameApproval(address indexed gameAddress, bool hasApproval);

    event GlobalParameterAssignment(bytes32 indexed paramName, uint256 value);

    modifier onlyGameContract() {
        require(registeredGames[msg.sender], "only game can set");
        _;
    }

    /**
     * @dev Note: Most critical role. Only give to the most trusted managers as they can revoke or destroy all control setting random values to management fields in AccessControl role mappings
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Used mainly by satellite contract constructors to grab registered addresses.
     */
    function getContractAddress(bytes32 identifier)
        public
        view
        returns (address)
    {
        return contractRegistry[identifier].contractAddress;
    }

    /**
     * @dev No internal uses at the moment. Necessary for handling migrations.
     */
    function getContractVersion(bytes32 identifier)
        public
        view
        returns (uint96)
    {
        return contractRegistry[identifier].version;
    }

    /**
     * @notice Setting registered contracts (described above).
     * @dev This is for contracts OTHER THAN {GameInstance} types; game factory should call `setApprovedGame`
     **/
    function setContract(bytes32 identifier, ContractDetails calldata newData)
        external
        onlyAdmin
    {
        bytes32 codehash = newData.contractAddress.codehash;

        require(
            codehash != EMPTY_BYTES_HASH && codehash != 0,
            "addr must be contract"
        );

        ContractDetails storage oldRegister = contractRegistry[identifier];

        require(!registeredGames[newData.contractAddress], "is game contract");

        ContractArchiveDetails memory contractArchive = contractsArchive[
            newData.contractAddress
        ];

        if (contractArchive.identifier != bytes32(0)) {
            require(
                identifier == contractArchive.identifier,
                "reinstating identifier mismatch"
            );

            require(
                newData.version == contractArchive.version,
                "reinstating version mismatch"
            );
        } else {
            require(
                newData.version == oldRegister.latestVersion + 1,
                "new version val must be 1 g.t."
            );

            oldRegister.latestVersion += 1;

            contractsArchive[newData.contractAddress] = ContractArchiveDetails(
                identifier,
                newData.version
            );
        }

        address oldAddress = oldRegister.contractAddress;

        oldRegister.contractAddress = newData.contractAddress;
        oldRegister.version = newData.version;

        emit ContractRegistry(
            identifier,
            newData.contractAddress,
            oldAddress,
            newData.version
        );
    }

    /**
     * @notice Removing a registered contract address.
     * @dev The contract, though unregistered, is maintained in the `contractsArchive` mapping.
     **/
    function removeContractAddress(bytes32 identifier) external onlyAdmin {
        ContractDetails storage registryStorage = contractRegistry[identifier];
        ContractDetails memory oldRegister = registryStorage;

        require(
            oldRegister.contractAddress != address(0),
            "identifier is not registered"
        );

        registryStorage.contractAddress = address(0);
        registryStorage.version = 0;

        emit ContractAddressRegistryRemoval(
            identifier,
            oldRegister.contractAddress,
            oldRegister.version
        );
    }

    /**
     * @notice Use this to preapprove factory games with create2 and a nonce salt: keccak hash of `abi.encodePacked(gameId, gameLength)`. `gameId` is itself a hash of the game pair, e.g. "ETH_USD"
     * @dev Can use EXTCODEHASH opcode whitelisting in future iterations. (Its usage forces redesigns for factory-spawned game contracts with immutable vars, given that their initialized values end up in the deployed bytecode.)
     **/
    function setApprovedGame(address gameAddress, bool hasApproval)
        external
        onlyAdmin
    {
        registeredGames[gameAddress] = hasApproval;

        emit GameApproval(gameAddress, hasApproval);
    }

    function setGameActive() external onlyGameContract {
        activeGames[msg.sender] = true;
    }

    function setGameInactive() external onlyGameContract {
        activeGames[msg.sender] = false;
    }

    /**
     * @notice Values used by system, e.g., min (or max) fee required in game/market. Good for setting boundary values and flags.
     * @dev For a bool, substitute 0 and 1 for false and true, respectively.
     **/
    function setGlobalParameters(bytes32 paramName, uint256 value)
        external
        onlyAdmin
    {
        globalParameters[paramName] = value;

        emit GlobalParameterAssignment(paramName, value);
    }
}
