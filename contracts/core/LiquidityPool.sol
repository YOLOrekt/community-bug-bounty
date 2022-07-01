pragma solidity 0.8.13;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ILiquidityPool} from "./ILiquidityPool.sol";
import {RegistrySatellite, YoloRegistry, CoreCommon} from "./RegistrySatellite.sol";
import {YoloShareTokens} from "../tokens/YoloShareTokens.sol";
import {YoloWallet} from "./YoloWallet.sol";
import {IYoloGame} from "../game/IYoloGame.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {USDC_TOKEN, YOLO_SHARES, YOLO_WALLET, ADMIN_ROLE, USDC_DECIMALS} from "../utils/constants.sol";

/**
 * @title LiquidityPool
 * @author Garen Vartanian (@cryptokiddies)
 * @author Yogesh Srihari(@yogeshgo05)
 * @dev :
 *  - grant a minter role to this contract from admin that allows for token minting
 *  - ability for holders to burn (destroy) their tokens
 *  - a pauser role that allows to stop all token transfers
 *
 * This contract uses {AccessControl} via {RegistrySatellite} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 */
contract LiquidityPool is ILiquidityPool, YoloShareTokens, RegistrySatellite {
    using SafeERC20 for ERC20;

    uint256 constant TWO_THOUSAND_TOKENS = 2000 * USDC_DECIMALS;

    // immutable because if either contract changes, a new LP cntct should be deployed anyway, so token migration can commence in clear, sequential steps
    ERC20 public immutable stablecoinTokenContract;
    YoloWallet public immutable walletContract;

    uint256 public protectionFactor;
    uint256 public marketLimit;
    uint256 public minimumDepositAmount;

    event MarketLimitUpdate(uint256 newLimitValue);

    modifier whenNotLPBalance() {
        require(totalSupply() == 0, "LP tokens are in circulation");
        _;
    }

    modifier whenLPBalance() {
        require(totalSupply() != 0, "must mint initial LP tokens");
        _;
    }

    modifier gtMinimumDepositBalance(uint256 depositAmount) {
        uint256 totalSupply = totalSupply();

        uint256 previousBalance = totalSupply > 0
            ? (balanceOf(msg.sender) * walletContract.balances(address(this))) /
                totalSupply
            : 0;

        require(
            depositAmount + previousBalance >= minimumDepositAmount,
            "amt must be g.t.e. 400 USDC"
        );
        _;
    }

    constructor(address registryContractAddress_)
        RegistrySatellite(registryContractAddress_)
    {
        YoloRegistry yoloRegistryContract = YoloRegistry(
            registryContractAddress_
        );

        address usdcTokenAddress = yoloRegistryContract.getContractAddress(
            USDC_TOKEN
        );

        require(
            usdcTokenAddress != address(0),
            "usdc token contract not registered"
        );

        address yoloWalletAddress = yoloRegistryContract.getContractAddress(
            YOLO_WALLET
        );
        require(
            yoloWalletAddress != address(0),
            "wallet contract not registered"
        );

        stablecoinTokenContract = ERC20(usdcTokenAddress);
        walletContract = YoloWallet(yoloWalletAddress);

        protectionFactor = 1000;
        minimumDepositAmount = 400 * USDC_DECIMALS;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable, YoloShareTokens)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Sets `protectionFactor` value as part of additional guard layer on higher frequency `marketLimit` adjustments. See: `setMarketLimit` below.
     * @dev This value should float between ~500-20000 and updated only on big pool swings.
     * @param newFactor Simple factor to denominate acceptable marketLimit value in `setMarketLimit`.
     **/
    function setProtectionFactor(uint256 newFactor)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        protectionFactor = newFactor;
    }

    /**
     * @notice Sets `minimumDepositAmount` value regulatory mechanism on liquidity provision.
     * @dev This value should be denominated with 6 decimal places per USDC contract.
     * @param newMinimum Minimum USDC maintenance amount for liquidity provision.
     **/
    function setMinimumDepositAmount(uint256 newMinimum)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        minimumDepositAmount = newMinimum;
    }

    /**
     * @notice Mints initial LP shares if none exist.
     * @dev Contract will be in paused state as expected. Minting initial shares will add to contract USDC token balance
     * and unpause contract state. IF a minimum amount of 1000 is transferred from LP mint to zero address as guard against "donation" dilution gaming of LP contract, it is intended to prevent LP token dominance by transferring a bunch of USDC token after initial LP minting. If not, LP should be minted 1:1 with USDC token deposit amount. There is a slim possibility this is called more than once, in which case the caller will inherit USDC token dust.
     * @param initialAmount Amount of USDC deposited when no shares exist.
     **/
    function mintInitialShares(uint256 initialAmount)
        external
        whenNotLPBalance
        gtMinimumDepositBalance(initialAmount)
    {
        address sender = msg.sender;

        stablecoinTokenContract.safeTransferFrom(
            sender,
            address(walletContract),
            initialAmount
        );

        uint256 adjustmentFactor;
        uint256 stablecoinDecimals = stablecoinTokenContract.decimals();

        if (stablecoinDecimals < decimals()) {
            adjustmentFactor = 10**(decimals() - stablecoinDecimals);
        } else {
            adjustmentFactor = 1;
        }

        _mint(sender, initialAmount * adjustmentFactor);

        walletContract.updateLiquidityPoolBalance(initialAmount);
    }

    /**
     * @notice Mints LP shares on USDC token deposit.
     * @dev Contract must be in unpaused state. note: an issue addressed by Uniswap V2 whitepaper is dilution attack (dumping large amounts of token to LP contract directly via token contract), which is mitigated by subtracting and transferring 1000 wei of share tokens on initial mint to zero address. Not likely necessary.
     * @param depositAmount Amount of USDC deposited to contract.
     **/
    function mintLpShares(uint256 depositAmount)
        external
        whenLPBalance
        gtMinimumDepositBalance(depositAmount)
    {
        address sender = msg.sender;

        stablecoinTokenContract.safeTransferFrom(
            sender,
            address(walletContract),
            depositAmount
        );

        // should be 1:1 with current implementation
        uint256 newShareAmount = (totalSupply() * depositAmount) /
            walletContract.balances(address(this));

        _mint(sender, newShareAmount);

        walletContract.updateLiquidityPoolBalance(depositAmount);
    }

    /**
     * @notice Burns LP shares in exchange for share of pool USDC tokens.
     * @dev  Will require share token approval from sender to contract to burn.
     * @param burnAmount Amount of LP share to burn for USDC withdrawal.
     **/
    function burnLpShares(uint256 burnAmount) external {
        address sender = msg.sender;
        // !!! must call supply before burn
        uint256 sharesTotalSupply = totalSupply();

        _burn(sender, burnAmount);

        uint256 tokenTransferAmount = (burnAmount *
            walletContract.balances(address(this))) / sharesTotalSupply;

        // transfer comes from {YoloWallet} contract
        walletContract.reduceLiquidityPoolBalance(sender, tokenTransferAmount);
    }

    /**
     * @notice Set a market limit based on a small fraction of total USDC token balance and no more than 2,000 USDC tokens.
     * @dev  Query `marketLimit` regularly to adjust.
     * @param newLimitValue
     **/
    function setMarketLimit(uint256 newLimitValue)
        external
        onlyAuthorized(ADMIN_ROLE)
    {
        require(
            newLimitValue < TWO_THOUSAND_TOKENS &&
                newLimitValue <
                walletContract.balances(address(this)) / protectionFactor,
            "new limit val exceeds constraint"
        );

        marketLimit = newLimitValue;

        emit MarketLimitUpdate(newLimitValue);
    }
}
