import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ChevronDown, CircleHelp, Database, ExternalLink, GitBranch, Landmark, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import deployment from "../../../deployments/sepolia.json";

export const metadata: Metadata = {
  title: "How it works",
  description: "A detailed guide to Collector Credit, its Sepolia lending flow, integrations, limitations, and common questions.",
};

const anchorClass = "rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const navClass = "inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const sections = [
  ["overview", "Start here"],
  ["lifecycle", "Loan lifecycle"],
  ["partners", "Partner integrations"],
  ["architecture", "Architecture & data"],
  ["contracts", "Contract map"],
  ["economics", "Terms & risk"],
  ["status", "Current status"],
  ["faq", "FAQ"],
] as const;
const steps = [
  { title: "1. A lender funds the pool", text: "A lender claims valueless MockUSDC, approves the pool, and deposits it. The ERC-4626 pool issues ccUSDC shares. Available liquidity, utilization, and share value come from the contract." },
  { title: "2. A borrower proves eligibility", text: "The wallet connects through Reown. The borrower selects Orb, NFC passport, My Number Card, or Selfie Check. The server verifies the chosen World ID proof and wallet binding, then records eligibility on Sepolia. These methods have different uniqueness guarantees." },
  { title: "3. The card gets a signed quote", text: "The demo card is an ERC-721 minted to the borrower. The borrower first fetches a mock Realyse-style response for a fixed demo value stored in SQLite. If the stored assumption is less than 24 hours old, the server can sign a ten-minute EIP-712 valuation for that same value. The contract checks the signer, token, currency, age, expiry, and one-use nonce." },
  { title: "4. Origination escrows the card", text: "The borrower approves the NFT and calls LoanManager. It checks World eligibility, NFT ownership, custody state, 35% maximum LTV, and pool liquidity. A separate loan vault receives the NFT; the pool sends MockUSDC to the borrower." },
  { title: "5. Repay or resolve default", text: "Repayment transfers principal and interest from the payer, returns capital to the pool, and releases the NFT to the borrower. After maturity plus grace, anyone may mark default; the NFT moves into a three-minute auction. Bids settle in MockUSDC and the contract distributes proceeds." },
];
const integrations = [
  {
    name: "Reown AppKit", status: "Live", statusVariant: "secondary" as const,
    job: "Wallet connection and transaction signing",
    detail: "The app opens Reown's wallet connection UI and uses its wagmi adapter for Sepolia account state. The connected wallet signs approvals, transactions, and the World authorization message. The app does not hold a borrower's wallet key. This build has not enabled Reown smart accounts or sponsored transactions.",
    handoff: "Browser wallet → wagmi/viem → Sepolia contracts",
    docs: "https://docs.reown.com/appkit/overview",
  },
  {
    name: "World ID", status: "Configured", statusVariant: "secondary" as const,
    job: "Credential-based borrower eligibility",
    detail: "IDKit 4 offers Orb, NFC passport, My Number Card, and Selfie Check. The server checks the wallet signature, action, environment, credential result, wallet signal, and nullifier with World before registering the wallet on Sepolia. A staging Orb proof passed end to end; the other methods still need live user testing. Selfie Check and document ID are weaker person-uniqueness signals than Orb. No raw identity documents are stored by the app.",
    handoff: "IDKit proof → Next.js verifier → HumanVerificationRegistry",
    docs: "https://docs.world.org/world-id/idkit/integrate",
  },
  {
    name: "ENSv2", status: "Live on Sepolia", statusVariant: "secondary" as const,
    job: "Readable identities and delegated records",
    detail: "The borrower owns cardloanstest.eth. The protocol demo wallet owns altrwalend.eth and its appraiser, pool, and auction subnames. The appraiser subname has a dedicated resolver: the signer wallet can update one disclosure text key, while unrelated text and address writes are denied. The protocol owner retains recovery rights. ENS records do not authorize valuations, NFT transfers, or loans; those checks live in the lending contracts.",
    handoff: "Name → resolver address and records; EAC → record edit permission",
    docs: "https://docs.ens.domains/ensv2/permissioned-resolver/",
  },
  {
    name: "Realyse", status: "Live market context", statusVariant: "secondary" as const,
    job: "Reported card sales and reference price evidence",
    detail: "The card-value step reads Realyse's public Pokémon-card API through a server route when opened and every five minutes while open. It pins the 1999 Base Set Charizard PSA 9 record, checks identity and a matching sale, then shows its price status, sample count, source-market count, and data date. The available record is indicative and based on one sale. A separate Realyse SKU labeled Base Set contains mismatched Celebrations sales, so no Realyse figure is used to sign loans. This is a technical integration, not an endorsement or commercial partnership.",
    handoff: "Realyse public API → Next.js market route → card-value market reference",
    docs: "https://realyse.io/docs",
  },
  {
    name: "Curvegrid MultiBaas", status: "Live API reads", statusVariant: "secondary" as const,
    job: "Searchable contract events for the activity feed",
    detail: "Six Sepolia contracts have ABIs and linked addresses in MultiBaas. The server reads indexed events through its API and writes normalized rows to SQLite. A direct Sepolia RPC reader fills historical gaps; both paths deduplicate by chain ID, transaction hash, and log index. An HMAC-checking webhook endpoint exists, but remote delivery needs a public HTTPS app URL and configured signing secret.",
    handoff: "Sepolia logs → MultiBaas API → Next.js → SQLite activity",
    docs: "https://docs.curvegrid.com/multibaas/api/list-events/",
  },
];
const layers = [
  { icon: BookOpen, name: "Interface", detail: "Next.js App Router renders Borrow, Earn, Auctions, Activity, Identity, and this guide. Tailwind and shadcn-style components provide the neutral interface." },
  { icon: ShieldCheck, name: "Application server", detail: "API routes prepare World proof requests, verify proofs, sign demo valuations, fetch Realyse market context, read MultiBaas events, and accept signed webhooks. Server keys stay outside the browser bundle." },
  { icon: Landmark, name: "Sepolia contracts", detail: "ERC-721 collateral, the ERC-4626 pool, per-loan vaults, loan state, valuation checks, borrower eligibility, and auctions are enforced onchain." },
  { icon: Database, name: "Local database", detail: "SQLite plus Drizzle stores the demo card and valuation inputs, World authorization receipts, indexed events, webhook receipts, and RPC cursors. It is not the source of truth for balances or NFT ownership." },
];
const contractRows = [
  ["MockUSDC", "Valueless six-decimal test token with a public faucet."],
  ["VaultedCardNFT", "ERC-721 demo card; stores certification and simulated custody attestations."],
  ["HumanVerificationRegistry", "Records World-authorized borrower wallets and rejects a reused action nullifier."],
  ["ValuationVerifier", "Checks the EIP-712 appraiser signature, expiry, age, asset, and nonce."],
  ["LendingPool", "ERC-4626 shares, available liquidity, deployed principal, interest, reserve, and realized losses."],
  ["LoanVaultFactory", "Deploys an isolated vault for each originated loan."],
  ["LoanManager", "Enforces eligibility, collateral, LTV, terms, repayments, default, and proceeds distribution."],
  ["LiquidationAuction", "Runs timed MockUSDC bidding, refunds displaced bidders, and settles the NFT."],
] as const;
const facts = [
  ["Collateral example", "$10,000 fixture appraisal"],
  ["Maximum loan", "35% LTV; $3,500 cap"],
  ["Borrower interest", "20% simple APR"],
  ["Term and grace", "90 days + 7 days"],
  ["Quote validity", "10 minutes; recorded assumption must be under 24 hours old"],
  ["Interest allocation", "75% lenders · 15% protocol · 10% reserve"],
  ["Demo auction", "3 minutes; first bid ≥ 50% of principal"],
] as const;
type Faq = { q: string; a: ReactNode };
const faqs: Array<{ category: string; items: Faq[] }> = [
  { category: "Product and collateral", items: [
    { q: "Is this real USDC or a real vaulted Pokémon card?", a: "No. MockUSDC has no monetary value and its faucet is public. The NFT represents a simulated custody receipt for a demo graded card; no physical card was accepted by a custodian." },
    { q: "Is Courtyard, PSA, or Pokémon integrated or endorsing this?", a: "No. The card is a compatibility-style demonstration with fixture metadata. There is no official integration, custody arrangement, or endorsement from those organizations." },
    { q: "Who owns the demo NFT before borrowing?", a: "Token #1 was minted on Sepolia to the configured borrower wallet. The contract checks current ERC-721 ownership again when a loan is opened." },
    { q: "What is the $3,500 shown on Borrow?", a: "It is a preview derived from a $10,000 demo appraisal at 35% maximum LTV. It is not an approved cash offer. Origination still requires a valid signed quote, World eligibility, NFT ownership, and available pool liquidity." },
    { q: "Where does the appraisal come from?", a: "The guided flow fetches a mock Realyse-style response for the $10,000 assumption stored in SQLite. The server signs that same value only while its recorded assumption is less than 24 hours old. The real Realyse market reference is separate and does not change the loan quote." },
    { q: "Does Get estimate call the real Realyse API?", a: "No. The guided borrowing step calls our own demo-price route. It returns the fixed assumed value in SQLite, its original recorded date, and whether it is fresh enough for a signed quote. The separate market reference in the card-value step calls the real public Realyse API and is never used to set this demo loan." },
    { q: "Can I review a loan before World ID verification?", a: "Yes. Anyone can preview the sample card, test estimate, and loan terms before connecting a wallet. The NFT owner can request a signed quote if the stored estimate is fresh. Accepting the loan still requires World ID authorization, NFT approval, and the onchain checks." },
    { q: "How is the Realyse price fetched, and is it real time?", a: "The market reference calls our Next.js market route while the card-value step is open and refreshes every five minutes. That route fetches Realyse’s public card record and checks its card identity and sale evidence. The data date shown is Realyse’s own timestamp; refreshing our page does not make older sales more recent." },
    { q: "Why does the Realyse figure differ from the $10,000 appraisal?", a: "The guided flow uses a seeded $10,000 assumption returned by a mock Realyse endpoint to exercise a $3,500 testnet loan. Realyse currently has an indicative, one-sale record for this card, so its figure is shown as market context only. The app will not silently substitute an unqualified or incorrectly matched market value into a signed loan quote." },
    { q: "Can a quote be replayed or used for another card?", a: "The valuation binds a particular card contract, token ID, currency, verifier, and Sepolia chain. It expires after ten minutes and its nonce can be consumed once. The verifier also rejects valuations older than one day." },
  ] },
  { category: "Wallets, World ID, and ENS", items: [
    { q: "Can I borrow right now?", a: "The contracts, NFT, pool, and World RP are configured. The card owner still needs a valid World ID proof and must pass the onchain loan checks before originating." },
    { q: "Why use World ID if I already connected a wallet?", a: "A wallet proves control of an address. World ID adds a verified credential and action-scoped replay protection. Orb offers the strongest person-uniqueness guarantee; document ID and Selfie Check offer broader access with weaker guarantees." },
    { q: "What World data is stored?", a: "The app records the wallet, action, credential type, authorization transaction, and an action nullifier for replay protection. It does not store a passport, face image, or other raw identity document." },
    { q: "Does Reown hold funds or issue a protocol wallet?", a: "No. Reown AppKit connects a wallet the user chooses. The user's wallet signs transactions. Protocol-issued smart accounts and sponsored transactions are not part of this build." },
    { q: "Why are there two ENS roots?", a: "cardloanstest.eth belongs to the borrower. altrwalend.eth belongs to the protocol demo wallet, so the borrower cannot control protocol operator names. Both are ENSv2 registrations on Sepolia only." },
    { q: "Does ENSv2 permission determine who can borrow or appraise?", a: "No. ENSv2 permissions here control name and resolver record edits. LoanManager checks the HumanVerificationRegistry, ERC-721 ownership, signed valuation, and pool liquidity. ValuationVerifier separately checks its appraiser signer role." },
    { q: "What was actually delegated through ENSv2?", a: "The appraiser signer may edit the com.altrwalend.appraiser.note text key on its dedicated resolver. Attempts to edit an unrelated text key or the address record are denied. The protocol owner retains administrative recovery rights." },
    { q: "Are these .eth names on Ethereum mainnet?", a: "No. They are ENSv2 beta names on Sepolia. The same labels are not reserved on mainnet by these transactions." },
    { q: "Who controls the protocol ENS root?", a: "The testnet protocol deployer wallet owns altrwalend.eth and retains administrative control of its subnames. It is an externally owned demo wallet. A production protocol should move that authority to governed multisig custody." },
  ] },
  { category: "Loans, lenders, and auctions", items: [
    { q: "Why do I approve the NFT before accepting a loan?", a: "ERC-721 approval lets LoanManager transfer that specific card into a new loan vault during origination. The approval alone does not open a loan or move the NFT." },
    { q: "Where do the borrowed tokens come from?", a: "Lenders deposit MockUSDC into LendingPool and receive ccUSDC shares. LoanManager can draw available pool liquidity and send it to the borrower after all origination checks pass." },
    { q: "What is a loan vault? Is it a second user wallet?", a: "A LoanVault is an isolated escrow contract created for one loan and one NFT. It is not a new user login or smart account. It accepts only the expected card from the expected borrower, and only LoanManager can release that collateral." },
    { q: "Can a lender withdraw whenever they want?", a: "Only up to the pool's available MockUSDC liquidity. Principal deployed into active loans cannot be withdrawn until recovered. A default shortfall reduces pool assets and share value." },
    { q: "How does interest accrue?", a: "The contract uses 20% annual simple interest on principal for elapsed seconds, capped at the 90-day term. The demo acceleration control makes the full term due immediately for a Sepolia walkthrough." },
    { q: "What happens when a loan is repaid?", a: "The payer approves and transfers principal plus interest. LoanManager returns principal and the lender interest share to the pool, allocates protocol fee and reserve, and releases the NFT from its vault to the borrower." },
    { q: "When can a card be auctioned?", a: "After the 90-day term and seven-day grace period, anyone can mark an active loan in default. In demo mode the borrower or admin can explicitly accelerate maturity. Only LoanManager can move collateral from its vault to the auction." },
    { q: "What if nobody bids?", a: "When the three-minute auction closes with no bid, the NFT goes to the configured recovery address and the pool records an unresolved principal loss. The pool does not promise lenders full repayment." },
    { q: "What happens to auction proceeds?", a: "The contract applies them to principal, lender interest, protocol fee, then reserve contribution; any surplus returns to the borrower. If proceeds cannot cover principal, the remaining loss stays with the pool." },
  ] },
  { category: "Data, partners, and deployment", items: [
    { q: "Can Realyse prices be used for real collateral loans?", a: "Only after the exact printing, edition, grader, and grade are matched to enough independently checked completed sales, the feed is fresh, rights to use it are confirmed, and a governed risk policy sets haircuts and fallback behavior. This demo does not claim those conditions." },
    { q: "Is SQLite the source of truth for loans and balances?", a: "No. Sepolia contracts determine token ownership, balances, loan status, and settlement. SQLite holds demo inputs and query-friendly copies of confirmed events." },
    { q: "What exactly does Curvegrid do?", a: "MultiBaas indexes emitted events from six linked contracts. The Next.js server reads those events for Activity. Curvegrid does not sign borrower transactions, hold collateral, or decide loan outcomes in this build." },
    { q: "Why is there also a direct RPC event reader?", a: "The current MultiBaas deployment can backfill only a recent block window. The direct Sepolia reader covers earlier demo transactions and serves as a fallback. Both readers use the same event identity to avoid duplicates." },
    { q: "Are Curvegrid webhooks active?", a: "The receiver is implemented, but remote delivery is not configured for localhost. It needs a public HTTPS URL, a Curvegrid webhook subscription, and its signing secret." },
    { q: "Does the Curvegrid API key reach the browser?", a: "No. The API reader and key run on the Next.js server. The page receives normalized activity data rather than the secret." },
    { q: "What if the Next.js server is down?", a: "Existing Sepolia contract state remains onchain. The local UI, new demo valuations, World verification relay, and indexed activity display depend on the server and may be unavailable until it returns." },
    { q: "What has to change before using real assets?", a: "Real custody and provenance, reliable licensed valuations, production token and risk controls, contract review, governed operator keys, persistent infrastructure, completed World configuration, and operational monitoring would all be needed. This version is a testnet demonstration." },
  ] },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-8 space-y-5 border-t border-border pt-10 first:border-t-0 first:pt-0">
    <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p><h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-tight">{title}</h2></div>
    {children}
  </section>;
}

