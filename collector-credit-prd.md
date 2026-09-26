# Collector Credit: Hackathon Product Requirements Document

**Version:** 1.0  
**Network:** Ethereum Sepolia  
**Audience:** ETHGlobal Tokyo judges, collectors, and liquidity providers  
**Status:** Build specification  

## 1. Product Definition

Collector Credit is a lending market where a collector locks a tokenized, vaulted graded Pokemon card and instantly borrows USDC against it. Liquidity providers fund a shared pool and earn a share of borrower interest. If a borrower defaults, the collateral is sold through an onchain auction and the proceeds repay the pool.

### One-line pitch

**Keep the card. Unlock the cash.**

### Hackathon promise

The demo proves a complete credit lifecycle on Sepolia:

1. A unique human verifies eligibility.
2. A vaulted card is represented by an ERC-721.
3. An authenticated valuation produces an instant loan quote.
4. The collector escrows the card and receives MockUSDC.
5. Lenders supply liquidity and accrue yield.
6. Repayment returns the card, or default sends it to auction.
7. Auction proceeds follow a deterministic settlement waterfall.

## 2. Problem

Collectors may hold meaningful wealth in authenticated graded cards but have only two practical ways to access cash: sell the asset or arrange a slow, bespoke collateral loan. Selling sacrifices future ownership and upside. Traditional underwriting introduces paperwork, opaque pricing, custody coordination, and settlement delays.

Vaulting and tokenization solve authentication, custody, and digital transfer, but ownership tokens alone do not turn a collectible into productive collateral. Collector Credit adds the missing credit layer.

## 3. Goals

### Primary goals

- Demonstrate borrowing against one tokenized graded Pokemon card in under two minutes.
- Demonstrate the lender journey from deposit to earned interest.
- Demonstrate both terminal outcomes: repayment and default liquidation.
- Make World ID, ENSv2, and Curvegrid essential to the product rather than decorative integrations.
- Keep every financial state and role understandable from the dashboard.

### Success criteria

- All core contracts are deployed on Sepolia and linked from the submission.
- A fresh wallet can complete the borrower flow without manual contract interaction.
- A lender can deposit MockUSDC and receive pool shares.
- The UI shows principal, APR, maturity, accrued interest, health state, and expected LP APY.
- A judge can trigger accelerated maturity and complete a default auction during the demo.
- Loan, repayment, default, auction, and settlement events appear in the indexed activity feed.
- World ID rejection and stale valuation states are visible and handled cleanly.

### Non-goals

- Real physical custody or shipping.
- Mainnet deployment or real funds.
- Legal, tax, or regulatory production readiness.
- A generalized marketplace for every RWA category.
- Fractional card ownership, perpetuals, ETFs, or a protocol token.
- Variable-rate loans, refinancing, revolving credit, or cross-chain lending.
- An official integration or partnership with Courtyard, PSA, or Pokemon.

## 4. Users

### Collector / borrower

Owns a tokenized graded card, wants liquidity without selling, and accepts a fixed-term overcollateralized loan.

### Liquidity provider

Deposits MockUSDC into a pooled vault, receives transferable pool shares, and earns a proportional share of collected interest.

### Appraiser

An authorized backend signer that issues short-lived EIP-712 card valuations.

### Custodian

For the demo, an authorized operator that attests that a physical card was received and mints its representative NFT.

### Liquidator / bidder

Purchases defaulted collateral through a timed MockUSDC auction.

### Protocol operator

Configures supported collateral, risk limits, demo time controls, and emergency pauses.

## 5. Product Scope

### Borrower experience

1. Connect a Sepolia wallet.
2. Verify with World ID for the `collector-credit-borrower` action.
3. Claim or receive a demo vaulted-card NFT.
4. Open the card detail page and request a quote.
5. See valuation, maximum LTV, principal, APR, duration, interest, repayment total, maturity, and liquidation terms.
6. Approve the escrow and accept the quote.
7. Receive MockUSDC in the connected wallet.
8. Monitor loan state and accrued interest.
9. Repay principal plus interest and reclaim the NFT, or allow the loan to default.

### Lender experience

1. Connect a wallet and mint demo MockUSDC.
2. Review pool liquidity, utilization, outstanding loans, realized yield, reserve balance, and loss history.
3. Deposit MockUSDC and receive ERC-4626-style shares.
4. Observe capital move from available liquidity to active loans.
5. Observe interest and auction recoveries return to the pool.
6. Withdraw available liquidity by redeeming shares.

### Default experience

1. Demo operator advances a loan beyond maturity and grace period.
2. Anyone calls `markDefault`.
3. The NFT moves from loan escrow into a timed auction.
4. Bidders approve and submit MockUSDC bids.
5. After expiry, anyone settles the auction.
6. The highest bidder receives the NFT.
7. Proceeds pay principal, lender interest, protocol fee, and reserve contribution; any remaining surplus returns to the borrower.
8. A shortfall reduces pool assets and is shown as a realized pool loss.

