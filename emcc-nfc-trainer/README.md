# EMCC NFC Trainer

A personal training tool built around the U.S. Army **Enhanced MILES
Casualty Cards** (EMCC, GTA 08-11-015, November 2021) — 49 physical training
cards, each a simulated battlefield casualty with a mechanism of injury,
patient role-play instructions, a triage/evac answer key, and progressive
vital signs across three echelons of care (Front Line Medic/CCP → Role I →
Role II).

This repo adds a digital layer on top of the physical deck: embed a cheap
passive NFC sticker in each card, and a phone scan pulls up exactly what a
real assessment would reveal — never the answer key — plus a timestamped
treatment ledger that follows the casualty up the evacuation chain.

> **The physical cards remain fully usable on their own.** The app is
> strictly additive — if a tag fails or no phone is handy, run the exercise
> exactly as the deck was designed to be run.

> **Source material.** GTA 08-11-015 is marked *DISTRIBUTION A — Approved
> for public release; distribution is unlimited.* This repo is a personal
> training project built on that public U.S. Army training aid; see
> [`data/cards.json`](data/cards.json)'s `_meta` block for extraction notes,
> and [LICENSE](LICENSE) for how the license here applies to the *software*
> versus the underlying card content.

## Two tools, one repo

| | What it does | Docs |
|---|---|---|
| [`nfc-writer/`](nfc-writer) | Writes a card-ID-only payload (`emcc:card:N`) to blank NTAG213/215 stickers — write / verify / batch-write-a-whole-deck modes. | [nfc-writer/README.md](nfc-writer/README.md) |
| [`app/`](app) | The casualty simulation itself: scan → casualty presentation → MARCH treatment checklist → handoff ledger → OC/T admin/grading mode. Works offline once loaded. | [app/README.md](app/README.md) |

Both read the same [`data/cards.json`](data/cards.json) — the writer only
ever puts an ID on a tag, all clinical content is looked up from this file
at scan time, so editing card data never requires touching a single physical
tag.

## How it works, end to end

1. Trainee scans a card with an NFC-capable Android phone (Chrome — Web
   NFC).
2. The app shows the mechanism/location, the patient's observable
   presentation, and current vitals for the echelon(s) reached so far.
   **Never the triage/evac answer.**
3. Trainee logs interventions from a MARCH-grouped checklist (the same full
   list — including wrong options — on every card, so it never hints at the
   right answer). Each tap is timestamped.
4. A per-card rules engine (state machine) branches the casualty between
   tracks — untreated/deteriorating, treated-fast/full recovery,
   treated-late/partial recovery — based on which intervention was logged
   and how quickly.
5. Anyone up the evacuation chain scans the same card and sees the running
   treatment ledger and current state.
6. A hidden OC/T (evaluator) admin mode — long-press the app title, enter a
   PIN — shows the answer key, the card's full state machine, scenario
   controls (start/pause/reset/force-advance echelon), and a grading widget
   for the trainee's triage/evac call.

## Hardware shopping list

| Item | Approx. cost | Notes |
|---|---|---|
| NTAG215 stickers, 25mm, 50-pack | ~$10 | NTAG213 (144 bytes) also works fine — the payload is a few bytes — but NTAG215 gives more headroom if you ever want to write more per tag. |
| Any NFC-capable Android phone | — | Needs Chrome (Web NFC is Chrome-on-Android only; see below). |
| Cold laminating pouches or clear packing tape | — | For re-sealing cards after embedding a tag — see [docs/card-assembly.md](docs/card-assembly.md) for placement and lamination notes (hot lamination can kill an inlay). |

## Setup

No build tooling, no framework, no accounts/server — clone and serve
statically:

```sh
git clone <this repo>
cd emcc-nfc-trainer
python3 -m http.server 8443   # or: npx serve
```

Then, from an NFC-capable Android phone on the same network (over HTTPS or
via a tunnel like `ngrok`/`cloudflared` if not on `localhost`):

- `nfc-writer/index.html` — to write your deck's tags.
- `app/index.html` — the trainer itself. Add it to your home screen
  (`manifest.webmanifest` is set up for it) for a full-screen offline app;
  the service worker caches everything after first load.

Desktop/iOS browsers don't support Web NFC — both tools detect this and fall
back to manual card-number entry so you can still use/test them without NFC
hardware.

## Repo layout

```
emcc-nfc-trainer/
├── README.md               — this file
├── LICENSE                 — MIT (software only — see LICENSE for card-content note)
├── data/
│   └── cards.json          — all 49 cards, extracted from the official EMCC PDF
├── nfc-writer/             — Part 1: tag writing utility
├── app/                    — Part 2: the simulation app
└── docs/
    ├── card-assembly.md    — embedding tags in laminated cards
    └── screenshots.md      — screenshots (placeholder)
```

## Data provenance & the `inferred` flag

The physical card only prints **one** vitals progression per card (POI →
Role I → Role II), occasionally with an inline `(if treated)` qualifier —
it doesn't print separate branching tables for a state machine. To satisfy
the "branches by treatment timing" design, `cards.json` extends each card
with additional states (`deteriorating`, `treated_late`, `dead`, etc.) and
minute-based rule thresholds that **are not printed on the card** — every
such value is marked `"inferred": true` with a `note` explaining the
clinical reasoning, so you can review/adjust anything invented versus what's
literally on the source card. See the `_meta` block at the top of
`cards.json` for the full extraction methodology.
