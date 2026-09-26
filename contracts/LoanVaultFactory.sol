// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {LoanVault} from "./LoanVault.sol";

/// @notice CREATE2 factory giving every loan a predictable, isolated escrow address.
contract LoanVaultFactory is AccessControl {
    address public loanManager;
    mapping(bytes32 => address) public vaultForSalt;

    event LoanManagerSet(address indexed manager);
    event LoanVaultCreated(bytes32 indexed salt, address indexed vault, address indexed borrower, uint256 tokenId);

    constructor(address admin) {
        require(admin != address(0), "Zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setLoanManager(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(loanManager == address(0) && manager != address(0), "Manager already set");
        loanManager = manager;
        emit LoanManagerSet(manager);
    }

    function deployLoanVault(bytes32 salt, address borrower, IERC721 card, uint256 tokenId) external returns (address vault) {
        require(msg.sender == loanManager, "Only loan manager");
        require(vaultForSalt[salt] == address(0), "Vault already exists");
        vault = address(new LoanVault{salt: salt}(loanManager, card, tokenId, borrower));
        vaultForSalt[salt] = vault;
        emit LoanVaultCreated(salt, vault, borrower, tokenId);
    }

    function predictLoanVault(bytes32 salt, address borrower, IERC721 card, uint256 tokenId) external view returns (address) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(LoanVault).creationCode, abi.encode(loanManager, card, tokenId, borrower)));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
