// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockUSDC} from "./MockUSDC.sol";
import {VaultedCardNFT} from "./VaultedCardNFT.sol";
import {HumanVerificationRegistry} from "./HumanVerificationRegistry.sol";
import {ValuationVerifier} from "./ValuationVerifier.sol";

contract FoundationsTest {
    function testMockUsdcHasSixDecimalsAndFaucetCooldown() public {
        MockUSDC token = new MockUSDC();
        require(token.decimals() == 6, "wrong decimals");
        token.faucet();
        require(token.balanceOf(address(this)) == 10_000 * 10 ** 6, "wrong faucet amount");
        try token.faucet() {
            revert("second faucet claim succeeded");
        } catch {}
    }

    function testCardCertificationCannotBeMintedTwice() public {
        VaultedCardNFT card = new VaultedCardNFT(address(this), address(this));
        uint256 tokenId = card.mint(
            address(0xCAFE), "Charizard", "Base Set", 1999, "PSA", "9", "DEMO-001",
            "ipfs://image", "ipfs://metadata", bytes32(uint256(1))
        );
        require(tokenId == 1, "wrong token id");
        require(card.ownerOf(tokenId) == address(0xCAFE), "wrong owner");
        try card.mint(
            address(0xBEEF), "Charizard", "Base Set", 1999, "PSA", "9", "DEMO-001",
            "ipfs://image", "ipfs://metadata", bytes32(uint256(2))
        ) {
            revert("duplicate certification succeeded");
        } catch {}
    }

    function testCustodyCannotReleaseWithoutPledge() public {
        VaultedCardNFT card = new VaultedCardNFT(address(this), address(this));
        card.grantRole(card.LOAN_MANAGER_ROLE(), address(this));
        uint256 tokenId = card.mint(
            address(0xCAFE), "Charizard", "Base Set", 1999, "PSA", "9", "DEMO-002",
            "ipfs://image", "ipfs://metadata", bytes32(uint256(3))
        );
        try card.setCustodyStatus(tokenId, VaultedCardNFT.CustodyStatus.Released) {
            revert("release without pledge succeeded");
        } catch {}
        card.setCustodyStatus(tokenId, VaultedCardNFT.CustodyStatus.Pledged);
        card.setCustodyStatus(tokenId, VaultedCardNFT.CustodyStatus.Released);
        require(card.cardDetails(tokenId).custodyStatus == VaultedCardNFT.CustodyStatus.Released, "wrong status");
    }

    function testWorldNullifierCannotAuthorizeTwoWallets() public {
        HumanVerificationRegistry registry = new HumanVerificationRegistry(address(this), address(this));
        bytes32 nullifier = bytes32(uint256(42));
        registry.registerBorrower(address(0xCAFE), nullifier);
        require(registry.isVerifiedBorrower(address(0xCAFE)), "borrower not verified");
        try registry.registerBorrower(address(0xBEEF), nullifier) {
            revert("replayed nullifier succeeded");
        } catch {}
        require(!registry.isVerifiedBorrower(address(0xBEEF)), "second wallet verified");
    }

    function testValuationRejectsWrongAssetBeforeSignatureRecovery() public {
        ValuationVerifier verifier = new ValuationVerifier(
            address(this), address(this), address(0xCAFE), address(0xBEEF)
        );
        ValuationVerifier.Valuation memory valuation = ValuationVerifier.Valuation({
            cardContract: address(0x1234), tokenId: 1, value: 10_000 * 10 ** 6,
            currency: address(0xBEEF), issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 10 minutes), nonce: bytes32(uint256(1))
        });
        try verifier.verify(valuation, "") {
            revert("wrong asset was accepted");
        } catch {}
    }
}
