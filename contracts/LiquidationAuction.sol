// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IAuctionSettlement {
    function settleAuction(uint256 loanId, uint256 proceeds) external;
}

/// @notice Three-minute English auction for a defaulted demo card.
contract LiquidationAuction is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant DURATION = 3 minutes;
    uint256 public constant MIN_INCREMENT_BPS = 500;
    uint256 public constant OPENING_BID_BPS = 7_500;
    uint256 private constant BPS = 10_000;

    struct Auction {
        uint256 tokenId;
        uint256 principal;
        address borrower;
        uint64 endsAt;
        address highestBidder;
        uint256 highestBid;
        bool settled;
    }

    IAuctionSettlement public immutable manager;
    IERC20 public immutable currency;
    IERC721 public immutable card;
    address public immutable recoveryAddress;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => uint256) public openingBidForLoan;
    mapping(uint256 => uint256) public unresolvedPrincipal;

    event AuctionStarted(uint256 indexed loanId, uint256 indexed tokenId, uint64 endsAt, uint256 openingBid);
    event AuctionBid(uint256 indexed loanId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed loanId, address indexed winner, uint256 proceeds, uint256 unresolvedPrincipal);

    constructor(IAuctionSettlement manager_, IERC20 currency_, IERC721 card_, address recoveryAddress_) {
        require(address(manager_) != address(0) && address(currency_) != address(0) && address(card_) != address(0) && recoveryAddress_ != address(0), "Zero address");
        manager = manager_;
        currency = currency_;
        card = card_;
        recoveryAddress = recoveryAddress_;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view override returns (bytes4) {
        require(msg.sender == address(card), "Unsupported collateral");
        return IERC721Receiver.onERC721Received.selector;
    }

    function startAuction(uint256 loanId, uint256 tokenId, uint256 principal, uint256 fairValue, address borrower) external {
        require(msg.sender == address(manager), "Only loan manager");
        require(auctions[loanId].endsAt == 0, "Auction exists");
        require(card.ownerOf(tokenId) == address(this), "Collateral missing");
        require(principal != 0 && fairValue >= principal && borrower != address(0), "Invalid loan");
        uint64 endsAt = uint64(block.timestamp + DURATION);
        uint256 openingBid = _openingBid(fairValue);
        auctions[loanId] = Auction(tokenId, principal, borrower, endsAt, address(0), 0, false);
        openingBidForLoan[loanId] = openingBid;
        emit AuctionStarted(loanId, tokenId, endsAt, openingBid);
    }

    function minimumBid(uint256 loanId) public view returns (uint256) {
        Auction memory auction = auctions[loanId];
        require(auction.endsAt != 0, "Unknown auction");
        if (auction.highestBid == 0) return openingBidForLoan[loanId];
        uint256 increment = auction.highestBid * MIN_INCREMENT_BPS / 10_000;
        return auction.highestBid + (increment == 0 ? 1 : increment);
    }

    function bid(uint256 loanId, uint256 amount) external nonReentrant {
        Auction storage auction = auctions[loanId];
        require(auction.endsAt != 0 && block.timestamp < auction.endsAt && !auction.settled, "Auction closed");
        require(amount >= minimumBid(loanId), "Bid too low");
        address previousBidder = auction.highestBidder;
        uint256 previousBid = auction.highestBid;
        auction.highestBidder = msg.sender;
        auction.highestBid = amount;
        uint256 balanceBefore = currency.balanceOf(address(this));
        currency.safeTransferFrom(msg.sender, address(this), amount);
        require(currency.balanceOf(address(this)) - balanceBefore == amount, "Unsupported currency behavior");
        if (previousBid != 0) currency.safeTransfer(previousBidder, previousBid);
        emit AuctionBid(loanId, msg.sender, amount);
    }

    function settle(uint256 loanId) external nonReentrant {
        Auction storage auction = auctions[loanId];
        require(auction.endsAt != 0 && block.timestamp >= auction.endsAt && !auction.settled, "Auction not ready");
        auction.settled = true;
        uint256 proceeds = auction.highestBid;
        address recipient = proceeds == 0 ? recoveryAddress : auction.highestBidder;
        if (proceeds == 0) unresolvedPrincipal[loanId] = auction.principal;
        card.safeTransferFrom(address(this), recipient, auction.tokenId);
        if (proceeds != 0) currency.safeTransfer(address(manager), proceeds);
        manager.settleAuction(loanId, proceeds);
        emit AuctionSettled(loanId, recipient, proceeds, unresolvedPrincipal[loanId]);
    }

    function _openingBid(uint256 fairValue) private pure returns (uint256) {
        return Math.mulDiv(fairValue, OPENING_BID_BPS, BPS, Math.Rounding.Ceil);
    }
}
