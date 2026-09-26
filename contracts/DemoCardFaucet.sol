// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {VaultedCardNFT} from "./VaultedCardNFT.sol";

/// @notice Forty one-off simulated cards. The wallet pays Sepolia gas; a curator signs exact card data.
contract DemoCardFaucet {
    using MessageHashUtils for bytes32;

    struct CardInput {
        uint8 number;
        string cardName;
        string setName;
        uint16 year;
        string grader;
        string grade;
        string certificationNumber;
        string imageUri;
        string metadataUri;
        bytes32 custodyAttestationHash;
        uint64 expiresAt;
    }

    VaultedCardNFT public immutable card;
    address public immutable curator;
    mapping(uint8 => bool) public claimedTemplate;
    mapping(address => uint8) public claimedCount;

    event CardClaimed(uint8 indexed number, address indexed owner, uint256 indexed tokenId);

    constructor(VaultedCardNFT card_, address curator_) {
        require(address(card_) != address(0) && curator_ != address(0), "Zero address");
        card = card_;
        curator = curator_;
    }

    function hashClaim(address claimer, CardInput calldata item) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), claimer, item));
    }

    function claim(CardInput calldata item, bytes calldata signature) external returns (uint256 tokenId) {
        require(item.number >= 1 && item.number <= 40, "Unknown card");
        require(!claimedTemplate[item.number], "Card already claimed");
        require(claimedCount[msg.sender] < 3, "Wallet claim limit");
        require(block.timestamp <= item.expiresAt, "Claim expired");
        require(ECDSA.recover(hashClaim(msg.sender, item).toEthSignedMessageHash(), signature) == curator, "Invalid card voucher");

        claimedTemplate[item.number] = true;
        claimedCount[msg.sender] += 1;
        tokenId = card.mint(
            msg.sender, item.cardName, item.setName, item.year, item.grader, item.grade,
            item.certificationNumber, item.imageUri, item.metadataUri, item.custodyAttestationHash
        );
        emit CardClaimed(item.number, msg.sender, tokenId);
    }
}
