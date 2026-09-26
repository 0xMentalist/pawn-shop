// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Ownership token for a card received by the simulated demo custodian.
contract VaultedCardNFT is ERC721, AccessControl {
    bytes32 public constant CUSTODIAN_ROLE = keccak256("CUSTODIAN_ROLE");
    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");

    enum CustodyStatus { Unknown, Vaulted, Pledged, Released, Liquidated }

    struct CardDetails {
        string cardName;
        string setName;
        uint16 year;
        string grader;
        string grade;
        string certificationNumber;
        string imageUri;
        bytes32 custodyAttestationHash;
        CustodyStatus custodyStatus;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => CardDetails) private _details;
    mapping(uint256 => string) private _tokenUris;
    mapping(bytes32 => bool) public certificationUsed;

    event CardVaulted(uint256 indexed tokenId, address indexed owner, bytes32 indexed certificationHash, bytes32 attestationHash);
    event CustodyAttestationUpdated(uint256 indexed tokenId, bytes32 attestationHash);
    event CustodyStatusChanged(uint256 indexed tokenId, CustodyStatus status);

    constructor(address admin, address custodian) ERC721("Collector Credit Vaulted Card", "CCARD") {
        require(admin != address(0) && custodian != address(0), "Zero role address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CUSTODIAN_ROLE, custodian);
    }

    function mint(
        address to,
        string calldata cardName,
        string calldata setName,
        uint16 year,
        string calldata grader,
        string calldata grade,
        string calldata certificationNumber,
        string calldata imageUri,
        string calldata metadataUri,
        bytes32 custodyAttestationHash
    ) external onlyRole(CUSTODIAN_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "Zero owner");
        require(bytes(certificationNumber).length != 0, "Empty certification");
        require(custodyAttestationHash != bytes32(0), "Missing attestation");
        bytes32 certificationHash = keccak256(bytes(certificationNumber));
        require(!certificationUsed[certificationHash], "Certification already used");
        certificationUsed[certificationHash] = true;
        tokenId = _nextTokenId++;
        _details[tokenId] = CardDetails({
            cardName: cardName,
            setName: setName,
            year: year,
            grader: grader,
            grade: grade,
            certificationNumber: certificationNumber,
            imageUri: imageUri,
            custodyAttestationHash: custodyAttestationHash,
            custodyStatus: CustodyStatus.Vaulted
        });
        _tokenUris[tokenId] = metadataUri;
        _safeMint(to, tokenId);
        emit CardVaulted(tokenId, to, certificationHash, custodyAttestationHash);
    }

    function cardDetails(uint256 tokenId) external view returns (CardDetails memory) {
        _requireOwned(tokenId);
        return _details[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenUris[tokenId];
    }

    function updateCustodyAttestation(uint256 tokenId, bytes32 attestationHash) external onlyRole(CUSTODIAN_ROLE) {
        _requireOwned(tokenId);
        require(attestationHash != bytes32(0), "Missing attestation");
        require(_details[tokenId].custodyStatus != CustodyStatus.Pledged, "Card pledged");
        require(_details[tokenId].custodyStatus != CustodyStatus.Liquidated, "Card liquidated");
        _details[tokenId].custodyAttestationHash = attestationHash;
        emit CustodyAttestationUpdated(tokenId, attestationHash);
    }

    function setCustodyStatus(uint256 tokenId, CustodyStatus status) external onlyRole(LOAN_MANAGER_ROLE) {
        _requireOwned(tokenId);
        CustodyStatus current = _details[tokenId].custodyStatus;
        require(
            (status == CustodyStatus.Pledged && (current == CustodyStatus.Vaulted || current == CustodyStatus.Released)) ||
            ((status == CustodyStatus.Released || status == CustodyStatus.Liquidated) && current == CustodyStatus.Pledged),
            "Invalid custody transition"
        );
        _details[tokenId].custodyStatus = status;
        emit CustodyStatusChanged(tokenId, status);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
