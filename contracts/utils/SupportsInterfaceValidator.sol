pragma solidity 0.8.13;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

library SupportsInterfaceValidator {
    bytes4 constant supportsInterfaceSelector =
        bytes4(keccak256(bytes("supportsInterface")));

    function _validateContractLowLevel(
        address receiverAddress,
        bytes4[] calldata interfaceIds
    ) internal returns (bool) {
        bool hasSupport;
        uint256 idsLength = interfaceIds.length;
        for (uint256 i = 0; i < idsLength; i++) {
            (bool success, bytes memory data) = receiverAddress.call(
                abi.encodeWithSelector(
                    supportsInterfaceSelector,
                    interfaceIds[i]
                )
            );
            if (success) {
                bool result = abi.decode(data, (bool));
                if (result) {
                    hasSupport = true;
                    break;
                }
            }
        }
        return hasSupport;
    }

    function _validateContract(
        address receiverAddress,
        bytes4[] calldata interfaceIds
    ) internal view returns (bool) {
        bool hasSupport;
        uint256 idsLength = interfaceIds.length;
        for (uint256 i = 0; i < idsLength; i++) {
            if (IERC165(receiverAddress).supportsInterface(interfaceIds[i])) {
                hasSupport = true;
                break;
            }
        }
        return hasSupport;
    }
}