## 6. Financial Model

The demo uses fixed terms so every number is predictable and easy to explain.

### Default demo parameters

| Parameter | Value |
|---|---:|
| Card appraised value | 10,000 USDC |
| Maximum LTV | 35% |
| Loan principal | 3,500 USDC |
| Loan duration | 90 days |
| Borrower APR | 20% simple interest |
| Grace period | 7 days |
| Interest due at 90 days | 172.60 USDC |
| Total repayment | 3,672.60 USDC |
| LP share of interest | 75% |
| Protocol share | 15% |
| Reserve share | 10% |

Interest is calculated as:

`interest = principal * APR * elapsedSeconds / 365 days`

Expected lender APY is not hard-coded. It is presented as an estimate based on borrower APR, utilization, and the LP interest share:

`estimated LP APY = borrower APR * utilization * 75%`

At 35% utilization this is approximately 5.25%; at 80% utilization it is approximately 12%.

### Risk tiers

The MVP supports one conservative tier:

- Eligible collection: demo vaulted graded Pokemon cards.
- Maximum LTV: 35%.
- Fixed APR: 20%.
- Fixed duration: 90 days.
- Quote validity: 10 minutes.
- Maximum valuation age: 24 hours.

### Auction waterfall

Auction proceeds are distributed in this order:

1. Principal returned to the lending pool.
2. Accrued lender interest returned to the pool.
3. Protocol fee.
4. Reserve contribution.
5. Surplus returned to borrower.

If proceeds cannot cover principal, the pool absorbs the shortfall pro rata through a lower share price. No lender is promised principal protection.

## 7. Smart Contract Architecture

### `MockUSDC`

- ERC-20 with six decimals.
- Permissionless faucet for hackathon use.
- Clearly labeled test currency in the UI.

### `VaultedCardNFT`

- ERC-721 representing a card held by the simulated partner vault.
- Mint restricted to the `CUSTODIAN_ROLE`.
- Metadata includes grading company, certification number, card name, set, year, grade, image URI, custody status, and custody attestation hash.
- Certification numbers must be unique.
- Burn or redemption is out of scope.

### `ValuationVerifier`

- Verifies EIP-712 signatures from an authorized `APPRAISER_ROLE` signer.
- Signed payload includes chain ID, card contract, token ID, value, currency, issued time, expiry, and nonce.
- Rejects expired quotes, reused nonces, unsupported assets, and wrong-chain signatures.

### `LoanVaultFactory` and `LoanVault`

- Deploys one deterministic vault per loan using a minimal-proxy or equivalent factory pattern.
- Holds only the collateral assigned to that loan.
- Enforces target-, function-, asset-, amount-, time-, and state-scoped permissions.
- Allows the borrower to recover collateral only after confirmed repayment.
- Allows the auction contract to transfer collateral only after `LoanManager` records default.
- Revokes all temporary operating permissions when the loan reaches a terminal state.
- Prevents the protocol operator from arbitrarily withdrawing collateral.

### `LendingPool`

- ERC-4626-style MockUSDC vault.
- Accepts deposits and mints shares.
- Exposes total assets, available liquidity, deployed principal, utilization, realized interest, reserve balance, and losses.
- Only `LoanManager` can draw principal or return settlement funds.
- Withdrawals cannot exceed available liquidity.

### `LoanManager`

- Creates fixed-term loans using verified valuations.
- Deploys or initializes the deterministic `LoanVault` associated with each accepted quote.
- Checks World ID eligibility through the application verification registry.
- Enforces collection allowlist, LTV, quote expiry, pool liquidity, and one active loan per NFT.
- Moves collateral into its isolated loan vault, draws from `LendingPool`, and transfers MockUSDC to the borrower atomically.
- Calculates repayment and routes principal and interest shares.
- Marks overdue loans in default and transfers collateral to `LiquidationAuction`.

### `HumanVerificationRegistry`

- Stores only the wallet authorization result and World ID nullifier-derived replay protection required by the application.
- Verification occurs server-side through World ID; the backend submits or authorizes the onchain registration.
- Prevents reuse of the same World ID action nullifier for another wallet. Selfie Check and document credentials do not provide Orb-level person uniqueness.
- Does not expose passport details or personal data.

### `LiquidationAuction`

- English auction denominated in MockUSDC.
- Configurable demo duration, recommended three minutes.
- Enforces minimum opening bid and minimum bid increment.
- Pulls funds from bidders and refunds the previous highest bidder.
- Transfers the NFT and calls the pool settlement path after expiry.
- Includes a no-bid fallback that transfers the NFT to a protocol recovery address and records an unresolved recovery value.

### Contract events

