// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @dev {ERC20} token, including:
 *
 *  - Preminted initial supply
 *  - No access control mechanism (for minting/pausing) and hence no governance
 *  From OpenZep
 * _Available since v3.4._
 */
contract StablecoinToken is ERC20, ERC165 {
    /**
     * @dev Mints `initialSupply` amount of token and transfers them to `owner`.
     *
     * See {ERC20-constructor}.
     */
    constructor(
        string memory name,
        string memory symbol,
        address owner
    ) ERC20(name, symbol) {
        require(bytes(name).length != 0, "token name must be specified");
        require(bytes(symbol).length != 0, "token symbol must be specified");
        uint256 amount = 10**9 * 10**18; // 1 Billion Tokens
        _mint(owner, amount);
    }

    // 0x36372b07 is IERC20 id
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return
            interfaceId == type(IERC20).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
