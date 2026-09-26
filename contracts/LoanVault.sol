// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @notice Isolated escrow for exactly one card and one loan. Only its manager can release it.
contract LoanVault is IERC721Receiver {
    enum State { Empty, Locked, Released, Auctioned }

    address public immutable manager;
    IERC721 public immutable card;
    uint256 public immutable tokenId;
    address public immutable borrower;
    State public state;

    event CollateralLocked(uint256 indexed tokenId);
    event CollateralReleased(address indexed recipient, uint256 indexed tokenId);

    modifier onlyManager() {
        require(msg.sender == manager, "Only manager");
        _;
    }

    constructor(address manager_, IERC721 card_, uint256 tokenId_, address borrower_) {
        require(manager_ != address(0) && address(card_) != address(0) && borrower_ != address(0), "Zero address");
        manager = manager_;
        card = card_;
        tokenId = tokenId_;
        borrower = borrower_;
    }

    function onERC721Received(address operator, address from, uint256 receivedTokenId, bytes calldata)
        external override returns (bytes4)
    {
        require(msg.sender == address(card) && operator == manager, "Unauthorized card transfer");
        require(from == borrower && receivedTokenId == tokenId && state == State.Empty, "Wrong collateral");
        state = State.Locked;
        emit CollateralLocked(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function releaseToBorrower() external onlyManager {
        require(state == State.Locked, "Card not locked");
        state = State.Released;
        card.safeTransferFrom(address(this), borrower, tokenId);
        emit CollateralReleased(borrower, tokenId);
    }

    function releaseToAuction(address auction) external onlyManager {
        require(state == State.Locked && auction != address(0), "Card not locked");
        state = State.Auctioned;
        card.safeTransferFrom(address(this), auction, tokenId);
        emit CollateralReleased(auction, tokenId);
    }
}
