// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice ERC-4626 pool backed by available MockUSDC and deployed loan principal.
contract LendingPool is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public loanManager;
    uint256 public deployedPrincipal;
    uint256 public reserveBalance;
    uint256 public realizedInterest;
    uint256 public realizedLoss;

    event LiquidityDeposited(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event LiquidityWithdrawn(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event PrincipalDrawn(address indexed borrower, uint256 amount);
    event PoolSettled(uint256 principalClosed, uint256 principalRecovered, uint256 lenderInterest, uint256 reserveContribution);
    event PoolLossRecorded(uint256 amount);
    event LoanManagerSet(address indexed manager);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only loan manager");
        _;
    }

    constructor(IERC20 currency, address admin)
        ERC20("Collector Credit Pool Share", "ccUSDC") ERC4626(currency)
    {
        require(admin != address(0) && address(currency) != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setLoanManager(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(loanManager == address(0) && manager != address(0), "Manager already set");
        loanManager = manager;
        emit LoanManagerSet(manager);
    }

    function availableLiquidity() public view returns (uint256) {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        return balance > reserveBalance ? balance - reserveBalance : 0;
    }

    function totalAssets() public view override returns (uint256) {
        return availableLiquidity() + deployedPrincipal;
    }

    function utilizationBps() external view returns (uint256) {
        uint256 assets = totalAssets();
        return assets == 0 ? 0 : deployedPrincipal * 10_000 / assets;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 ownerAssets = super.maxWithdraw(owner);
        uint256 available = availableLiquidity();
        return ownerAssets < available ? ownerAssets : available;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 ownerShares = super.maxRedeem(owner);
        uint256 availableShares = convertToShares(availableLiquidity());
        return ownerShares < availableShares ? ownerShares : availableShares;
    }

    function draw(uint256 principal, address borrower) external onlyLoanManager nonReentrant {
        require(principal != 0 && principal <= availableLiquidity(), "Insufficient liquidity");
        require(borrower != address(0), "Zero borrower");
        deployedPrincipal += principal;
        IERC20(asset()).safeTransfer(borrower, principal);
        emit PrincipalDrawn(borrower, principal);
    }

    /// @dev Manager must approve recoveredPrincipal + lenderInterest + reserveContribution.
    function settle(uint256 principalClosed, uint256 recoveredPrincipal, uint256 lenderInterest, uint256 reserveContribution)
        external onlyLoanManager nonReentrant
    {
        require(principalClosed != 0 && principalClosed <= deployedPrincipal, "Invalid principal");
        require(recoveredPrincipal <= principalClosed, "Principal over-recovered");
        uint256 incoming = recoveredPrincipal + lenderInterest + reserveContribution;
        deployedPrincipal -= principalClosed;
        realizedInterest += lenderInterest;
        reserveBalance += reserveContribution;
        uint256 loss = principalClosed - recoveredPrincipal;
        if (loss != 0) {
            realizedLoss += loss;
            emit PoolLossRecorded(loss);
        }
        if (incoming != 0) IERC20(asset()).safeTransferFrom(msg.sender, address(this), incoming);
        emit PoolSettled(principalClosed, recoveredPrincipal, lenderInterest, reserveContribution);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        super._deposit(caller, receiver, assets, shares);
        emit LiquidityDeposited(caller, receiver, assets, shares);
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal override nonReentrant
    {
        require(assets <= availableLiquidity(), "Liquidity deployed");
        super._withdraw(caller, receiver, owner, assets, shares);
        emit LiquidityWithdrawn(caller, owner, assets, shares);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
