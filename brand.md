# Collector Credit — brand direction

A friendly card binder for a collectible backed test loan. The interface should feel tactile and familiar: cream paper, warm mats around the cards, ink colored text, and a single cobalt accent for actions and selected states. Keep sale and loan figures easy to scan.

## Type

- **Fraunces** for page titles, card names, and major values. Its rounded serifs give the collection some personality.
- **IBM Plex Sans** for navigation, controls, terms, and body copy.
- System monospace, sparingly, for PSA references, demo receipt numbers, and small collection counts.

Both primary faces are loaded through `next/font` with `display: swap`.

## Color roles

CSS custom properties in `src/app/globals.css` are the source of truth. `--background` is warm cream; `--card` is near white; `--secondary` is the card mat; `--foreground` is navy ink; `--primary` is cobalt; `--border` is a soft warm line. Dark mode uses the same ink and cobalt relationship at suitable contrast.

## Components and copy

Keep surfaces flat with visible borders. Show one primary action per view and let collectible artwork carry the personality. Use direct, consumer language: “Pick your card,” “See loan offer,” and “Manage your loan.” Show PSA reference numbers as comparable sale evidence, separate from the demo receipt attached to the simulated NFT.
