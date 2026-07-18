# EMCC Trainer App

The casualty-simulation web app. Mobile-first, dark/high-contrast, big touch
targets, works fully offline once loaded. No build step, no accounts, no
server — everything lives in the browser (`localStorage`) on the device that
runs it.

## Screens

- **Scan (home)** — big "TAP CARD" button (Web NFC) plus a manual card-number
  entry field for iOS/desktop. Lists any scenarios still in progress so you
  can resume one without re-scanning.
- **Casualty** — mechanism + location, the patient's role-play presentation
  (rewritten from the card as observable signs), current vitals for the
  echelon(s) reached so far, and a live elapsed-time counter. **Never shows
  the triage/evac answer key** — that's answer-key data and only appears in
  OC/T admin mode.
- **Treat** — a MARCH-grouped intervention checklist (Massive hemorrhage,
  Airway, Respiration, Circulation, Hypothermia/Head). The same full list
  shows on every card, wrong options included on purpose, so the checklist
  itself never hints at the right answer. Tapping an action timestamps it
  under the name/role you've entered and feeds the rules engine.
- **History** — the full chronological ledger for this card's current
  scenario: start time, every intervention (who + when), echelon
  advances, and state changes. This is what the next echelon sees when they
  scan the same card.
- **OC/T admin** — hidden behind a **long-press on "EMCC TRAINER"** in the
  header, then a 4-digit PIN (default `1111`, changeable from inside the
  panel itself). Shows the answer key, the full state machine + rules for
  the loaded card, scenario controls (pause/resume/reset/force-advance
  echelon/end), a grading widget (record the trainee's triage/evac choice,
  auto-checked against the answer key), plus data export/import.

## How the state machine works

Each card in `../data/cards.json` defines a set of `states` (e.g.
`untreated`, `treated_fast`, `treated_late`, `deteriorating`, `dead`) each
with its own poi/role1/role2 vitals, and a `rules` array of transitions keyed
on either a logged intervention (`action`, with `within_min`/`after_min`
timing) or pure elapsed time (`no_action_by_min`, so a casualty can
deteriorate even if the trainee does nothing at all).

`src/state-machine.js` replays a session's ledger against the card's rules
every time the UI needs the current state — it's a pure function of
`(card, ledger, now)`, so there's no separate "current state" field to drift
out of sync; pausing a scenario (OC/T control) shifts the recorded start
time forward by the paused duration so elapsed-time rules stay accurate.

## Persistence & data portability

All sessions live in `localStorage` under one key, one entry per scenario
run (keyed by card id + start time), so the same physical card can be reused
across multiple trainees/exercises without collision. Use **Export JSON** /
**Import JSON** in OC/T admin to save a completed exercise's full log or move
history between phones — the export includes every session and your PIN
setting.

## Running it

No build step:

```sh
cd emcc-nfc-trainer
python3 -m http.server 8443
# or: npx serve
```

Open `app/index.html`. For NFC scanning you need Chrome on Android over
HTTPS or `localhost` (see the [NFC writer README](../nfc-writer/README.md)
for the same requirement, and how to fall back to manual entry otherwise).
The service worker (`sw.js`) caches the app shell + `cards.json` on first
load so it keeps working with zero signal after that.
