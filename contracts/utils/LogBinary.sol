pragma solidity 0.8.13;

library LogBinary {
    // no concat saves 180k gas - spend ~80.5k
    function u256ToBinaryStr(uint256 _y) internal pure returns (string memory) {
        uint256 x = _y;

        uint256 i;
        uint256 j;
        bytes memory mirrored = new bytes(256);
        bytes memory binaries = new bytes(256);

        while (x > 0) {
            uint256 mod;
            mod = x % 2;
            x /= 2;

            if (mod == 0) {
                mirrored[i++] = "0"; // 0x30
            } else {
                mirrored[i++] = "1"; // 0x31
            }
        }

        while (j < 256 - i) {
            binaries[j++] = "0";
        }

        for (uint256 k; j < 256; k++) {
            binaries[j++] = mirrored[i - 1 - k];
        }

        return string(binaries);
    }

    function uintArbitraryToBinaryStr(uint256 _y, uint256 _typeSize)
        internal
        pure
        returns (string memory)
    {
        unchecked {
            require(
                _typeSize <= 256 && _y < 2**_typeSize - 1,
                "value must not overflow type"
            );
        }

        uint256 x = _y;

        uint256 i;
        uint256 j;
        bytes memory mirrored = new bytes(_typeSize);
        bytes memory binaries = new bytes(uint16(_typeSize));

        while (x > 0) {
            uint256 mod;
            mod = x % 2;
            x /= 2;

            if (mod == 0) {
                mirrored[i++] = "0"; // 0x30
            } else {
                mirrored[i++] = "1"; // 0x31
            }
        }

        while (j < _typeSize - i) {
            binaries[j++] = "0";
        }

        for (uint256 k; j < _typeSize; k++) {
            binaries[j++] = mirrored[i - 1 - k];
        }

        return string(binaries);
    }
}