- `CardVaulted`
- `ValuationAccepted`
- `LiquidityDeposited`
- `LiquidityWithdrawn`
- `LoanOriginated`
- `LoanRepaid`
- `LoanDefaulted`
- `AuctionStarted`
- `BidPlaced`
- `AuctionSettled`
- `PoolLossRecorded`

## 8. Sponsor Integrations

### World ID: eligibility, not login decoration

World ID is used at the moment a user becomes eligible to borrow. IDKit collects the proof, the backend verifies it against the World Developer API, and the application records an authorization bound to the wallet and the `collector-credit-borrower` action.

The borrower can choose Orb Proof of Human, NFC passport, Japanese My Number Card, or Selfie Check. Each method grants the same demo loan terms after server verification; the authorization record stores which credential was used. Orb provides the strongest one-person guarantee. A document proves a unique document, and Selfie Check is a medium-assurance liveness and abuse-resistance signal.

Required demo states:

- Successful verification enables borrowing.
- Reused or invalid proof is rejected.
- Unverified wallets may browse and lend but cannot originate a loan.
- No raw identity or passport data is written onchain.

### Smart accounts and ENSv2: the permission and identity plane

Each borrower receives a user-controlled smart account with embedded onboarding and sponsored Sepolia transactions. Collector Credit never controls the user's private key. Every originated loan creates a deterministic, isolated loan vault rather than another ordinary hot wallet.

Suggested namespace and account structure:

- `collectorcredit.eth`: application root.
- `alice.collectorcredit.eth`: Alice's primary smart account.
- `loan-001.alice.collectorcredit.eth`: the smart-account module or vault for Alice's first loan.
- `pool.collectorcredit.eth`: lender pool.
- `custodian.collectorcredit.eth`: custody attestation authority.
- `appraiser.collectorcredit.eth`: authorized valuation signer.
- `liquidator.collectorcredit.eth`: default auction and settlement authority.

The loan vault holds the pledged NFT and grants narrowly constrained capabilities:

| Actor | Conditional permission |
|---|---|
| Borrower | Repay the debt and recover the card after full settlement. |
| Loan Manager | Release no more than the accepted principal after every origination check passes. |
| Custodian | Submit or update custody attestations only. |
| Appraiser | Submit expiring valuations only; never transfer assets. |
| Auction contract | Transfer collateral only after the loan enters verified default. |
| Protocol operator | Pause new originations, but never seize collateral or lender principal. |

Permissions are scoped by target contract, callable function, asset, amount, expiry, and loan state. They are revoked automatically when the loan is repaid or its auction settles. The loan vault remains the onchain enforcement boundary; ENSv2 names, resolver records, and Enhanced Access Control make its identities and delegated authorities discoverable and auditable.

The dashboard resolves names instead of presenting only hexadecimal addresses. The demo must show one conditional permission succeeding, the same action failing from an unauthorized account, and the permission disappearing after settlement.

### Curvegrid MultiBaas: the operating data layer

MultiBaas manages contract ABIs and indexes the emitted lifecycle events. The frontend or backend uses event queries for:

- Active and historical loans.
- Borrower portfolio state.
- Pool deposits, utilization, yield, and losses.
- Auction bids and settlement history.
- A live activity feed during the demo.

Webhooks react to `LoanOriginated`, `LoanRepaid`, `LoanDefaulted`, and `AuctionSettled`. If sponsor credentials are unavailable during local development, the app falls back to direct RPC reads while preserving the MultiBaas adapter boundary.

## 9. Backend Services

### Valuation service

Returns a signed, expiring valuation. Demo market inputs are transparent fixtures modeled as comparable sales rather than presented as live production prices.

Example response fields:

- Card identity and certification number.
- Last comparable sale.
- Thirty-day median.
- Liquidity confidence.
- Conservative appraised value.
- Signed timestamp and expiry.

### World verification endpoint

- Accepts the IDKit proof and wallet address.
- Verifies the action with World ID.
- Rejects replay and wallet mismatch.
- Returns the authorization transaction payload or relays registration.

### Curvegrid adapter

- Queries indexed contract events.
- Normalizes them into borrower, lender, and activity-feed models.
- Receives webhooks idempotently.

## 10. Interface Requirements

### Global navigation

- Borrow
- Earn
- Auctions
- Activity
- Connected wallet and resolved ENS name
- Sepolia network indicator

### Borrow dashboard

- Card portfolio with custody and eligibility status.
- Card detail with grading data and valuation evidence.
- Quote panel with all loan economics before approval.
- Transaction progress with explicit wallet and confirmation states.
- Active loan timeline and repayment command.

### Earn dashboard

- Total pool assets.
- Available and deployed liquidity.
- Utilization and estimated APY.
- Outstanding principal and realized interest.
- Deposit and withdraw controls.
- Risk disclosure: withdrawals depend on available liquidity; principal can be lost.

