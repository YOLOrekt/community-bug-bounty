// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {YoloRegistry} from "../core/YoloRegistry.sol";
import {RegistrySatellite} from "../core/RegistrySatellite.sol";
import {GameInstanceWithNFTPack} from "./GameInstanceWithNFTPack.sol";
import {ADMIN_ROLE} from "../utils/constants.sol";

/**
 * @title GameFactory
 * @author Garen Vartanian (@cryptokiddies)
 * @notice Create new {GameInstanceWithNFTPack} for unique `gamePairHash` and `gameLength`.
 * @dev The factory is in charge of minting new game instances for a given pair and game length (block duration). Already existing doubles will revert.
 *NOTE*: Current design is to require the game to be registered in the registry contract before it can be minted. This is possible through the use of the create2 opcode in order to approve a contract address before the contract itself exists (counterfactual).
 */
contract GameFactoryWithNFTPack is RegistrySatellite {
    // hash of gameId and game length abi packed encoded
    mapping(bytes32 => address) public gameAddresses;

    event GameCreation(
        bytes32 indexed gameId,
        bytes32 indexed gamePairHash,
        uint256 indexed gameLength,
        address gameAddress,
        uint256 roundIndex,
        uint256 maxStartDelay
    );

    constructor(address registryContractAddress_)
        RegistrySatellite(registryContractAddress_)
    {}

    /**
     * @notice Get `gameId` unique double which identifies a game instance.
     * @dev `abi.encodePacked` is effectively same as `abi.encode` for these full word (bytes32, uint256) arg types.
     * @param gamePairHash Keccak256 hash of game pair string, e.g., "ETH_USD".
     * @param gameLength Number of seconds before the game round can be settled.
     * @return gameId bytes32 hash.
     **/
    function getGameId(bytes32 gamePairHash, uint256 gameLength)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(gamePairHash, gameLength));
    }

    /**
     * @notice Predict new {GameInstanceWithNFTPack} address based on instantiation arguments.
     * @dev Can recreate this with offchain ethereum libraries.
     * @param gameAdmin Admin address.
     * @param registryContractAddress {YoloRegistry} address.
     * @param gamePairHash Keccak256 hash of game pair string, e.g., "ETH_USD".
     * @param gameLength Number of seconds before the game round can be settled.
     * @return (address) Counterfactual address of {GameInstanceWithNFTPack}.
     **/
    function getPredictedGameAddress(
        address gameAdmin,
        address registryContractAddress,
        bytes32 gamePairHash,
        uint256 gameLength,
        uint256 roundIndex,
        uint256 maxStartDelay
    ) public view returns (address) {
        bytes32 gameId = getGameId(gamePairHash, gameLength);

        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                gameId,
                                keccak256(
                                    abi.encodePacked(
                                        type(GameInstanceWithNFTPack)
                                            .creationCode,
                                        abi.encode(
                                            gameAdmin,
                                            registryContractAddress,
                                            gamePairHash,
                                            gameLength,
                                            roundIndex,
                                            maxStartDelay
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            );
    }

    /**
     * @notice New {GameInstanceWithNFTPack} creation.
     * @dev Checks for counterfactual address registration on {YoloRegistry} before instantiation.
     * @param gameAdmin Admin address.
     * @param registryContractAddress {YoloRegistry} address.
     * @param gamePairHash Keccak256 hash of game pair, e.g., "ETH_USD".
     * @param gameLength Number of seconds before the game round can be settled.
     **/
    function createGame(
        address gameAdmin,
        address registryContractAddress,
        bytes32 gamePairHash,
        uint256 gameLength,
        uint256 roundIndex,
        uint256 maxStartDelay
    ) external onlyAuthorized(ADMIN_ROLE) {
        bytes32 gameId = getGameId(gamePairHash, gameLength);

        require(
            gameAddresses[gameId] == address(0),
            "game configuration instance exists"
        );

        require(
            yoloRegistryContract.registeredGames(
                getPredictedGameAddress(
                    gameAdmin,
                    registryContractAddress,
                    gamePairHash,
                    gameLength,
                    roundIndex,
                    maxStartDelay
                )
            ) == true,
            "game instance not approved for deployment"
        );

        address newGameAddress = address(
            new GameInstanceWithNFTPack{salt: gameId}(
                gameAdmin,
                registryContractAddress,
                gamePairHash,
                gameLength,
                roundIndex,
                maxStartDelay
            )
        );

        gameAddresses[gameId] = newGameAddress;

        emit GameCreation(
            gameId,
            gamePairHash,
            gameLength,
            newGameAddress,
            roundIndex,
            maxStartDelay
        );
    }
}
