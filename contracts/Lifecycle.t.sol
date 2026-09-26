// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {VaultedCardNFT} from "./VaultedCardNFT.sol";
import {HumanVerificationRegistry} from "./HumanVerificationRegistry.sol";
import {ValuationVerifier} from "./ValuationVerifier.sol";
import {LendingPool} from "./LendingPool.sol";
import {LoanVaultFactory} from "./LoanVaultFactory.sol";
import {LoanManager, ILiquidationAuction} from "./LoanManager.sol";
import {LiquidationAuction, IAuctionSettlement} from "./LiquidationAuction.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract LifecycleTest is IERC721Receiver {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant APPRAISER_KEY = 0xA11CE;
    uint256 private constant PRINCIPAL = 3_500 * 10 ** 6;
    address private constant TREASURY = address(0xBEEF);
    address private constant RECOVERY = address(0xC0FFEE);
    address private constant BIDDER = address(0xB1D);

    MockUSDC private token;
    VaultedCardNFT private card;
    HumanVerificationRegistry private registry;
    ValuationVerifier private verifier;
    LendingPool private pool;
    LoanVaultFactory private factory;
    LoanManager private manager;
    LiquidationAuction private auction;
    uint256 private tokenId;

    function setUp() public {
        token = new MockUSDC();
        card = new VaultedCardNFT(address(this), address(this));
        registry = new HumanVerificationRegistry(address(this), address(this));
        verifier = new ValuationVerifier(address(this), vm.addr(APPRAISER_KEY), address(card), address(token));
        pool = new LendingPool(token, address(this));
        factory = new LoanVaultFactory(address(this));
        manager = new LoanManager(address(this), TREASURY, pool, card, verifier, registry, factory, true);
        auction = new LiquidationAuction(IAuctionSettlement(address(manager)), token, card, RECOVERY);
        manager.setAuction(ILiquidationAuction(address(auction)));
        pool.setLoanManager(address(manager));
        factory.setLoanManager(address(manager));
        verifier.grantRole(verifier.LOAN_MANAGER_ROLE(), address(manager));
        card.grantRole(card.LOAN_MANAGER_ROLE(), address(manager));
        token.faucet();
        token.approve(address(pool), type(uint256).max);
        pool.deposit(5_000 * 10 ** 6, address(this));
        tokenId = card.mint(address(this), "Charizard", "Base Set", 1999, "PSA", "9", "LIFECYCLE-001", "ipfs://image", "ipfs://metadata", bytes32(uint256(1)));
        card.approve(address(manager), tokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _quote(uint256 value, bytes32 nonce) private view returns (ValuationVerifier.Valuation memory) {
        return ValuationVerifier.Valuation(address(card), tokenId, value, address(token), uint64(block.timestamp), uint64(block.timestamp + 10 minutes), nonce);
    }

    function _signature(ValuationVerifier.Valuation memory quote) private returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Collector Credit Valuation")), keccak256(bytes("1")), block.chainid, address(verifier)
        ));
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Valuation(address cardContract,uint256 tokenId,uint256 value,address currency,uint64 issuedAt,uint64 expiresAt,bytes32 nonce)"),
            quote.cardContract, quote.tokenId, quote.value, quote.currency, quote.issuedAt, quote.expiresAt, quote.nonce
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPRAISER_KEY, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _originate(uint16 termDays) private returns (uint256) {
        registry.registerBorrower(address(this), bytes32(uint256(42)));
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(1)));
        return manager.originate(PRINCIPAL, termDays, quote, _signature(quote));
    }

    function _originate() private returns (uint256) { return _originate(90); }

    function testOriginationEscrowsCardAndLimitsWithdrawals() public {
        uint256 loanId = _originate();
        require(loanId == 1, "wrong loan id");
        (, address vault,,,,,) = manager.loans(loanId);
        require(card.ownerOf(tokenId) == vault, "card not escrowed");
        require(token.balanceOf(address(this)) == 8_500 * 10 ** 6, "principal not disbursed");
        require(pool.deployedPrincipal() == PRINCIPAL, "principal not tracked");
        require(pool.totalAssets() == 5_000 * 10 ** 6, "loan should remain a pool asset");
        require(pool.maxWithdraw(address(this)) == 1_500 * 10 ** 6, "withdrawal exceeds cash");
        require(pool.utilizationBps() == 7_000, "wrong utilization");
    }

    function testUnverifiedBorrowerAndExcessLtvAreRejected() public {
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(2)));
        bytes memory signature = _signature(quote);
        try manager.originate(PRINCIPAL, 90, quote, signature) {
            revert("unverified borrower succeeded");
        } catch {}
        registry.registerBorrower(address(this), bytes32(uint256(43)));
        try manager.originate(PRINCIPAL + 1, 90, quote, signature) {
            revert("excess LTV succeeded");
        } catch {}
        require(!verifier.usedNonces(quote.nonce), "failed quote consumed");
    }

    function testRepaymentDistributesInterestAndReleasesCard() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 90 days);
        uint256 interest = PRINCIPAL * 2_000 * 90 days / (10_000 * 365 days);
        require(manager.interestDue(loanId) == interest, "wrong interest");
        token.approve(address(manager), type(uint256).max);
        manager.repay(loanId);
        require(card.ownerOf(tokenId) == address(this), "card not returned");
        require(pool.deployedPrincipal() == 0, "principal still deployed");
        require(pool.realizedInterest() == interest * 7_500 / 10_000, "wrong lender yield");
        require(token.balanceOf(TREASURY) == interest * 1_500 / 10_000, "wrong protocol fee");
        require(pool.reserveBalance() == interest - interest * 7_500 / 10_000 - interest * 1_500 / 10_000, "wrong reserve");
        require(manager.activeLoanForToken(tokenId) == 0, "card still active");
    }

    function testEarlyRepaymentUsesElapsedTime() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 30 days);
        uint256 interest = PRINCIPAL * 2_000 * 30 days / (10_000 * 365 days);
        require(manager.repaymentDue(loanId) == PRINCIPAL + interest, "wrong early repayment");
        token.approve(address(manager), type(uint256).max);
        manager.repay(loanId);
        require(pool.realizedInterest() == interest * 7_500 / 10_000, "wrong early lender yield");
    }

    function testThirtyDayTermSetsMaturityAndCapsInterest() public {
        uint256 loanId = _originate(30);
        (, , , , uint64 openedAt, uint64 maturity, ) = manager.loans(loanId);
        require(maturity - openedAt == 30 days, "wrong thirty-day maturity");
        vm.warp(block.timestamp + 45 days);
        uint256 interest = PRINCIPAL * manager.APR_BPS() * 30 days / (manager.BPS() * manager.YEAR());
        require(manager.interestDue(loanId) == interest, "interest passed thirty-day maturity");
        require(manager.repaymentDue(loanId) == PRINCIPAL + interest, "wrong thirty-day repayment");
    }

    function testSixtyDayTermControlsDefaultAndAuctionInterest() public {
        uint256 loanId = _originate(60);
        (, , , , uint64 openedAt, uint64 maturity, ) = manager.loans(loanId);
        require(maturity - openedAt == 60 days, "wrong sixty-day maturity");
        vm.warp(uint256(maturity) + manager.GRACE());
        try manager.markDefault(loanId) { revert("default during grace"); } catch {}
        vm.warp(block.timestamp + 1);
        manager.markDefault(loanId);
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        auction.bid(loanId, 7_500 * 10 ** 6);
        vm.warp(block.timestamp + 3 minutes);
        auction.settle(loanId);
        uint256 interest = PRINCIPAL * manager.APR_BPS() * 60 days / (manager.BPS() * manager.YEAR());
        require(pool.realizedInterest() == interest * manager.LP_INTEREST_BPS() / manager.BPS(), "auction used wrong term interest");
    }

    function testUnsupportedTermRejectedBeforeQuoteConsumption() public {
        registry.registerBorrower(address(this), bytes32(uint256(42)));
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(99)));
        bytes memory signature = _signature(quote);
        uint16[5] memory invalidTerms = [uint16(0), 29, 31, 61, 91];
        for (uint256 i = 0; i < invalidTerms.length; i++) {
            (bool succeeded,) = address(manager).call(abi.encodeCall(manager.originate, (PRINCIPAL, invalidTerms[i], quote, signature)));
            require(!succeeded, "unsupported term succeeded");
        }
        require(!verifier.usedNonces(quote.nonce), "invalid term consumed quote");
    }

    function testRepaymentApprovalCoversInterestWhileWalletIsOpen() public {
        uint256 loanId = _originate();
        uint256 openedAt = block.timestamp;
        vm.warp(openedAt + 1 days);
        uint256 dueAtApproval = manager.repaymentDue(loanId);
        token.approve(address(manager), dueAtApproval);
        vm.warp(openedAt + 2 days);
        uint256 dueAtRepayment = manager.repaymentDue(loanId);
        require(dueAtRepayment > dueAtApproval, "interest did not accrue");
        require(token.allowance(address(this), address(manager)) == dueAtApproval, "unexpected allowance");
        (bool staleApprovalSucceeded,) = address(manager).call(abi.encodeCall(manager.repay, (loanId)));
        require(!staleApprovalSucceeded, "stale repayment approval should fail");

        (, , , , uint64 loanOpenedAt, uint64 maturity, ) = manager.loans(loanId);
        uint256 fullTermDue = PRINCIPAL + PRINCIPAL * manager.APR_BPS() * (maturity - loanOpenedAt) / (manager.BPS() * manager.YEAR());
        token.approve(address(manager), fullTermDue);
        manager.repay(loanId);
        require(card.ownerOf(tokenId) == address(this), "card not returned after full-term approval");
    }

    function testDefaultAuctionAndSurplusWaterfall() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(loanId);
        require(card.ownerOf(tokenId) == address(auction), "card not in auction");
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        auction.bid(loanId, 8_000 * 10 ** 6);
        vm.warp(block.timestamp + 3 minutes);
        uint256 borrowerBefore = token.balanceOf(address(this));
        auction.settle(loanId);
        require(card.ownerOf(tokenId) == BIDDER, "winner did not receive card");
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Released, "winner card not released");
        require(pool.deployedPrincipal() == 0, "principal still deployed");
        require(pool.realizedLoss() == 0, "unexpected loss");
        require(pool.realizedInterest() > 0, "lender interest missing");
        require(token.balanceOf(TREASURY) > 0, "protocol fee missing");
        require(token.balanceOf(address(this)) > borrowerBefore, "surplus not returned");
        require(manager.activeLoanForToken(tokenId) == 0, "card still active");
    }

    function testOpeningBidIsSeventyFivePercentOfSignedFairValue() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(loanId);
        uint256 openingBid = 7_500 * 10 ** 6;
        require(manager.fairValueForLoan(loanId) == 10_000 * 10 ** 6, "fair value not retained");
        require(auction.openingBidForLoan(loanId) == openingBid, "opening bid not retained");
        require(auction.minimumBid(loanId) == openingBid, "wrong opening bid");

        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        (bool lowBidSucceeded,) = address(auction).call(abi.encodeCall(auction.bid, (loanId, openingBid - 1)));
        require(!lowBidSucceeded, "bid below opening price succeeded");
        vm.prank(BIDDER);
        auction.bid(loanId, openingBid);
        require(auction.minimumBid(loanId) == openingBid * 105 / 100, "wrong next bid");
    }

    function testOpeningBidDoesNotDependOnBorrowedPrincipal() public {
        registry.registerBorrower(address(this), bytes32(uint256(42)));
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(2)));
        uint256 loanId = manager.originate(1_000 * 10 ** 6, 30, quote, _signature(quote));
        manager.accelerateDemoMaturity(loanId);
        manager.markDefault(loanId);
        require(auction.minimumBid(loanId) == 7_500 * 10 ** 6, "opening bid followed principal");
    }

    function testAuctionWinnerCanBorrowAgainstSameCard() public {
        uint256 firstLoanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(firstLoanId);
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        auction.bid(firstLoanId, 8_000 * 10 ** 6);
        vm.warp(block.timestamp + 3 minutes);
        auction.settle(firstLoanId);

        require(card.ownerOf(tokenId) == BIDDER, "winner did not receive card");
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Released, "card not available for new owner");
        vm.prank(BIDDER);
        card.approve(address(manager), tokenId);
        ValuationVerifier.Valuation memory freshQuote = _quote(10_000 * 10 ** 6, bytes32(uint256(2)));
        bytes memory signature = _signature(freshQuote);
        vm.prank(BIDDER);
        try manager.originate(PRINCIPAL, 90, freshQuote, signature) {
            revert("unverified auction winner borrowed");
        } catch {}
        require(!verifier.usedNonces(freshQuote.nonce), "failed quote consumed");
        registry.registerBorrower(BIDDER, bytes32(uint256(43)));
        vm.prank(BIDDER);
        uint256 secondLoanId = manager.originate(PRINCIPAL, 90, freshQuote, signature);

        require(secondLoanId != firstLoanId, "old loan reused");
        require(manager.activeLoanForToken(tokenId) == secondLoanId, "new loan not recorded");
        (, address newVault,,,,,) = manager.loans(secondLoanId);
        require(card.ownerOf(tokenId) == newVault, "new loan did not escrow card");
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Pledged, "card not pledged again");
    }

    function testPreviousAuctionWinnerCanBorrowWithLegacyLiquidatedReceipt() public {
        card.grantRole(card.LOAN_MANAGER_ROLE(), address(this));
        card.setCustodyStatus(tokenId, VaultedCardNFT.CustodyStatus.Pledged);
        card.setCustodyStatus(tokenId, VaultedCardNFT.CustodyStatus.Liquidated);
        card.safeTransferFrom(address(this), BIDDER, tokenId);
        registry.registerBorrower(BIDDER, bytes32(uint256(43)));
        vm.prank(BIDDER);
        card.approve(address(manager), tokenId);
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(2)));
        bytes memory signature = _signature(quote);
        vm.prank(BIDDER);
        uint256 newLoanId = manager.originate(PRINCIPAL, 90, quote, signature);
        require(manager.legacyLiquidatedCollateral(newLoanId), "legacy receipt not tracked");
        require(manager.activeLoanForToken(tokenId) == newLoanId, "new loan not recorded");
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Liquidated, "legacy status changed");
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(manager), type(uint256).max);
        vm.warp(block.timestamp + 1 days);
        vm.prank(BIDDER);
        manager.repay(newLoanId);
        require(card.ownerOf(tokenId) == BIDDER, "card not returned to new owner");
        require(manager.activeLoanForToken(tokenId) == 0, "legacy loan still active");
    }

    function testNoBidAuctionRecordsLossAndRecovery() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(loanId);
        vm.warp(block.timestamp + 3 minutes);
        auction.settle(loanId);
        require(card.ownerOf(tokenId) == RECOVERY, "recovery wallet missing card");
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Released, "recovery card not released");
        require(auction.unresolvedPrincipal(loanId) == PRINCIPAL, "unresolved value missing");
        require(pool.realizedLoss() == PRINCIPAL, "pool loss missing");
        require(pool.totalAssets() == 1_500 * 10 ** 6, "share price did not absorb loss");
    }

    function testDefaultCannotStartDuringGrace() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 97 days);
        try manager.markDefault(loanId) {
            revert("default succeeded during grace");
        } catch {}
        vm.warp(block.timestamp + 1);
        manager.markDefault(loanId);
        require(card.ownerOf(tokenId) == address(auction), "default did not move card");
    }

    function testDemoMaturityAccelerationIsAuthorizedAndChargesFullTerm() public {
        uint256 loanId = _originate();
        vm.prank(BIDDER);
        try manager.accelerateDemoMaturity(loanId) {
            revert("unrelated wallet accelerated maturity");
        } catch {}
        try manager.markDefault(loanId) {
            revert("unaccelerated loan defaulted");
        } catch {}
        manager.accelerateDemoMaturity(loanId);
        uint256 fullTermInterest = PRINCIPAL * 2_000 * 90 days / (10_000 * 365 days);
        require(manager.interestDue(loanId) == fullTermInterest, "demo interest not full term");
        try manager.accelerateDemoMaturity(loanId) {
            revert("demo acceleration repeated");
        } catch {}
        manager.markDefault(loanId);
        require(card.ownerOf(tokenId) == address(auction), "accelerated default did not start auction");
    }

    function testDemoMaturityControlCanBeDisabled() public {
        LoanManager production = new LoanManager(address(this), TREASURY, pool, card, verifier, registry, factory, false);
        try production.accelerateDemoMaturity(1) {
            revert("disabled demo acceleration succeeded");
        } catch {}
    }

    function testPausedOriginationsDoNotBlockRepayment() public {
        uint256 loanId = _originate();
        manager.pauseOriginations();
        vm.warp(block.timestamp + 30 days);
        token.approve(address(manager), type(uint256).max);
        manager.repay(loanId);
        require(card.ownerOf(tokenId) == address(this), "pause blocked repayment");
        card.approve(address(manager), tokenId);
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(3)));
        try manager.originate(PRINCIPAL, 90, quote, _signature(quote)) {
            revert("origination succeeded while paused");
        } catch {}
    }

    function testConsumedValuationCannotBeReplayed() public {
        registry.registerBorrower(address(this), bytes32(uint256(42)));
        ValuationVerifier.Valuation memory quote = _quote(10_000 * 10 ** 6, bytes32(uint256(4)));
        bytes memory signature = _signature(quote);
        uint256 loanId = manager.originate(PRINCIPAL, 90, quote, signature);
        token.approve(address(manager), type(uint256).max);
        manager.repay(loanId);
        card.approve(address(manager), tokenId);
        require(verifier.usedNonces(quote.nonce), "nonce not consumed");
        try manager.originate(PRINCIPAL, 90, quote, signature) {
            revert("valuation replay succeeded");
        } catch {}
    }

    function testOpeningPriceBidRecoversPrincipal() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(loanId);
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        auction.bid(loanId, 7_500 * 10 ** 6);
        vm.warp(block.timestamp + 3 minutes);
        auction.settle(loanId);
        require(pool.realizedLoss() == 0, "unexpected principal loss");
        require(pool.totalAssets() >= 5_000 * 10 ** 6, "pool assets fell despite full recovery");
        require(pool.realizedInterest() > 0, "lender interest missing");
    }

    function testPreviousBidIsRefunded() public {
        uint256 loanId = _originate();
        vm.warp(block.timestamp + 98 days);
        manager.markDefault(loanId);
        token.approve(address(auction), type(uint256).max);
        auction.bid(loanId, 7_500 * 10 ** 6);
        uint256 balanceAfterFirstBid = token.balanceOf(address(this));
        vm.prank(BIDDER);
        token.faucet();
        vm.prank(BIDDER);
        token.approve(address(auction), type(uint256).max);
        vm.prank(BIDDER);
        auction.bid(loanId, 8_000 * 10 ** 6);
        require(token.balanceOf(address(this)) == balanceAfterFirstBid + 7_500 * 10 ** 6, "previous bid not refunded");
    }
}
