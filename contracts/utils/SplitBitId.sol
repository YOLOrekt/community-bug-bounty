pragma solidity 0.8.13;

library SplitBitId {
    // Store the type in the upper 128 bits..
    uint256 constant TYPE_MASK = type(uint256).max << 128;

    // ..and the non-fungible index in the lower 128
    uint256 constant NF_INDEX_MASK = type(uint128).max;

    // The top bit is a flag to tell if this is a NFT.
    uint256 constant TYPE_NF_BIT = 1 << 255;

    // Flag as 1100...00 for SFT.
    uint256 constant TYPE_SEMI_BIT = uint256(3) << 254;

    // note: use SEMI_BIT bitwise mask and then compare to NF_BIT
    function isNonFungible(uint256 _id) internal pure returns (bool) {
        return _id & TYPE_SEMI_BIT == TYPE_NF_BIT;
    }

    function isSemiFungible(uint256 _id) internal pure returns (bool) {
        return _id & TYPE_SEMI_BIT == TYPE_SEMI_BIT;
    }

    // note: operate with SEMI_BIT as mask but compare to NF_BIT
    function isNonFungibleItem(uint256 _id) internal pure returns (bool) {
        // A base type has the NF bit but does have an index.
        return
            (_id & TYPE_SEMI_BIT == TYPE_NF_BIT) && (_id & NF_INDEX_MASK != 0);
    }

    // note: operate with SEMI_BIT but compare to NF_BIT
    function isNonFungibleBaseType(uint256 _id) internal pure returns (bool) {
        // A base type has the NF bit but does not have an index.
        return
            (_id & TYPE_SEMI_BIT == TYPE_NF_BIT) && (_id & NF_INDEX_MASK == 0);
    }

    function isSemiFungibleItem(uint256 _id) internal pure returns (bool) {
        // A base type has the Semi bit but does have an index.
        return
            (_id & TYPE_SEMI_BIT == TYPE_SEMI_BIT) &&
            (_id & NF_INDEX_MASK != 0);
    }

    function isSemiFungibleBaseType(uint256 _id) internal pure returns (bool) {
        // A base type has the Semi bit but does not have an index.
        return
            (_id & TYPE_SEMI_BIT == TYPE_SEMI_BIT) &&
            (_id & NF_INDEX_MASK == 0);
    }

    function getNonFungibleIndex(uint256 _id) internal pure returns (uint256) {
        return _id & NF_INDEX_MASK;
    }

    function getBaseType(uint256 _id) internal pure returns (uint256) {
        return _id & TYPE_MASK;
    }

    function encodeNewNonFungibleBaseType(uint256 _rawNonce)
        internal
        pure
        returns (uint256)
    {
        return (_rawNonce << 128) | TYPE_NF_BIT;
    }

    function encodeNewSemiFungibleBaseType(uint256 _rawNonce)
        internal
        pure
        returns (uint256)
    {
        return (_rawNonce << 128) | TYPE_SEMI_BIT;
    }
}
