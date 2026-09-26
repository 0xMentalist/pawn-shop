# Collector Credit — brand direction

A clean, minimal interface for a collectible backed test loan. The public landing page explains the product; the app shows a wallet's own supported cards and loan activity.

## Type

- **IBM Plex Sans** for page titles, card names, values, navigation, controls, and body copy. Larger sizes and tighter tracking carry the hierarchy.
- System monospace, sparingly, for PSA references, demo receipt numbers, and small collection counts.

IBM Plex Sans is loaded through `next/font` with `display: swap`.

## Color roles

CSS custom properties in `src/app/globals.css` are the source of truth. `--background` is a cool near-white; `--card` is white; `--foreground` is deep graphite; `--primary` is dark teal; `--accent` is soft mint; `--border` is a cool gray line. Dark mode keeps the same graphite and teal relationship.

## Components and copy

Keep surfaces flat with visible borders, generous spacing, and one primary action per view. Use direct language: “Go to app,” “Connect your wallet,” “See loan offer,” and “Manage your loan.” Only show the card picker after wallet connection and successful ownership checks. Show PSA reference numbers as comparable sale evidence, separate from the demo receipt attached to the simulated NFT.
