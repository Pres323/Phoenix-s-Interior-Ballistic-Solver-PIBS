# EMCC NFC Writer

A single-page tool for writing blank NTAG213/215 stickers with an EMCC card
ID, so a phone can scan a physical card and load the matching record in the
[simulation app](../app).

## What it writes

Just an ID — a short text payload like `emcc:card:23`. No clinical data ever
touches the tag; all card content (vitals, states, rules) lives in
[`../data/cards.json`](../data/cards.json) and is looked up by ID at scan
time. This means you can freely edit/expand the card data later without
rewriting a single tag.

## Requirements

- **Chrome on Android** — Web NFC is only implemented there today (not
  Chrome desktop, not Safari/iOS, not Firefox). See [caniuse: Web
  NFC](https://caniuse.com/webnfc).
- Served over **HTTPS or `localhost`** — Web NFC refuses to run on plain
  `http://`. If you're hosting this on a phone-reachable dev server, use a
  tunneling tool (e.g. `ngrok`, `cloudflared`) or GitHub Pages.
- NFC turned on in Android settings, and the phone actually has an NFC radio
  (most modern Android phones do).

If any of that isn't true, the page shows a banner and falls back to a
manual mode: pick the card from the dropdown, and copy the exact payload
string it should carry — you can then write that string to the tag with any
other NFC-writing app (e.g. "NFC Tools" on the Play Store).

## Modes

- **Write** — pick a card number from the dropdown (populated from
  `cards.json`), tap **TAP TAG TO WRITE**, hold a blank tag to the phone.
- **Verify** — tap **TAP TAG TO VERIFY**, hold a written tag to the phone; it
  reads the tag back and shows which card it's mapped to (ID, MOI/location,
  diagnosis, triage/evac) so you can confirm the deck is assembled
  correctly.
- **Batch** — queues cards 1–49 in order. Tap the button once to start; each
  successful write auto-advances to the next card number, so you can work
  through a whole deck by just tapping tags in sequence. **Skip card**
  advances without writing (e.g. a card you're re-doing later); **Restart
  batch** resets the queue back to card 1.

## Running it

No build step — open `index.html` directly, or serve the `emcc-nfc-trainer/`
folder with any static file server (needed for `fetch("../data/cards.json")`
to work, and for HTTPS if you're not on `localhost`):

```sh
cd emcc-nfc-trainer
python3 -m http.server 8443
# or: npx serve
```

Then open `nfc-writer/index.html` from your Android phone's Chrome browser.
