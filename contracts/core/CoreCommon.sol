pragma solidity 0.8.13;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {ADMIN_ROLE} from "../utils/constants.sol";

/**
 * @title CoreCommon
 * @author Garen Vartanian (@cryptokiddies)
 * @dev pulling in {CoreCommon} will also bring in {AccessControlEnumerable},
 * {AccessControl}, {ERC165} and {Context} contracts/libraries. {ERC165} will support IAccessControl and IERC165 interfaces.
 */
abstract contract CoreCommon is AccessControlEnumerable {
    /**
     * @notice used to restrict critical method calls to admin only
     * @dev consider removing `ADMIN_ROLE` altogether, although it may be useful in near future for assigning roles.
     */
    modifier onlyAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(ADMIN_ROLE, msg.sender),
            "Must have admin role to invoke"
        );
        _;
    }
}
