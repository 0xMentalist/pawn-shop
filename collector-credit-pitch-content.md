# Prawn Shop: ETHGlobal Tokyo Pitch Deck Content

**Format:** 8 slides, 3-minute pitch  
**Narrative:** Problem-Agitate-Solve with a live product proof  
**Audience:** Hackathon judges  

## Slide 1: Prawn Shop

### On slide

**Keep your cards. Access their value.**

Test loans backed by tokenized, vaulted graded cards.

`Pokemon collateral` `Sepolia` `Working credit lifecycle`

### Speaker notes

“This Charizard may be worth $10,000, but its owner has to sell it to access a dollar. Prawn Shop lets them borrow against it instead.”

Do not begin with sponsor names or architecture. Establish the human outcome first.

## Slide 2: Valuable, Authenticated, Illiquid

### On slide

**Collectors can verify value. They still cannot use it.**

- Selling ends ownership.
- Specialty loans are slow and opaque.
- Vaulted cards remain financially idle.

Footer source cue: PSA offers insured vaulting and direct selling; Courtyard demonstrates that vaulted collectibles can be represented and transferred onchain.

### Speaker notes

“Grading tells us what the card is. Vaulting tells us where it is. Tokenization tells us who owns it. But none of those gives the collector credit.”

Avoid an unverified giant market-size claim. The concrete pain is stronger.

### Objection prep

**Why not simply sell the card?** The product is for collectors who need temporary liquidity but want to preserve ownership and future upside.

## Slide 3: One Asset, One Quote, One Transaction

### On slide

**A complete loan in minutes**

1. Verify the borrower.
2. Price and lock the card.
3. Receive MockUSDC instantly.

`$10,000 value` `35% LTV` `$3,500 principal` `20% fixed APR`

### Speaker notes

“An authorized appraiser signs a short-lived valuation. The collector sees every term before accepting. The NFT and loan principal move atomically, so neither side is left exposed.”

## Slide 4: Live Demo

### On slide

**Watch the entire credit lifecycle**

`Lender deposits -> Borrower draws -> Interest accrues -> Repay or liquidate`

Demo callouts:

- World ID-gated origination.
- ENSv2 permissioned loan identity.
- Curvegrid-indexed activity.
- Onchain default auction.

### Speaker notes

Spend most of the pitch here.

1. Deposit lender liquidity.
2. Verify and originate the loan.
3. Show the NFT in escrow and funds in the borrower wallet.
4. Advance maturity and start the auction.
5. Bid, settle, and show recovery to the pool.

State clearly that physical receipt, valuation data, and time advancement are simulated demo inputs. The financial contracts and lifecycle are live on Sepolia.

## Slide 5: The Trust Stack Is the Product

### On slide

**Three protocols remove three trust gaps**

| Trust gap | Integration | Product job |
|---|---|---|
| Is this one eligible borrower? | World ID | Sybil-resistant loan authorization |
| Who may update each record? | ENSv2 | Named identities and scoped permissions |
| What happened across the market? | Curvegrid | Indexed events, webhooks, dashboards |

### Speaker notes

“World ID is not our login button; it gates credit eligibility. ENS is not a vanity name; its permission system separates borrower, appraiser, custodian, and settlement authority. Curvegrid is not a block explorer link; it powers the operating view of loans, liquidity, and auctions.”

### Objection prep

**Could this be a normal database?** A database could display the workflow, but it would restore the platform as sole custodian of ownership, lender capital, settlement rules, and permission history. Here the collateral, capital, loan state, and auction settlement are independently verifiable and composable.

## Slide 6: Lenders Fund the Credit Market

### On slide

**Yield comes from paid borrower interest**

- LPs deposit MockUSDC.
- Pool capital funds loans.
- LPs receive 75% of interest.
- Defaults resolve through auction.

`Estimated LP APY = APR x utilization x LP share`

`5.25% at 35% utilization`  
`12% at 80% utilization`

### Speaker notes

“The APY is not invented or guaranteed. At a 20% borrower APR and a 75% lender share, utilization determines the outcome. We expose that math directly.”

Explain that auction shortfalls lower the pool share price. Overcollateralization reduces risk; it does not eliminate it.

## Slide 7: A Focused Wedge, Not an Empty Category

### On slide

**Tokenization exists. The credit layer is emerging.**

| Product | Tokenized cards | Pooled liquidity | Human gate | Permission plane | Full default demo |
|---|---:|---:|---:|---:|---:|
| Courtyard | Yes | No | Platform KYC | No | No |
| Slab.Finance | Yes | Yes | No | No | Yes |
| MLKY | Existing issuers | Yes | No | No | Described |
| Prawn Shop | Demo asset | Yes | World ID | ENSv2 | Yes |

