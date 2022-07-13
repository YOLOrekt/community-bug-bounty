pragma solidity 0.8.13;

import {YoloRegistry} from "./YoloRegistry.sol";
import {RegistrySatellite} from "./RegistrySatellite.sol";
import {LiquidityPool} from "./LiquidityPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LIQUIDITY_POOL, USDC_TOKEN, ADMIN_ROLE} from "../utils/constants.sol";

/**
 * @title YoloWallet
 * @author Garen Vartanian (@cryptokiddies)
 * @dev Important contract as it pools both user and liquidity pool (market maker) USDC token deposits into Yolo market system. Also maps addresses to usernames.
 */
contract YoloWallet is RegistrySatellite {
    using SafeERC20 for IERC20;

    uint256 constant BASIS_FEE_FACTOR = 10000;

    uint256 treasuryFeeBP;
    address lpAddress;
    address treasuryAddress;

    IERC20 stablecoinTokenContract;

    mapping(address => uint256) public balances; // balances in USDC
    // TODO: username struct bytes 31 & bool
    mapping(address => bytes32) public userNames;
    mapping(bytes32 => bool) public userNameChecks;

    event UsernameSet(
        bytes32 indexed previousUsername,
        address indexed sender,
        bytes32 indexed newUsername
    );
    event LiquidityReturn(address lpAddress, uint256 amount);
    event LiquidityReturnWithSplit(
        address lpAddress,
        uint256 lpAmount,
        address treasuryAddress,
        uint256 treasuryAmount,
        uint256 treasuryFeeBP
    );
    event TreasurySplitUpdate(
        address indexed treasuryAddress,
        uint256 newSplit
    );
    event TreasuryAddressUpdate(address indexed treasuryAddress);

    error EmptyLPAddress();

    constructor(address registryContractAddress_)
        RegistrySatellite(registryContractAddress_)
    {
        YoloRegistry registryContract = YoloRegistry(registryContractAddress_);

        address stablecoinTokenContractAddress = registryContract
            .getContractAddress(USDC_TOKEN);
        require(
            stablecoinTokenContractAddress != address(0),
            "token contract address cannot be zero"
        );

        stablecoinTokenContract = IERC20(stablecoinTokenContractAddress);
    }

    function setTreasuryAddress(address newTreasuryAddress)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        require(
            newTreasuryAddress != address(0),
            "treasury addr must not be zero"
        );

        treasuryAddress = newTreasuryAddress;

        emit TreasuryAddressUpdate(newTreasuryAddress);
    }

    function setTreasurySplit(uint256 newBasisPoints)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        require(
            treasuryFeeBP < BASIS_FEE_FACTOR / 4,
            "must be l.t. quarter lp fee"
        );
        treasuryFeeBP = newBasisPoints;

        emit TreasurySplitUpdate(treasuryAddress, newBasisPoints);
    }

    /**
     * @notice Set a 32 ascii character username. Can only set a name that has not been claimed by another user. Cannot set to 0x00 aka "null".
     * @dev Can set name of sender address. If the name already exists, revert. If the user had a previous name, remove that exclusive claim.
     * @param userName New username.
     **/
    function setUserNames(bytes32 userName) external {
        address sender = msg.sender;

        require(userName != bytes32(0), "username cannot be null value");

        require(userNameChecks[userName] == false, "username already exists");

        bytes32 previousUsername = userNames[sender];

        if (previousUsername != bytes32(0)) {
            userNameChecks[previousUsername] = false;
        }

        userNames[sender] = userName;
        userNameChecks[userName] = true;

        emit UsernameSet(previousUsername, sender, userName);
    }

    /**
     * @notice Set {LiquidityPool} address.
     * @dev Required before any liquidity can be deposited with mint functions in {LiquidityPool}. Can make it a one-time call for absolute security.
     **/
    function setLiquidityPool() external onlyAuthorized(ADMIN_ROLE) {
        address lpAddr = yoloRegistryContract.getContractAddress(
            LIQUIDITY_POOL
        );

        if (lpAddr == address(0)) {
            revert EmptyLPAddress();
        }

        lpAddress = lpAddr;

        _grantRole(LIQUIDITY_POOL, lpAddr);
    }

    /**
     * @notice {LiquidityPool} invoked function to increase liquidity pool wallet balance.
     * @dev This will not work unless `setMarketMakerRole` is called first.
     * @param amount The amount of USDC token to increase the liquidity pool account by.
     **/
    function updateLiquidityPoolBalance(uint256 amount)
        external
        onlyAuthorized(LIQUIDITY_POOL)
    {
        if (lpAddress == address(0)) {
            revert EmptyLPAddress();
        }

        balances[lpAddress] += amount;
    }

    /**
     * @notice {LiquidityPool} invoked function to decrease liquidity pool wallet balance when providers burn YLP tokens in exchange for USDC tokens transfer.
     * @param amount The amount of USDC token to increase the liquidity pool account by.
     **/
    function reduceLiquidityPoolBalance(address receiver, uint256 amount)
        external
        onlyAuthorized(LIQUIDITY_POOL)
    {
        if (lpAddress == address(0)) {
            revert EmptyLPAddress();
        }

        balances[lpAddress] -= amount;

        stablecoinTokenContract.safeTransfer(receiver, amount);
    }

    // TODO: adjust modifiers or design to allow a `SPECIAL_MIGRATOR_ROLE` to migrate tokens and user balances to future versions of {YoloWallet} contract. "Migration debt" mapping pattern.
    /**
     * @notice Game invoked internal transaction to batch update user balances, intended mainly for game settlements.
     * @dev should avoid loss altogether and try to reduce user balances on every user action instead. Additionally a try catch to handle balances that go below zero, as that is a serious error state.
     * @param user User address.
     * @param amount Amount to increase user balances by.
     **/
    /// @custom:scribble #if_succeeds balances[user] >= old(balances[user]);
    function gameUpdateUserBalance(address user, uint256 amount)
        external
        onlyGameContract
    {
        balances[user] += amount;
    }

    /**
     * @notice Game invoked internal transaction to update single user balance, mainly during game bids.
     * @dev Critical audits and reviews of this function (and contract) required.
     * @param user User addresses.
     * @param amount Updated balance amounts. Typically to reduce balane by bid amount.
     **/
    function gameReduceUserBalance(address user, uint256 amount)
        external
        onlyGameContract
    {
        balances[user] -= amount;
    }

    /**
     * @notice Game invoked internal call to transfer USDC ({IERC20}) balance from the game to {LiquidityPool} address as fees.
     * @dev Critical audits and reviews of this function (and contract) required.
     * @param recipient Pool address.
     * @param lpReturn Amount of funds returned from settlement minus fees.
     * @param fees Fees drawn during round settlement.
     **/
    function returnLiquidity(
        address recipient,
        uint256 lpReturn,
        uint256 fees
    ) external onlyGameContract {
        uint256 splitFee = treasuryFeeBP;
        address treasuryAddr = treasuryAddress;

        if (splitFee > 0 && treasuryAddress != address(0)) {
            uint256 lpAmount = (fees * (BASIS_FEE_FACTOR - splitFee)) /
                BASIS_FEE_FACTOR +
                lpReturn;
            uint256 treasuryAmount = (fees * splitFee) / BASIS_FEE_FACTOR;

            balances[recipient] += lpAmount;
            balances[treasuryAddr] += treasuryAmount;
            emit LiquidityReturnWithSplit(
                recipient,
                lpAmount,
                treasuryAddr,
                treasuryAmount,
                splitFee
            );
        } else {
            uint256 lpAmount = lpReturn + fees;
            balances[recipient] += lpAmount;
            emit LiquidityReturn(recipient, lpAmount);
        }
    }

    /**
     * @notice Users call to withdraw USDC ({IERC20}) tokens from the {YoloWallet} contract to user's sender address.
     * @dev Critical audits and reviews of this function (and contract) required.
     * @param amount Amount of token transfer to sender.
     **/
    function withdraw(uint256 amount) external {
        address sender = msg.sender;

        require(amount > 0, "amount must be greater than 0");
        require(amount <= balances[sender], "withdraw amount exceeds balance");

        balances[sender] -= amount;

        stablecoinTokenContract.safeTransfer(sender, amount);
    }

    /**
     * @notice Auxiliary function to deposit USDC ({IERC20}) tokens to the {YoloWallet} contract from user's sender address.
     * @dev Useful for testing. Not a useful call for user as game instance will auto transfer any shortfall in funds directly.
     * @param amount Amount of token transfer to sender.
     **/
    function deposit(uint256 amount) external {
        address sender = msg.sender;
        require(amount > 0, "amount must be greater than 0");

        stablecoinTokenContract.safeTransferFrom(sender, address(this), amount);

        balances[sender] += amount;
    }
}
