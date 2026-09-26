# Pawn Shop

![Pawn Shop cover](public/brand/cover.jpg)

A Sepolia demo lending market for simulated vaulted collectible cards. The in-app How it works dialog covers the borrower and lender flows; a [direct-link guide](http://localhost:3000/docs) remains available. This README records the implementation and integration details. The interface uses Next.js 16, shadcn-style neutral components, Reown AppKit, Drizzle, and SQLite. Contracts use Hardhat 3 and OpenZeppelin. MockUSDC is a valueless test token; the seeded cards are simulated custody receipts.

Pawn Shop is the consumer name. Previously deployed contract names, World action IDs, and ENS records still use Collector Credit identifiers so existing testnet integrations continue to work.

Brand assets are in [`public/brand`](public/brand): the cover image, square mascot icon, and horizontal logos for light and dark backgrounds. Use the SVG files for scalable placements and PNG files where raster artwork is required.

## Local setup

```sh
nvm use
corepack pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Set `NEXT_PUBLIC_REOWN_PROJECT_ID` in `.env.local` before connecting a wallet. The local database lives in `data/collector-credit.db` and is ignored by Git. Node 24 and pnpm 11.19.0 are pinned by `.nvmrc` and `packageManager`.

## Checks

```sh
pnpm typecheck
pnpm test:unit
pnpm contracts:compile
pnpm contracts:test
pnpm build
```

The Solidity tests cover origination, World eligibility gating, escrow, lender utilization, repayment splits, pause behavior, valuation replay, grace periods, demo maturity acceleration, bidding and refunds, successful auction settlement, and pool losses.

## Sepolia deployment

Keep `DEPLOYER_PRIVATE_KEY` and `APPRAISER_PRIVATE_KEY` in the ignored `.env.local` file. The appraiser address is derived from its key. The deployer needs Sepolia ETH for eight contracts and role setup.

```sh
pnpm deploy:check
pnpm contracts:compile
pnpm deploy:sepolia
```

`deploy:check` only reads the network and balance. `deploy:sepolia` sends transactions, saves checkpoints in `deployments/sepolia.json`, and fills public contract addresses in `.env.local`. Rerunning it resumes from the saved contracts. Restart Next.js after deployment so public addresses are included in the client bundle.

The active auction starts at 75% of the signed card value recorded when its loan opens; later bids increase by at least 5%. The replacement market reuses MockUSDC, card NFTs, the World registry, and the valuation verifier. It deploys a new pool, vault factory, loan manager, and auction because the manager accepts an auction address only once. The latest migration used `pnpm deploy:fresh`, `pnpm pool:rollover-demo`, and `pnpm deploy:activate`. Rollover moves only deployer-owned test liquidity and preserves liquidity for any outstanding loans in the old pool. Activation saves previous addresses in `deployments/sepolia-previous.json` and archives older markets in `deployments/archive/`. The app reads active legacy loans from the manager addresses in `NEXT_PUBLIC_LEGACY_LOAN_MANAGER_ADDRESSES`, so their borrowers can still repay. `pnpm deploy:pause-previous` stops new borrowing on the retired manager. The settled previous market's MultiBaas links were retired to make room for the new manager, pool, and auction; `pnpm curvegrid:setup` linked the new market. ENS subnames were updated with `pnpm ens:protocol:setup`. Restart Next.js after changing public addresses.

Set `DEMO_BORROWER_ADDRESS` to the wallet that should own the sample portfolio, then run:

```sh
pnpm card:mint-demo
pnpm card:mint-portfolio
```

The public landing page is at `/`. The Borrow page shows the card picker only after wallet connection. It reads Sepolia ownership for minted catalog NFTs and includes a card escrowed for an active loan when the connected wallet is the borrower. Other wallets see an empty collection until they claim a simulated card on `/faucet`.

The mint scripts record public checkpoints in `deployments/`, link the NFTs to SQLite cards, and refresh the demo valuation fixtures. Their metadata explicitly describes simulated custody. They retain a card's original token ID after an auction instead of minting a duplicate. The replacement loan manager accepts both newly auctioned receipts and older NFTs still marked `Liquidated`, provided the current owner is World-verified and gets a fresh signed valuation. `pnpm pool:seed-demo` calculates enough valueless MockUSDC to cover all five current maximum demo loans. A fresh deployment may need a second faucet claim after the one-day cooldown to reach that target; the script deposits the available amount meanwhile. On the testnet deployment, the borrower or protocol admin can click **Advance demo loan to default** after origination. This charges interest for the selected 30-, 60-, or 90-day term and makes the loan immediately default-eligible, allowing the three-minute auction to fit into a live walkthrough. The control is disabled when `LoanManager` is constructed with `demoMode=false`.

## ENSv2 identity and delegation on Sepolia

The demo has two separate ENSv2 Sepolia roots. `cardloanstest.eth` belongs to the borrower wallet `0xADc360fD724a714c585604389BC7dd07DB355Ee0`. `altrwalend.eth` belongs to the protocol demo wallet recorded in `deployments/ens-protocol-sepolia.json`. The latter is an EOA for this testnet demo; a production protocol root should be held by a governed multisig. Neither Sepolia name reserves the equivalent name on Ethereum mainnet.

The protocol-controlled subregistry contains `appraiser.altrwalend.eth`, `pool.altrwalend.eth`, and `auction.altrwalend.eth`. They resolve to the valuation signer, LendingPool, and LiquidationAuction respectively. The appraiser name uses a dedicated resolver. Its signer wallet has ENSv2 Enhanced Access Control permission to update only `com.altrwalend.appraiser.note`; it cannot update another text key or the address record. The protocol owner keeps administrative recovery rights. A published note from the appraiser wallet demonstrates the delegation onchain. ENS names and record permissions are for identity and disclosure; the lending contracts separately enforce valuation, custody, and loan actions.

```sh
pnpm ens:verify
pnpm ens:protocol:verify
```

The **Identity** page resolves the names and exposes both the borrower record permission demo and the appraiser's scoped disclosure. An unrelated wallet can simulate a denied edit without spending gas. The scripts are idempotent if the testnet setup needs to be reproduced:

```sh
pnpm ens:register
pnpm ens:protocol:register
pnpm ens:protocol:setup
```

The registration scripts use the fee token, resolver and subregistry proxies, and commit-reveal. `pnpm ens:protocol:setup` creates the three subnames and applies the key-scoped grant. It may fund the local demo appraiser signer with a small amount of Sepolia ETH for the first disclosure transaction. Commitment secrets are stored under ignored, mode-600 files in `data/`; the public checkpoints are in `deployments/`. See the [ENSv2 resolver permission docs](https://docs.ens.domains/ensv2/permissioned-resolver/) for the key-scoped role model.

## World ID

The borrower page uses IDKit 4 with a wallet signal and an RP signature generated by the server. Add `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, and `WORLD_ENVIRONMENT` from a World Developer Portal app configured for the `collector-credit-borrower` action. The server sends the complete proof to World's v4 verification endpoint, checks the action, environment, wallet signal, and nullifier, then registers the borrower on Sepolia. The signing key stays server-side.

The World Developer Portal app `app_f1f46bc30a3be9cd82a88c134ae66bb8` and RP `rp_9139c8262c84010e` are registered in production and staging, with the `collector-credit-borrower` action in both environments. The local, ignored `.env.local` contains the RP signing key and uses production for real World App users. Provide this key as a server-side secret in any deployed environment. Borrowing remains gated until each borrower completes verification.

Borrowers can select Orb Proof of Human, NFC passport, Japanese My Number Card, or Selfie Check. The backend accepts only a matching World-verified v4 credential, wallet signal, action nullifier, and wallet signature before registering the wallet. The local authorization record includes the credential type; the Sepolia registry records only eligibility and nullifier replay protection. All four methods unlock the same demo loan terms. Selfie Check does not guarantee one person per account, and an NFC ID proves a unique document rather than a unique person; Orb remains the strongest uniqueness option.

A [World staging simulator](https://github.com/worldcoin/simulator/blob/main/docs/mcp.md) proof was accepted by the application and registered a disposable wallet on Sepolia in transaction `0xfab6e2a41723ade741d4de96de1fc6008ce0a8955049bbe6b1f996c815bbe51a`; the onchain borrower flag and local authorization row were confirmed. To repeat this test, set `WORLD_ENVIRONMENT=staging`, rebuild and restart the app, and run `pnpm world:smoke`. It creates another disposable wallet and sends a Sepolia registration transaction. Restore `WORLD_ENVIRONMENT=production`, then rebuild and restart after testing.

## Activity and auctions

The activity page pulls confirmed events from the public Sepolia RPC into SQLite with an idempotent cursor; transactions link to Etherscan. It also reads MultiBaas indexed events and deduplicates them against RPC history by transaction hash and log index. The Auctions page reads current auction state from the active manager and auction contracts, falling back to locally indexed events during brief RPC failures. The `POST /api/curvegrid/webhook` endpoint validates MultiBaas HMAC signatures and timestamps, accepts only events from the deployed contracts, decodes their indexed logs, and deduplicates them in SQLite. Set `CURVEGRID_WEBHOOK_SECRET` to activate it; remote delivery needs a public HTTPS deployment.

### Curvegrid setup

1. In [Curvegrid Console](https://console.curvegrid.com/), create a MultiBaas deployment on **Ethereum Sepolia** (chain ID `11155111`). Save its deployment origin URL, without `/apikeys`, as `CURVEGRID_DEPLOYMENT_URL` in the ignored `.env.local` file. Confirm that the console offers event indexing for this network.
2. Go to **Admin → API Keys → New Key**. Create a key named `collector-credit-server` in a group with Blockchain API and event read access. Save it immediately as `CURVEGRID_API_KEY` in `.env.local`; the console will not show it again. The app does not send this key to the browser. Do not select **Use this key as a public Web3 key**, which is for Curvegrid Testnet.
3. Run `pnpm curvegrid:check` to verify network and plan limits, then `pnpm curvegrid:setup` to upload the local ABIs and link **LoanManager**, **LendingPool**, **LiquidationAuction**, **VaultedCardNFT**, **HumanVerificationRegistry**, and **ValuationVerifier** with event syncing. The script is idempotent and uses the plan's permitted recent block depth. The current deployment allows ten linked contracts and 100 blocks of historical syncing; our direct RPC indexer retains the earlier demo events. You can also inspect the links under **Contracts → On-Chain** in the console.
4. After the app has a public HTTPS URL, go to **Blockchain → Webhooks → +** and subscribe `event.emitted` to `https://<your-app-host>/api/curvegrid/webhook`. Obtain the HMAC signing secret used by your MultiBaas deployment and put it in `CURVEGRID_WEBHOOK_SECRET`; if the console does not show how to obtain it, confirm that detail with Curvegrid before enabling the receiver. `localhost` cannot receive Curvegrid's remote callbacks.

See Curvegrid's [quickstart](https://docs.curvegrid.com/multibaas/getting-started/quickstart/), [API key](https://docs.curvegrid.com/multibaas/api-keys/), and [webhook](https://docs.curvegrid.com/multibaas/webhooks/) guides. The API reader is active; the webhook receiver will be useful after the app has a public HTTPS URL.

## Current limits

This is a hackathon demo, not a production lending deployment. The collection is a simulated receipt, the currency has a public faucet, and loans use 35% maximum LTV, 20% simple APR, a borrower-selected 30-, 60-, or 90-day term, and a seven-day grace period. Interest accrues for the actual time borrowed up to the selected maturity. The ENSv2 identities, protocol subnames, and scoped appraiser disclosure are live on Sepolia. Curvegrid API event reads are active. Smart-account onboarding and remote webhook delivery still require additional work or external access. World ID's staging proof path is verified end to end; a real person's production World App flow remains to be exercised.

## Realyse market signal

The read-only `GET /api/market-signal` route fetches the public [Realyse card API](https://realyse.io/docs). It pins the 1999 Base Set Charizard PSA 9 record, validates the card identity and a matching sale, and returns the reported reference price, evidence count, price status, and Realyse timestamp. If the source is unavailable or identity checks fail, the route returns no price. The public API requires no key for this demo. The consumer borrowing flow uses a separately curated PSA auction snapshot.

Realyse remains **read-only market context**. Its currently matched record is indicative and based on one reported sale. A different Realyse SKU labeled Base Set Charizard includes 2021 Celebrations sales; using that aggregate for collateral would misprice the demo card. Before this demo approach can determine real loans, add verified asset and sale matching, automated sale refresh, sample-size gates, licensed data rights, an explicit haircut policy, and operator review.

## Guided borrower flow

`/borrow` shows real reference artwork for the five simulated NFTs. Their estimates are curated, grade- and printing-matched **last recorded auction sales** in PSA's sale history: Pikachu Black Star Promo #027 PSA 8 ($31, Aug 2), Blastoise Base Set #2 PSA 8 ($410, Sep 21), Charizard Base Set #4 PSA 9 ($3,475, Sep 23), Venusaur Base Set #15 PSA 9 ($640, Sep 24), and Charizard Base Set #4 PSA 10 ($28,750, Sep 18). The sale snapshot and source URL are in `src/lib/demo-cards.ts`. The picture shows the card design, not the demo NFT's physical card or slab. The demo certificates are fictional. `GET /api/demo-price?cardId=...` returns the same sale amount and provenance used by signed loan quotes. Each loan is limited to 35% of the last sale and capped at 3,500 valueless MockUSDC; pool liquidity may limit simultaneous loans.

The NFT owner may request a signed quote before World ID verification so they can inspect its terms. Origination still requires World eligibility and onchain checks. The valuation signer checks that the stored amount matches the curated sale and that its date is no older than 90 days; a stale comparable blocks new loan quotes. Sale snapshots require manual review and refresh.
