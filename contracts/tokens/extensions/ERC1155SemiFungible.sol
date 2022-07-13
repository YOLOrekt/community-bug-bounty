pragma solidity 0.8.13;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Pausable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

import {RegistrySatellite} from "../../core/RegistrySatellite.sol";
import {ERC1155DynamicURI} from "./ERC1155DynamicURI.sol";
import {SplitBitId} from "../../utils/SplitBitId.sol";
import {MINTER_ROLE, PAUSER_ROLE} from "../../utils/constants.sol";

// import {LogBinary} from "../../utils/LogBinary.sol";
// import "hardhat/console.sol";

/**
 * @title ERC1155SemiFungible
 * @author Garen Vartanian (@cryptokiddies)
 * @notice Each address can only have one at most of each token. Credit @JamesTherien github @ enjin/erc-1155 for split bit.
 * @dev Modification of {ERC1155MixedFungible} to provide semi-fungible (SFT) and NFT support in split bit compact form w/max balance of 1 per address. SFT base types will all share the same metadata uri.
 */
abstract contract ERC1155SemiFungible is
    RegistrySatellite,
    ERC1155Burnable,
    ERC1155Pausable,
    ERC1155DynamicURI
{
    struct BasetypeManagement {
        uint128 balance;
        uint128 maxCapacity;
    }

    // Use a split bit implementation.
    using SplitBitId for uint256;

    bytes constant EMPTY_BYTES = "";
    // for minting NFT/SFT
    uint256 constant UNITY = 1;

    // Should be typed smaller than 127 to work with SEMI_BIT but should be far scarcer in practice
    uint120 private _nftNonce;
    uint120 private _semiFtNonce;

    mapping(uint256 => address) private _nftOwners;

    // TODO: discuss necessity of type existence checking, validation vs efficiency tradeoff
    mapping(uint256 => bool) public typeBirthCertificates;
    // gets token id for provided address; inverse of _nftOwners
    mapping(address => uint256) public usersTokens;
    // gets number of SFT/NFTs belonging to base type
    mapping(uint256 => uint120) public maxIndexes;
    // total balance by nft level
    mapping(uint256 => BasetypeManagement) public basetypesManagement;

    event TokenLevelMaxCapSetting(uint256 indexed basetype, uint256 maxCap);

    constructor() {
        grantRole(MINTER_ROLE, msg.sender);
        grantRole(PAUSER_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC1155, ERC1155DynamicURI)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Get owner address of SFT/NFT by ID.
     * @dev User should only have total balance of one token on contract for this logic to function properly.
     * @param id Token id.
     **/
    function ownerOf(uint256 id) public view returns (address) {
        return _nftOwners[id];
    }

    /**
     * @notice Return the `uri` for a unique NFT or for a SFT set.
     * @dev {ERC1155DynamicURI} defines custom logic for setting `uri` based on token classification of SFT vs NFT, which is determined by token id encoding.
     * @param id Token id.
     **/
    function uri(uint256 id)
        public
        view
        override(ERC1155DynamicURI, ERC1155)
        returns (string memory)
    {
        return ERC1155DynamicURI.uri(id);
    }

    /**
     * @notice Get owner address of SFT/NFT by ID.
     * @dev User should only have total balance of one token on contract for this logic to function properly.
     * @param id Token id.
     **/
    function balanceOf(address owner, uint256 id)
        public
        view
        override
        returns (uint256)
    {
        require(owner != address(0), "balance query for the zero address");
        return _nftOwners[id] == owner ? UNITY : 0;
    }

    /**
     * @notice Get owner balances of SFT/NFT by IDs.
     * @dev Each user should only have a total balance of one token on contract, i.e., one address can't have more than one token id mapped to it.
     * @param owners Token owner addresses.
     * @param ids Token ids sequentially mapped to owners array.
     **/
    function balanceOfBatch(address[] calldata owners, uint256[] calldata ids)
        public
        view
        override
        returns (uint256[] memory)
    {
        require(owners.length == ids.length);

        uint256[] memory balances_ = new uint256[](owners.length);

        for (uint256 i = 0; i < owners.length; ++i) {
            address owner = owners[i];

            require(owner != address(0), "balance query for the zero address");

            uint256 id = ids[i];

            balances_[i] = _nftOwners[id] == owner ? UNITY : 0;
        }

        return balances_;
    }

    /**
     * @dev Pauses all token transfers and mints. Caller must have the `PAUSER_ROLE`.
     */
    function pause() public {
        require(
            hasRole(PAUSER_ROLE, msg.sender),
            "must have pauser role to pause"
        );
        _pause();
    }

    /**
     * @dev Unpauses all token transfers and mints. Caller must have the `PAUSER_ROLE`.
     */
    function unpause() public {
        require(
            hasRole(PAUSER_ROLE, msg.sender),
            "must have pauser role to unpause"
        );
        _unpause();
    }

    /**
     * @notice Create the basetype to whitelist a new group of NFTs or SFTs.
     * @dev A boolean value sets basetype encoding to NFT/SFT with bit flags. Stores the basetype in the upper 128 bits.
     * @param isSFT True value sets basetype encoding to SFT.
     **/
    function createBaseType(bool isSFT) external onlyAuthorized(MINTER_ROLE) {
        uint256 baseType;

        if (isSFT) {
            baseType = (uint256(++_semiFtNonce)).encodeNewSemiFungibleBaseType();
            // console.log("Binary %s", (baseType).u256ToBinaryStr());
        } else {
            baseType = (uint256(++_nftNonce)).encodeNewNonFungibleBaseType();
        }

        typeBirthCertificates[baseType] = true;

        // emit a Transfer event with Create semantic to help with discovery.
        emit TransferSingle(
            msg.sender,
            address(0x0),
            address(0x0),
            baseType,
            0
        );
    }

    /**
     * @notice Unrestricted function to transfer token from address to another.
     * @dev Note: Must be hard coded to transfer one amount of token. Remove `amount` and `data` arg allocations as unused. Makes validation check on `msg.sender` or `_operatorApprovals` in ERC1155 parent contract.
     * @param from Sender's address.
     * @param to Receiver's address.
     * @param id Token id.
     **/
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256,
        bytes calldata
    ) public override {
        if (id.isSemiFungible() || id.isNonFungible()) {
            require(usersTokens[to] == 0, "receiver already has a token");

            _nftOwners[id] = to;
            usersTokens[from] = 0;
            usersTokens[to] = id;
        }

        // note: has transfer one (`UNITY`) amount
        super.safeTransferFrom(from, to, id, UNITY, EMPTY_BYTES);
    }

    /**
     * @notice Unrestricted function to transfer token from address to another.
     * @dev Note: Must be hard coded to transfer one amount of token. Only one id can be passed into `ids` because each user can only own one token. Remove `amounts` and `data` arg allocations as unused. Create singleton `amounts` array in memory. Makes validation check on `msg.sender` or `_operatorApprovals` in ERC1155 parent contract.
     * @param from Sender's address.
     * @param to Receiver's address.
     * @param ids Token id.
     **/
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata,
        bytes calldata
    ) public override {
        require(ids.length == UNITY, "ids length must be one");

        uint256 id = ids[0];

        if (id.isSemiFungible() || id.isNonFungible()) {
            // more kludge
            require(usersTokens[to] == 0, "receiver already has a token");

            _nftOwners[id] = to;
            usersTokens[from] = 0;
            usersTokens[to] = id;
        }

        uint256[] memory singletonAmounts = new uint256[](UNITY);
        singletonAmounts[0] = UNITY;

        super.safeBatchTransferFrom(
            from,
            to,
            ids,
            singletonAmounts,
            EMPTY_BYTES
        );
    }

    /**
     * @notice Unrestricted function to burn own token. Not recommended.
     * @dev Makes validation check on `msg.sender` or `_operatorApprovals` in ERC1155 parent contract.
     * @param account Burner's address.
     * @param id Token id.
     **/
    function burn(
        address account,
        uint256 id,
        uint256
    ) public override {
        usersTokens[account] = 0;
        _nftOwners[id] = address(0);

        uint256 baseType = id.getBaseType();

        super.burn(account, id, UNITY);

        --basetypesManagement[baseType].balance;
    }

    /**
     * @notice Set the `uri` for a token id, if the privelage has not been revoked.
     * @dev `newUri` should point to metadata json. The setting is possible until the privelage is revoked, by a one time call to `revokeSetURI` on a per id basis. Only `MINTER_ROLE` should be authorized. Other validation occurs in {ERC1155DynamicURI}.
     * @param id SFT basetype or NFT id only.
     * @param newUri SFT group or NFT `uri` value.
     **/
    function setURI(uint256 id, string memory newUri)
        external
        onlyAuthorized(MINTER_ROLE)
    {
        _setURI(id, newUri);
    }

    /**
     * @notice Set the maxCapacity value to prevent minting more than allowed for a given token level.
     * @param basetype SFT basetype or NFT id only.
     * @param maxCap Maximum balance for level.
     **/
    function setTokenLevelMaxCap(uint256 basetype, uint128 maxCap)
        external
        onlyAuthorized(MINTER_ROLE)
    {
        require(
            basetype.isSemiFungibleBaseType() ||
                basetype.isNonFungibleBaseType(),
            "improper id base type encoding"
        );

        basetypesManagement[basetype].maxCapacity = maxCap;

        emit TokenLevelMaxCapSetting(basetype, maxCap);
    }

    /**
     * @notice Revoke ability to change URI once it has a proper ipfs uri.
     * @dev Validation check occurs on internal function calls.
     * @param id Token id.
     **/
    function revokeSetURI(uint256 id) external onlyAuthorized(MINTER_ROLE) {
        _revokeSetURI(id);
    }

    /**
     * @dev Invoked by restricted `mintSFT` and `mintNFT`, as well as derived contract dependencies in and to {YoloNFTPack}. Invoked from `mintBaseSFT` and `upgradeToken` calls.
     * @param to Receiver address.
     * @param baseType NFT basetype to mint.
     * @param newURI URI of new NFT if available.
     **/
    function _mintNFT(
        address to,
        uint256 baseType,
        string memory newURI
    ) internal {
        require(
            baseType.isSemiFungibleBaseType() ||
                baseType.isNonFungibleBaseType(),
            "improper id base type encoding"
        );

        require(
            typeBirthCertificates[baseType] == true,
            "base type not yet created"
        );

        require(usersTokens[to] == 0, "receiver already has a token");

        uint128 newBalance = ++basetypesManagement[baseType].balance;

        require(
            newBalance <= basetypesManagement[baseType].maxCapacity,
            "mint exceeds token level cap"
        );

        // increment maxIndexes first, THEN assign index
        uint256 index = ++maxIndexes[baseType];

        uint256 id = baseType | index;

        _nftOwners[id] = to;
        usersTokens[to] = id;

        super._mint(to, id, UNITY, EMPTY_BYTES);
        if (bytes(newURI).length > 0) {
            _setURI(id, newURI);
        }
    }

    /**
     * @dev Passes call to parent {ERC1155DynamicURI}.
     * @param id Token id.
     * @param newUri New metadata uri.
     **/
    function _setURI(uint256 id, string memory newUri) internal override {
        ERC1155DynamicURI._setURI(id, newUri);
    }

    /**
     * @notice Check if token exists and pass call to {ERC1155DynamicURI}.
     * @dev Validation check on `_nftOwners` mapping.
     * @param id Token id.
     **/
    function _revokeSetURI(uint256 id) internal override {
        require(_nftOwners[id] != address(0), "no revoke on nonexistant token");

        ERC1155DynamicURI._revokeSetURI(id);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Pausable) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * @dev Disable burnBatch as not specified in IERC1155.
     */
    function burnBatch(
        address,
        uint256[] memory,
        uint256[] memory
    ) public pure override {
        revert("burnBatch disabled");
    }
}
