#!/usr/bin/env node
// Sanity-checks data/cards.json: required fields, state/rule referential
// integrity, and that every rule's `action` id actually exists as a
// clickable button in the app's MARCH checklist (otherwise that branch
// could never be triggered from the UI). Run after hand-editing card data:
//   node data/validate.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ALL_ACTION_IDS } from "../app/src/interventions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "cards.json"), "utf8"));
const cards = data.cards;
const catalog = new Set(ALL_ACTION_IDS);

const REQUIRED = [
  "id", "moi", "location", "diagnosis", "litter_ambulatory",
  "triage_answer", "evac_answer", "patient_instructions",
  "admin_template", "states", "rules",
];

let errors = 0;
const err = (msg) => { console.log("ERROR:", msg); errors++; };

const ids = cards.map((c) => c.id).sort((a, b) => a - b);
const expected = Array.from({ length: 49 }, (_, i) => i + 1);
if (JSON.stringify(ids) !== JSON.stringify(expected)) {
  err(`card id set is wrong: ${JSON.stringify(ids)}`);
}

for (const c of cards) {
  for (const key of REQUIRED) {
    if (!(key in c)) err(`card ${c.id}: missing "${key}"`);
  }
  const stateNames = new Set(Object.keys(c.states || {}));
  for (const [name, def] of Object.entries(c.states || {})) {
    if (!("inferred" in def)) err(`card ${c.id} state ${name}: missing "inferred" flag`);
    if (!("vitals" in def)) err(`card ${c.id} state ${name}: missing "vitals"`);
  }
  for (const r of c.rules || []) {
    if (r.action && !catalog.has(r.action)) {
      err(`card ${c.id}: rule action "${r.action}" is not a button in app/src/interventions.js — unreachable from the UI`);
    }
    if (r.goto && !stateNames.has(r.goto)) {
      err(`card ${c.id}: rule goto "${r.goto}" is not one of this card's states (${[...stateNames].join(", ")})`);
    }
    if (r.state && !stateNames.has(r.state)) {
      err(`card ${c.id}: rule state-scope "${r.state}" is not one of this card's states`);
    }
  }
}

console.log(`Checked ${cards.length} cards, ${errors} error(s).`);
process.exit(errors > 0 ? 1 : 0);