function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-10 items-center gap-1 text-sm font-medium ${anchorClass}`}>{children}<ExternalLink className="size-3.5" aria-hidden="true" /></a>;
}

export default function DocsPage() {
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <PageHeading title="How it works" description="Borrowing, lending, and the details behind each transaction." />
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <aside className="self-start lg:sticky lg:top-6">
        <nav aria-label="Documentation sections" className="rounded-lg border border-border bg-card p-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">{sections.map(([id, label]) => <a className={`${navClass} shrink-0 lg:shrink`} href={`#${id}`} key={id}>{label}</a>)}</div>
        </nav>
      </aside>
      <div className="min-w-0 space-y-10">
        <Section id="overview" eyebrow="The mental model" title="Start here">
          <div className="rounded-lg border border-border bg-secondary/50 p-5 md:p-6">
            <p className="max-w-prose text-base leading-7">Collector Credit is a <strong>Sepolia testnet lending demo</strong>. A simulated vaulted card NFT can secure a MockUSDC loan from a shared lender pool. Smart contracts decide who can borrow, where collateral goes, and how repayment or auction proceeds are distributed.</p>
            <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">World ID is configured. The guided flow can show an assumed price and signed quote, but a borrower must complete World verification and the onchain checks before originating.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="space-y-2 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Network</p><p className="font-semibold">Sepolia only</p><p className="text-sm text-muted-foreground">No mainnet deposits or loans.</p></CardContent></Card>
            <Card><CardContent className="space-y-2 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Money</p><p className="font-semibold">Valueless MockUSDC</p><p className="text-sm text-muted-foreground">Public test faucet; no real USDC.</p></CardContent></Card>
            <Card><CardContent className="space-y-2 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collateral</p><p className="font-semibold">Simulated custody</p><p className="text-sm text-muted-foreground">One demo NFT; no physical card held.</p></CardContent></Card>
          </div>
          <div className="space-y-2"><p className="max-w-prose text-sm leading-6 text-muted-foreground">Open a live page alongside this guide. Each shows a different part of the same Sepolia state.</p><div className="flex flex-wrap gap-2">{[["/borrow", "Borrow"], ["/earn", "Earn"], ["/identity", "Identity"], ["/activity", "Activity"]].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</Link>)}</div></div>
        </Section>

        <Section id="lifecycle" eyebrow="From capital to settlement" title="The loan lifecycle">
          <div className="space-y-3">{steps.map((step) => <div key={step.title} className="rounded-lg border border-border bg-card p-5"><h3 className="font-semibold">{step.title}</h3><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{step.text}</p></div>)}</div>
          <div className="rounded-lg border border-border p-5"><h3 className="text-sm font-semibold">What the demo controls change</h3><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Sepolia LoanManager was deployed with demo mode enabled. The borrower or protocol admin can explicitly accelerate an active loan so a default and short auction fit a live walkthrough. That transaction changes the demo loan’s interest and eligibility state; it is not a production lending feature.</p></div>
        </Section>

        <Section id="partners" eyebrow="Purpose and boundaries" title="How each partner is used">
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">These are technology integrations in the demo. Using a service or its SDK does not imply a formal commercial partnership or endorsement.</p>
          <div className="grid gap-4 xl:grid-cols-2">{integrations.map((partner) => <Card key={partner.name} className="flex flex-col"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{partner.name}</CardTitle><Badge variant={partner.statusVariant}>{partner.status}</Badge></div><p className="text-sm font-medium">{partner.job}</p></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><p className="text-sm leading-6 text-muted-foreground">{partner.detail}</p><div className="mt-auto border-t border-border pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data path</p><p className="mt-1 text-sm">{partner.handoff}</p><OfficialLink href={partner.docs}>Official documentation</OfficialLink></div></CardContent></Card>)}</div>
        </Section>

        <Section id="architecture" eyebrow="What lives where" title="Architecture and data">
          <div className="grid gap-3 sm:grid-cols-2">{layers.map(({ icon: Icon, name, detail }) => <Card key={name}><CardContent className="p-5"><div className="flex items-center gap-2"><Icon className="size-5" aria-hidden="true" /><h3 className="font-semibold">{name}</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p></CardContent></Card>)}</div>
          <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-2xl border-collapse text-left text-sm"><thead className="bg-secondary/50"><tr><th className="px-4 py-3 font-semibold">Tool</th><th className="px-4 py-3 font-semibold">Why it is here</th></tr></thead><tbody>{[
            ["Next.js", "Pages, server rendering, and API routes for verification, valuations, and activity."],
            ["shadcn-style UI + Tailwind", "Accessible reusable controls and a consistent neutral theme."],
            ["Reown + wagmi + viem", "Connect user wallets, read Sepolia, and request wallet signatures and transactions."],
            ["SQLite + Drizzle", "Typed schema and local storage for fixtures, authorization receipts, and event projections."],
            ["Hardhat + OpenZeppelin", "Compile, test, and deploy Solidity contracts using standard token and access-control building blocks."],
          ].map(([tool, purpose]) => <tr key={tool} className="border-t border-border align-top"><th scope="row" className="px-4 py-3 font-medium">{tool}</th><td className="px-4 py-3 text-muted-foreground">{purpose}</td></tr>)}</tbody></table></div>
          <div className="rounded-lg border border-border bg-secondary/50 p-5"><h3 className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" aria-hidden="true" />Which system wins when data disagrees?</h3><p className="mt-2 max-w-prose text-sm leading-6">The Sepolia contracts win for NFT ownership, balances, loans, and settlement. SQLite is a projection and fixture store. Curvegrid and the direct RPC reader both observe confirmed logs; the app deduplicates those observations by chain ID, transaction hash, and log index.</p></div>
        </Section>

        <Section id="contracts" eyebrow="Onchain responsibilities" title="The deployed contract map">
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">All eight contracts below are deployed on Sepolia. Select an address to inspect its transactions and verified chain state in Etherscan.</p>
          <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-2xl border-collapse text-left text-sm"><thead className="bg-secondary/50"><tr><th className="px-4 py-3 font-semibold">Contract</th><th className="px-4 py-3 font-semibold">Job</th><th className="px-4 py-3 font-semibold">Explorer</th></tr></thead><tbody>{contractRows.map(([name, job]) => <tr key={name} className="border-t border-border align-top"><th scope="row" className="px-4 py-3 font-medium">{name}</th><td className="px-4 py-3 text-muted-foreground">{job}</td><td className="px-4 py-3"><a href={`https://sepolia.etherscan.io/address/${deployment.contracts[name]}`} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-10 items-center gap-1 ${anchorClass}`}>View address<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></td></tr>)}</tbody></table></div>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">LoanVault is deployed per originated loan by LoanVaultFactory. Each vault accepts its specified NFT from its specified borrower and only LoanManager can release it.</p>
        </Section>

        <Section id="economics" eyebrow="Fixed demo policy" title="Terms, yield, and risk">
          <div className="grid gap-3 sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-medium">{value}</p></div>)}</div>
          <p className="max-w-prose text-sm leading-6">For a $3,500 principal kept for the full 90 days, simple interest is about <strong>$172.60</strong>, making repayment about <strong>$3,672.60</strong>. Repaying earlier accrues less interest. The lender APY shown in the app is an estimate based on utilization, borrower APR, and the lender interest share; it is not a promise of yield.</p>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">Auction proceeds return principal to the pool first, then pay lender interest, protocol fee, and reserve contribution. Any surplus returns to the borrower. A shortfall lowers pool assets and can lower the ccUSDC share price. The test auction opens at half the principal and requires each later bid to exceed the previous one by at least 5%.</p>
        </Section>

        <Section id="status" eyebrow="What works today" title="Current status and next dependencies">
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Running on Sepolia</h3><Badge>Live</Badge></div><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Eight contracts, demo NFT #1, a pool seeded with 5,000 MockUSDC, two ENSv2 roots, three protocol subnames, a scoped appraiser record update, and server-side MultiBaas event reads with RPC history.</p></div>
            <div className="rounded-lg border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">External setup still pending</h3><Badge variant="warning">Pending</Badge></div><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Curvegrid webhook delivery needs a public HTTPS endpoint and signing secret. The local Activity page already reads the MultiBaas API without webhooks. The Realyse market reference is intentionally read-only. A real World App user still needs to exercise production verification.</p></div>
            <div className="rounded-lg border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Beyond this demo</h3><Badge variant="outline">Future work</Badge></div><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">User-controlled smart account onboarding, gas sponsorship, real custody attestations, live licensed valuations, governance of protocol keys, and production infrastructure are not implemented.</p></div>
          </div>
        </Section>

        <Section id="faq" eyebrow="Common questions" title="Frequently asked questions">
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">Open any answer for the precise behavior of this build. Partner documentation links above describe each service itself.</p>
          <div className="space-y-8">{faqs.map((group) => <div key={group.category} className="space-y-3"><h3 className="text-lg font-semibold">{group.category}</h3><div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">{group.items.map((item) => <details key={item.q} className="group"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><span>{item.q}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" /></summary><div className="max-w-prose px-4 pb-4 text-sm leading-6 text-muted-foreground">{item.a}</div></details>)}</div></div>)}</div>
          <div className="rounded-lg border border-border bg-secondary/50 p-5"><h3 className="flex items-center gap-2 font-semibold"><CircleHelp className="size-4" aria-hidden="true" />Still looking for a detail?</h3><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">The live pages show resolved names and confirmed transactions. The project README contains local setup and verification commands.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/identity" className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Identity</Link><Link href="/activity" className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Activity</Link></div></div>
        </Section>
      </div>
    </div>
  </main>;
}