### Speaker notes

“We are not claiming nobody has thought about card-backed lending. Slab.Finance and MLKY validate the category. Our hackathon thesis is that RWA credit needs a trust stack around the loan: borrower uniqueness, scoped operating permissions, indexed servicing, and explicit recovery.”

Do not claim durable competitive advantage yet. This is differentiated execution for the hackathon.

### Objection prep

**Is this just Slab.Finance again?** The core lending primitive overlaps. Prawn Shop differentiates through an identity and permission model designed for real-world operators, pooled lender transparency, and a judge-visible end-to-end servicing workflow. The strongest answer is the live demo, not rhetoric.

## Slide 8: From Collectible to Collateral

### On slide

**Tokenization made cards transferable. We make them productive.**

Built on Sepolia with:

`World ID` `ENSv2` `Curvegrid MultiBaas`

Demo: **[TBD URL]**  
Code: **[TBD GitHub]**  
Team: **[TBD names]**

### Speaker notes

“Today we demonstrated one card, one pool, and every outcome from origination to liquidation. Prawn Shop is the missing credit layer for tokenized alternative assets.”

The hackathon ask is simple: try the demo and inspect the Sepolia transactions.

## Backup Slide: Architecture

### On slide

`World ID -> HumanVerificationRegistry`

`Signed valuation -> ValuationVerifier`

`VaultedCardNFT -> LoanManager -> LendingPool`

`Default -> LiquidationAuction -> Pool settlement`

`All events -> Curvegrid MultiBaas -> Dashboard`

`All actors and records -> ENSv2 permissions`

### Speaker notes

Use this during technical Q&A. Emphasize atomic origination, replay-resistant valuations, isolated role permissions, and deterministic settlement.

## Backup Slide: Hard Questions

### How do you know the card is real?

In production, the protocol would accept only tokens from approved issuers whose NFTs map to authenticated, insured vaulted assets. The hackathon uses a custodian-gated mock issuer and labels it clearly.

### How do you prevent price manipulation?

Valuations are signed, asset-specific, short-lived, nonce-protected, and conservatively haircut. The MVP limits LTV to 35%. Production requires multiple data sources and liquidity-aware confidence bands.

### What happens when nobody bids?

The NFT moves to a recovery address and the unresolved shortfall is visible. The protocol does not fabricate recovery or guarantee lender principal.

### Why pooled rather than P2P?

Pooling gives borrowers instant execution and lenders passive diversified exposure. It also makes utilization and yield easy to demonstrate. The tradeoff is shared liquidity and shared loss risk.

### Why World ID for an overcollateralized loan?

It prevents repeated identities from farming subsidized credit or cycling demo eligibility, and it establishes a reusable human authorization without publishing personal data.

### What is real versus simulated?

Real on Sepolia: ownership, escrow, pool accounting, loan state, repayment, default, bidding, and settlement. Simulated but explicit: physical vault receipt, market-data inputs, and accelerated time.

## Evidence and Source Notes

- [PSA Vault](https://www.psacard.com/info/psa-vault) describes insured storage, digital asset management, retrieval, and direct selling.
- [Courtyard documentation](https://docs.courtyard.io/courtyard) describes tokenized, vaulted physical collectibles that can trade without repeatedly moving the item.
- [World ID API](https://docs.world.org/reference/api) documents server verification and action-level uniqueness.
- [ENSv2 overview](https://docs.ens.domains/ensv2/overview/) confirms Sepolia deployment and Enhanced Access Control.
- [ENSv2 EAC](https://docs.ens.domains/ensv2/enhanced-access-control/) documents resource-scoped roles and role administration.
- [Curvegrid MultiBaas](https://docs.curvegrid.com/multibaas/) documents contract management, event indexing, and webhooks.
- [Slab.Finance](https://ethglobal.com/showcase/slab-finance-2o8ng) is a 2026 ETHGlobal project for USDC loans against tokenized collectible collateral.
- [MLKY](https://mlky.io/) presents pooled lending against tokenized graded cards on Solana.

## Presentation Scorecard

| Dimension | Score now | What makes it stronger |
|---|---:|---|
| Innovation | 7/10 | Meaningful identity and permissions; core card lending has competitors. |
| Technical execution | 4/10 | Becomes 9/10 only when the Sepolia lifecycle works live. |
| Completeness | 5/10 | PRD is complete; deployed product and fallback video remain TBD. |
| Crypto necessity | 8/10 | Onchain custody, pooled capital, permissions, and deterministic auction settlement are concrete. |
| Presentation | 8/10 | Tight narrative; needs real screenshots, URLs, team, and transaction evidence. |
