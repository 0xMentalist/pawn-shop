// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Checks card-specific, short-lived EIP-712 valuations before origination.
contract ValuationVerifier is AccessControl, EIP712 {
    bytes32 public constant APPRAISER_ROLE = keccak256("APPRAISER_ROLE");
    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");
    bytes32 private constant VALUATION_TYPEHASH = keccak256(
        "Valuation(address cardContract,uint256 tokenId,uint256 value,address currency,uint64 issuedAt,uint64 expiresAt,bytes32 nonce)"
    );
    uint256 public constant MAX_VALUATION_AGE = 1 days;

    address public immutable supportedCard;
    address public immutable supportedCurrency;
    mapping(bytes32 => bool) public usedNonces;

    struct Valuation {
        address cardContract;
        uint256 tokenId;
        uint256 value;
        address currency;
        uint64 issuedAt;
        uint64 expiresAt;
        bytes32 nonce;
    }

    event ValuationAccepted(uint256 indexed tokenId, uint256 value, bytes32 indexed nonce, address indexed appraiser);

    constructor(address admin, address appraiser, address card, address currency)
        EIP712("Collector Credit Valuation", "1")
    {
        require(admin != address(0) && appraiser != address(0) && card != address(0) && currency != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPRAISER_ROLE, appraiser);
        supportedCard = card;
        supportedCurrency = currency;
    }

    function verify(Valuation calldata valuation, bytes calldata signature) public view returns (address signer) {
        require(valuation.cardContract == supportedCard && valuation.currency == supportedCurrency, "Unsupported asset");
        require(valuation.value > 0 && valuation.nonce != bytes32(0), "Invalid valuation");
        require(valuation.issuedAt <= block.timestamp, "Future valuation");
        require(valuation.expiresAt >= block.timestamp, "Expired valuation");
        require(valuation.expiresAt > valuation.issuedAt, "Invalid expiry");
        require(block.timestamp - valuation.issuedAt <= MAX_VALUATION_AGE, "Stale valuation");
        require(!usedNonces[valuation.nonce], "Nonce already used");
        bytes32 structHash = keccak256(abi.encode(
            VALUATION_TYPEHASH,
            valuation.cardContract,
            valuation.tokenId,
            valuation.value,
            valuation.currency,
            valuation.issuedAt,
            valuation.expiresAt,
            valuation.nonce
        ));
        signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(hasRole(APPRAISER_ROLE, signer), "Unauthorized appraiser");
    }

    function consume(Valuation calldata valuation, bytes calldata signature) external onlyRole(LOAN_MANAGER_ROLE) {
        address signer = verify(valuation, signature);
        usedNonces[valuation.nonce] = true;
        emit ValuationAccepted(valuation.tokenId, valuation.value, valuation.nonce, signer);
    }
}
