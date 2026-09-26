// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LendingPool} from "./LendingPool.sol";
import {VaultedCardNFT} from "./VaultedCardNFT.sol";
import {ValuationVerifier} from "./ValuationVerifier.sol";
import {HumanVerificationRegistry} from "./HumanVerificationRegistry.sol";
import {LoanVaultFactory} from "./LoanVaultFactory.sol";
import {LoanVault} from "./LoanVault.sol";

interface ILiquidationAuction {
    function startAuction(uint256 loanId, uint256 tokenId, uint256 principal, uint256 fairValue, address borrower) external;
}

/// @notice Fixed-term loans against cards in one-card escrow vaults.
contract LoanManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_LTV_BPS = 3_500;
    uint256 public constant APR_BPS = 2_000;
    uint256 public constant LP_INTEREST_BPS = 7_500;
    uint256 public constant PROTOCOL_INTEREST_BPS = 1_500;
    uint16 public constant MIN_TERM_DAYS = 30;
    uint16 public constant MAX_TERM_DAYS = 90;
    uint256 public constant GRACE = 7 days;
    uint256 public constant MAX_PRINCIPAL = 3_500 * 10 ** 6;
    uint256 public constant YEAR = 365 days;

    enum Status { None, Active, Repaid, InAuction, Settled }

    struct Loan {
        address borrower;
        address vault;
        uint256 tokenId;
        uint256 principal;
        uint64 openedAt;
        uint64 maturity;
        Status status;
    }

    LendingPool public immutable pool;
    IERC20 public immutable currency;
    VaultedCardNFT public immutable card;
    ValuationVerifier public immutable valuationVerifier;
    HumanVerificationRegistry public immutable humanRegistry;
    LoanVaultFactory public immutable vaultFactory;
    address public immutable treasury;
    bool public immutable demoMode;
    mapping(uint256 => bool) public demoAccelerated;
    ILiquidationAuction public auction;
    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => uint256) public fairValueForLoan;
    mapping(uint256 => uint256) public activeLoanForToken;
    mapping(uint256 => bool) public legacyLiquidatedCollateral;

    event AuctionSet(address indexed auction);
    event LoanOriginated(uint256 indexed loanId, address indexed borrower, uint256 indexed tokenId, address vault, uint256 principal, uint64 maturity);
    event LoanRepaid(uint256 indexed loanId, address indexed payer, uint256 principal, uint256 interest);
    event LoanDefaulted(uint256 indexed loanId, uint256 indexed tokenId);
    event DemoMaturityAccelerated(uint256 indexed loanId, address indexed operator);
    event LoanSettled(uint256 indexed loanId, uint256 proceeds, uint256 principalRecovered, uint256 lenderInterest, uint256 protocolFee, uint256 reserveContribution, uint256 borrowerSurplus);

    constructor(
        address admin,
        address treasury_,
        LendingPool pool_,
        VaultedCardNFT card_,
        ValuationVerifier valuationVerifier_,
        HumanVerificationRegistry humanRegistry_,
        LoanVaultFactory vaultFactory_,
        bool demoMode_
    ) {
        require(admin != address(0) && treasury_ != address(0), "Zero role address");
        require(address(pool_) != address(0) && address(card_) != address(0), "Zero asset address");
        require(address(valuationVerifier_) != address(0) && address(humanRegistry_) != address(0) && address(vaultFactory_) != address(0), "Zero dependency");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        treasury = treasury_;
        demoMode = demoMode_;
        pool = pool_;
        currency = IERC20(pool_.asset());
        card = card_;
        valuationVerifier = valuationVerifier_;
        humanRegistry = humanRegistry_;
        vaultFactory = vaultFactory_;
    }

    function setAuction(ILiquidationAuction auction_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(auction) == address(0) && address(auction_) != address(0), "Auction already set");
        auction = auction_;
        emit AuctionSet(address(auction_));
    }

    function pauseOriginations() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function resumeOriginations() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function originate(uint256 principal, uint16 termDays, ValuationVerifier.Valuation calldata valuation, bytes calldata signature)
        external whenNotPaused nonReentrant returns (uint256 loanId)
    {
        require(humanRegistry.isVerifiedBorrower(msg.sender), "World verification required");
        require(termDays == 30 || termDays == 60 || termDays == 90, "Invalid loan term");
        require(principal != 0 && principal <= MAX_PRINCIPAL, "Invalid principal");
        require(principal <= valuation.value * MAX_LTV_BPS / BPS, "LTV exceeded");
        require(valuation.tokenId != 0 && activeLoanForToken[valuation.tokenId] == 0, "Card already pledged");
        require(card.ownerOf(valuation.tokenId) == msg.sender, "Not card owner");
        VaultedCardNFT.CustodyStatus custody = card.cardDetails(valuation.tokenId).custodyStatus;
        require(
            custody == VaultedCardNFT.CustodyStatus.Vaulted ||
            custody == VaultedCardNFT.CustodyStatus.Released ||
            custody == VaultedCardNFT.CustodyStatus.Liquidated,
            "Card not vaulted"
        );
        require(pool.availableLiquidity() >= principal, "Insufficient liquidity");

        valuationVerifier.consume(valuation, signature);
        loanId = nextLoanId++;
        bytes32 salt = keccak256(abi.encode(address(card), valuation.tokenId, msg.sender, loanId));
        address vault = vaultFactory.deployLoanVault(salt, msg.sender, card, valuation.tokenId);
        uint64 maturity = uint64(block.timestamp + uint256(termDays) * 1 days);
        loans[loanId] = Loan(msg.sender, vault, valuation.tokenId, principal, uint64(block.timestamp), maturity, Status.Active);
        fairValueForLoan[loanId] = valuation.value;
        activeLoanForToken[valuation.tokenId] = loanId;
        // Older receipts remain Liquidated after auction; ownership and escrow still enforce exclusivity.
        bool legacyLiquidated = custody == VaultedCardNFT.CustodyStatus.Liquidated;
        legacyLiquidatedCollateral[loanId] = legacyLiquidated;

        card.safeTransferFrom(msg.sender, vault, valuation.tokenId);
        if (!legacyLiquidated) card.setCustodyStatus(valuation.tokenId, VaultedCardNFT.CustodyStatus.Pledged);
        pool.draw(principal, msg.sender);
        emit LoanOriginated(loanId, msg.sender, valuation.tokenId, vault, principal, maturity);
    }

    function interestDue(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        require(loan.status != Status.None, "Unknown loan");
        uint256 end = demoAccelerated[loanId] ? loan.maturity : (block.timestamp < loan.maturity ? block.timestamp : loan.maturity);
        return loan.principal * APR_BPS * (end - loan.openedAt) / (BPS * YEAR);
    }

    function repaymentDue(uint256 loanId) external view returns (uint256) {
        return loans[loanId].principal + interestDue(loanId);
    }

    function repay(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active, "Loan not active");
        uint256 interest = interestDue(loanId);
        uint256 principal = loan.principal;
        uint256 lenderInterest = interest * LP_INTEREST_BPS / BPS;
        uint256 protocolFee = interest * PROTOCOL_INTEREST_BPS / BPS;
        uint256 reserveContribution = interest - lenderInterest - protocolFee;
        loan.status = Status.Repaid;
        activeLoanForToken[loan.tokenId] = 0;

        uint256 balanceBefore = currency.balanceOf(address(this));
        currency.safeTransferFrom(msg.sender, address(this), principal + interest);
        require(currency.balanceOf(address(this)) - balanceBefore == principal + interest, "Unsupported currency behavior");
        currency.forceApprove(address(pool), principal + lenderInterest + reserveContribution);
        pool.settle(principal, principal, lenderInterest, reserveContribution);
        if (protocolFee != 0) currency.safeTransfer(treasury, protocolFee);
        if (!legacyLiquidatedCollateral[loanId]) card.setCustodyStatus(loan.tokenId, VaultedCardNFT.CustodyStatus.Released);
        LoanVault(loan.vault).releaseToBorrower();
        emit LoanRepaid(loanId, msg.sender, principal, interest);
    }

    /// @notice Testnet demo control: makes a loan default-eligible and charges full-term interest.
    /// @dev Deploy with demoMode=false outside the valueless demo environment.
    function accelerateDemoMaturity(uint256 loanId) external {
        require(demoMode, "Demo mode disabled");
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active, "Loan not active");
        require(msg.sender == loan.borrower || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not demo operator or borrower");
        require(!demoAccelerated[loanId], "Already accelerated");
        demoAccelerated[loanId] = true;
        emit DemoMaturityAccelerated(loanId, msg.sender);
    }

    function markDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active, "Loan not active");
        require(demoAccelerated[loanId] || block.timestamp > uint256(loan.maturity) + GRACE, "Grace period active");
        require(address(auction) != address(0), "Auction not set");
        loan.status = Status.InAuction;
        LoanVault(loan.vault).releaseToAuction(address(auction));
        auction.startAuction(loanId, loan.tokenId, loan.principal, fairValueForLoan[loanId], loan.borrower);
        emit LoanDefaulted(loanId, loan.tokenId);
    }

    /// @notice Called by the auction after it transfers its proceeds here.
    function settleAuction(uint256 loanId, uint256 proceeds) external nonReentrant {
        require(msg.sender == address(auction), "Only auction");
        Loan storage loan = loans[loanId];
        require(loan.status == Status.InAuction, "Loan not in auction");
        require(currency.balanceOf(address(this)) >= proceeds, "Missing proceeds");
        loan.status = Status.Settled;
        activeLoanForToken[loan.tokenId] = 0;

        uint256 principalRecovered = proceeds < loan.principal ? proceeds : loan.principal;
        uint256 remaining = proceeds - principalRecovered;
        uint256 grossInterest = loan.principal * APR_BPS * (loan.maturity - loan.openedAt) / (BPS * YEAR);
        uint256 lenderInterest = _min(remaining, grossInterest * LP_INTEREST_BPS / BPS);
        remaining -= lenderInterest;
        uint256 protocolFee = _min(remaining, grossInterest * PROTOCOL_INTEREST_BPS / BPS);
        remaining -= protocolFee;
        uint256 reserveContribution = _min(remaining, grossInterest - grossInterest * LP_INTEREST_BPS / BPS - grossInterest * PROTOCOL_INTEREST_BPS / BPS);
        remaining -= reserveContribution;

        uint256 poolAmount = principalRecovered + lenderInterest + reserveContribution;
        if (poolAmount != 0) currency.forceApprove(address(pool), poolAmount);
        pool.settle(loan.principal, principalRecovered, lenderInterest, reserveContribution);
        if (protocolFee != 0) currency.safeTransfer(treasury, protocolFee);
        if (remaining != 0) currency.safeTransfer(loan.borrower, remaining);
        // The custody receipt follows the NFT to the auction recipient.
        if (!legacyLiquidatedCollateral[loanId]) card.setCustodyStatus(loan.tokenId, VaultedCardNFT.CustodyStatus.Released);
        emit LoanSettled(loanId, proceeds, principalRecovered, lenderInterest, protocolFee, reserveContribution, remaining);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }
}
