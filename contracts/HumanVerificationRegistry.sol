// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Stores only wallet eligibility and action-scoped nullifier replay protection.
contract HumanVerificationRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant BORROWER_ACTION = keccak256("collector-credit-borrower");

    mapping(address => bool) public isVerifiedBorrower;
    mapping(bytes32 => address) public walletForNullifier;

    event BorrowerVerified(address indexed wallet, bytes32 indexed nullifierHash);

    constructor(address admin, address verifier) {
        require(admin != address(0) && verifier != address(0), "Zero role address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, verifier);
    }

    function registerBorrower(address wallet, bytes32 nullifierHash) external onlyRole(VERIFIER_ROLE) {
        require(wallet != address(0) && nullifierHash != bytes32(0), "Invalid authorization");
        require(!isVerifiedBorrower[wallet], "Wallet already verified");
        require(walletForNullifier[nullifierHash] == address(0), "Nullifier already used");
        isVerifiedBorrower[wallet] = true;
        walletForNullifier[nullifierHash] = wallet;
        emit BorrowerVerified(wallet, nullifierHash);
    }
}
