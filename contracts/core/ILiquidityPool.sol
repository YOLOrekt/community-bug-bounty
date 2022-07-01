pragma solidity 0.8.13;

interface ILiquidityPool {
    // **** restricted ****
    function setProtectionFactor(uint256 newFactor) external;

    function setMarketLimit(uint256 newLimitValue) external;

    // ********

    function mintInitialShares(uint256 initialAmount) external;

    function mintLpShares(uint256 depositAmount) external;

    function burnLpShares(uint256 burnAmount) external;
}
