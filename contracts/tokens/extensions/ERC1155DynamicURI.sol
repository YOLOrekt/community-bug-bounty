pragma solidity 0.8.13;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {RegistrySatellite} from "../../core/RegistrySatellite.sol";
import {SplitBitId} from "../../utils/SplitBitId.sol";
import {MINTER_ROLE} from "../../utils/constants.sol";

/**
 * @dev This is a bypass for {IERC1155MetadataURI} with custom `setURI` quasi function overload for dynamic id-specific URIs, in order to provide long term support for IPFS CIDs. Since IPFS folders require all file content determined at creation, it isn't trivial or economical to add more files post creation, i.e. it isn't possible to set a base URI and add additional files later without reconstituting all file contents inside a new IPFS folder.
 */
abstract contract ERC1155DynamicURI is RegistrySatellite, ERC1155 {
    using SplitBitId for uint256;

    string constant EMPTY_STR = "";

    mapping(uint256 => string) private _uris;
    mapping(uint256 => bool) private _isSetURIRevoked;

    // from IERC1155
    // event URI(string value, uint256 indexed id);

    event SetURIRevocation(uint256 indexed id);

    modifier uriStartsWithIPFS(string memory where) {
        bytes memory whatBytes = bytes("ipfs://");
        bytes memory whereBytes = bytes(where);

        require(whereBytes.length >= uint256(53), "must be CID v0 or greater"); // ipfs:// + base 58 (length 46)

        bool found = true;

        for (uint256 i = 0; i < 7; i++) {
            if (whereBytes[i] != whatBytes[i]) {
                found = false;
                break;
            }
        }

        require(found, "uri prefix must be: ipfs://");

        _;
    }

    constructor() ERC1155(EMPTY_STR) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Return the `uri` for a unique NFT or for a SFT set.
     * @dev {ERC1155DynamicURI} defines custom logic for setting `uri` based on token classification of SFT vs NFT, which is determined by token id encoding. SFTs of the same level/group/class share a basetype and thus `uri`.
     * @param id Token id.
     **/
    function uri(uint256 id)
        public
        view
        virtual
        override
        returns (string memory _uri)
    {
        if (id.isSemiFungible()) {
            uint256 baseType = id.getBaseType();
            _uri = _uris[baseType];
        } else {
            _uri = _uris[id];
        }
    }

    /**
     * @notice Set the `uri` for a token id, if the privelage has not been revoked.
     * @dev `newUri` should point to metadata json. The setting is possible until the privelage is revoked, by a one time call to `revokeSetURI` on a per id basis. Revoke should be called after an IPFS uri has been pinned.
     * @param id Token id.
     * @param newUri SFT group or NFT `uri` value.
     **/
    function _setURI(uint256 id, string memory newUri) internal virtual {
        require(_isSetURIRevoked[id] == false, "setter role revoked for id");

        require(
            id.isSemiFungibleBaseType() || id.isNonFungibleItem(),
            "must be SFT basetype or NFT"
        );

        _uris[id] = newUri;

        emit URI(newUri, id);
    }

    /**
     * @dev Revoke the setURI call privelage once
     * the ipfs-ish metadata URI is set.
     * Requirements: the caller must have the `MINTER_ROLE`.
     */
    function _revokeSetURI(uint256 id)
        internal
        virtual
        onlyAuthorized(MINTER_ROLE)
        uriStartsWithIPFS(uri(id))
    {
        require(_isSetURIRevoked[id] == false, "setURI on id already revoked");

        _isSetURIRevoked[id] = true;

        emit SetURIRevocation(id);
    }
}
