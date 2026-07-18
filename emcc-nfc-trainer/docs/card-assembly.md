# Card Assembly — Embedding NFC Tags in EMCC Cards

How to build the physical decks so each of the 49 EMCC cards carries a passive
NFC tag mapped to its digital record.

## Parts list (per 49-card deck)

| Item | Qty | Notes |
|---|---|---|
| NTAG213 or NTAG215 stickers, 25mm round or smaller | 49+ | NTAG215 (504 bytes) has more headroom than NTAG213 (144 bytes), but this project only ever writes a short `emcc:card:N` string, so either works. Buy a few spares — some tags DOA. |
| Printed/laminated EMCC cards | 49 | The official deck, or your own reprint of the same content. |
| Cold laminating pouches or clear packing tape | 49 | Hot lamination can damage some NFC inlays — test one tag first, or use cold lamination / peel-and-stick pouches to be safe. |
| Android phone with NFC | 1 | For writing and testing tags. Web NFC (used by both tools in this repo) is Chrome-on-Android only — see root README. |

## Placement

1. NTAG213/215 stickers are thin and flexible but have a small rigid chip
   island at their center — avoid folding or hole-punching through that spot.
2. Stick the tag to the **back** of the card, offset toward one edge (not
   dead-center) so it doesn't sit under a high-friction handling area and
   so you can find it by feel later if the card gets fully re-laminated.
3. Keep tags away from each other by at least ~2cm when cards will be
   stacked/carried in a deck — reader phones can pick up the wrong tag if two
   are stacked directly on top of one another. Alternating tag placement
   (e.g. left edge on odd cards, right edge on even cards) reduces this.
4. If relaminating: cold-laminate or use a peel-and-stick pouch over the tag.
   Test read/write on a laminated sample before doing all 49 — some hot
   laminators run hot enough to detune or kill the inlay antenna.

## Writing tags

Use `/nfc-writer` (see its own README) from an NFC-capable Android phone
running Chrome:

1. Open the writer, pick **Batch mode**.
2. It queues cards 1–49 in order. Tap each blank tag as prompted; it writes
   `emcc:card:N` and auto-advances to the next card number on a successful
   write.
3. Use **Verify mode** afterward to re-scan a handful of finished cards and
   confirm they read back the card number you expect.

Only the card ID goes on the tag — all clinical content lives in
`data/cards.json` inside the app, so a tag write never needs to change even
if you later edit the vitals/state-machine data for that card.

## Physical-first design

The cards must stay fully usable with no phone at all — that's the whole
point of a MILES/EMCC deck. The NFC layer is strictly additive: it saves
someone flipping the card over to read the vitals table, and it gives you an
automatic timestamped treatment ledger. If a tag fails or a phone isn't
handy, run the exercise exactly as the physical deck was designed to be run.