### Auction dashboard

- Card, valuation, debt, opening bid, current bid, timer, and bid history.
- Bid and settle controls.
- Settlement waterfall preview and final realized amounts.

### Demo controls

A clearly labeled “Demo controls” drawer may:

- Mint test USDC.
- Mint a vaulted-card NFT after simulated custody receipt.
- Advance a loan to maturity.
- Switch among borrower, lender, and bidder demo wallets.

These controls must never masquerade as production behavior.

## 11. State Machines

### Loan

`Quoted -> Active -> Repaid`

or

`Quoted -> Active -> Overdue -> Defaulted -> InAuction -> Settled`

Invalid transitions revert. An NFT cannot secure more than one active loan.

### Card custody

`Received -> Vaulted -> Pledged -> Released`

or

`Received -> Vaulted -> Pledged -> Liquidated`

### Auction

`Created -> Live -> Ended -> Settled`

## 12. Security and Failure Requirements

- Use checks-effects-interactions and reentrancy protection around token movement.
- Use safe transfer methods for ERC-20 and ERC-721 assets.
- Bind valuations to chain, contract, token, expiry, and nonce.
- Reject stale valuations and replayed signatures.
- Pause new originations without blocking repayments.
- Prevent admin withdrawal of borrower collateral or lender principal.
- Cap maximum loan size and supported LTV.
- Handle fee-on-transfer incompatibility by supporting only MockUSDC.
- Make webhook processing idempotent; the chain remains the source of truth.
- Add explicit empty-pool, insufficient-liquidity, no-bid, and underwater-auction states.

## 13. Test Plan

### Contract tests

- Deposit, share minting, withdrawal, and utilization math.
- Origination at and above maximum LTV.
- Valid, expired, wrong-token, wrong-chain, and replayed valuations.
- Verified and unverified borrower behavior.
- Atomic escrow and disbursement.
- Exact repayment and interest distribution.
- Early repayment interest calculation.
- Default before and after grace period.
- Auction bidding, refund, settlement, surplus, and shortfall.
- Reentrancy and unauthorized role attempts.
- Pause behavior and invariant: each pledged NFT maps to exactly one loan.

### End-to-end tests

- Borrower happy path.
- World ID failure path.
- Lender deposit and withdrawal path.
- Repayment path.
- Default and auction path.
- ENS name resolution and denied permission update.
- Indexed events matching onchain state.

## 14. Demo Script

### Target length: 3 minutes

**0:00-0:20 — Hook**  
“This Charizard is worth $10,000, but its owner must sell it to access a dollar. Collector Credit turns a vaulted card into an instant credit line.”

**0:20-0:50 — Lender**  
Deposit MockUSDC. Show shares, available liquidity, utilization, and estimated yield.

**0:50-1:40 — Borrower**  
Verify with World ID, open the card, request its signed valuation, inspect the 35% LTV quote, and accept. Show the NFT enter escrow and 3,500 MockUSDC arrive.

**1:40-2:05 — Identity and operations**  
Resolve the borrower and loan through ENSv2. Show role-based records and the Curvegrid-backed event feed.

**2:05-2:45 — Default**  
Advance time, mark default, place an auction bid, settle, transfer the card, and show the pool recovery waterfall.

**2:45-3:00 — Close**  
“Tokenization made the card transferable. Collector Credit makes it productive.”

## 15. Delivery Priorities

### P0: required for submission

- MockUSDC, card NFT, valuation verifier, lending pool, loan manager, and auction contracts.
- Borrower, lender, and default flows in one frontend.
- Sepolia deployments and explorer links.
- World ID success and failure paths.
- ENSv2 name plus one meaningful permission demonstration.
- Curvegrid event indexing for the activity feed.
- Automated tests and a recorded backup demo.

### P1: polish

- Multiple card fixtures.
- Pool performance chart.
- ENS-based address display throughout.
- Better comparable-sales visualization.
- Auction bid notifications.

### P2: only after the complete lifecycle works

- Multiple collateral risk tiers.
- Portfolio-level loans.
- Multiple pools by card category.

## 16. Honest Claims

The presentation must say:

- “MockUSDC on Sepolia,” not “USDC.”
- “Simulated partner vault receipt,” not “our vault received the physical card.”
- “Courtyard-compatible card representation,” not “integrated with Courtyard,” unless an official integration is completed.
- “Demo valuation fixtures signed by our oracle,” not “live market price,” unless a live licensed data source is wired in.
- “Estimated APY,” not guaranteed yield.

## 17. Open Inputs Before Submission

- Founder names, contact details, and team credentials.
- Final app URL, GitHub URL, contract addresses, and demo video.
- Final ENSv2 root name availability.
- World Developer Portal app and action IDs.
- Curvegrid deployment credentials and indexed contract labels.
- Final project name check; this document uses **Collector Credit**.
