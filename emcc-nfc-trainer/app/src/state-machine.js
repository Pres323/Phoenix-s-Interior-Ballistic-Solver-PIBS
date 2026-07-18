// Resolves a card's current state by replaying its ledger against its
// rules array, including time-only transitions (no_action_by_min) that
// fire even if the trainee does nothing at all.

function ruleAppliesToAction(rule, action, currentState, elapsedMin) {
  if (rule.action !== action) return false;
  if (rule.state && rule.state !== currentState) return false;
  if (rule.within_min !== undefined && elapsedMin > rule.within_min) return false;
  if (rule.after_min !== undefined && elapsedMin <= rule.after_min) return false;
  return true;
}

function nextTimerEvent(card, currentState, stateEnteredAt, scenarioStartAt) {
  let best = null;
  for (const rule of card.rules || []) {
    if (rule.action) continue; // action-triggered, not a timer
    if (rule.no_action_by_min === undefined) continue;
    if (rule.state && rule.state !== currentState) continue;
    const base = rule.state ? stateEnteredAt : scenarioStartAt;
    const at = base + rule.no_action_by_min * 60000;
    if (!best || at < best.at) best = { at, rule };
  }
  return best;
}

/**
 * @param {object} card - card definition from cards.json
 * @param {Array} ledger - chronological ledger entries for this session
 * @param {number} nowMs - current time (Date.now())
 * @returns {{ state: string, stateEnteredAt: number|null, history: Array, started: boolean }}
 */
export function resolveState(card, ledger, nowMs) {
  const startEntry = ledger.find((e) => e.type === "scenario_start");
  if (!startEntry) {
    return { state: "untreated", stateEnteredAt: null, history: [], started: false };
  }

  const scenarioStartAt = startEntry.ts;
  let state = "untreated";
  let stateEnteredAt = scenarioStartAt;
  const history = [{ state, at: scenarioStartAt, via: "scenario_start" }];

  const interventions = ledger
    .filter((e) => e.type === "intervention")
    .sort((a, b) => a.ts - b.ts);

  let ivIdx = 0;
  // Safety cap so a malformed rules array (e.g. a self-loop) can't hang the UI.
  let guard = 0;
  while (guard++ < 500) {
    const timer = nextTimerEvent(card, state, stateEnteredAt, scenarioStartAt);
    const nextIv = interventions[ivIdx];

    const timerAt = timer ? timer.at : Infinity;
    const ivAt = nextIv ? nextIv.ts : Infinity;
    const nextAt = Math.min(timerAt, ivAt);

    if (nextAt === Infinity || nextAt > nowMs) break;

    if (ivAt <= timerAt) {
      const elapsedMin = (nextIv.ts - scenarioStartAt) / 60000;
      const rule = (card.rules || []).find((r) =>
        ruleAppliesToAction(r, nextIv.action, state, elapsedMin)
      );
      if (rule) {
        state = rule.goto;
        stateEnteredAt = nextIv.ts;
        history.push({ state, at: nextIv.ts, via: nextIv.action, ruleNote: rule.note });
      }
      ivIdx++;
    } else {
      state = timer.rule.goto;
      stateEnteredAt = timer.at;
      history.push({ state, at: timer.at, via: "timer", ruleNote: timer.rule.note });
    }
  }

  return { state, stateEnteredAt, history, started: true };
}

/** Resolve a card's vitals object for a given state, following same_as shorthand. */
export function resolveVitals(card, stateName) {
  const stateDef = card.states[stateName];
  if (!stateDef) return null;
  let vitals = stateDef.vitals;

  if (typeof vitals === "string" && vitals.startsWith("same_as:")) {
    const ref = vitals.slice("same_as:".length);
    const [refState, refEchelon] = ref.split(".");
    const refVitals = resolveVitals(card, refState);
    return refEchelon ? refVitals[refEchelon] : refVitals;
  }

  const resolved = {};
  for (const echelon of ["poi", "role1", "role2"]) {
    const v = vitals[echelon];
    if (typeof v === "string" && v.startsWith("same_as:")) {
      const ref = v.slice("same_as:".length);
      const [refState, refEchelon] = ref.split(".");
      const refVitals = resolveVitals(card, refState);
      resolved[echelon] = refEchelon ? refVitals[refEchelon] : refVitals[echelon];
    } else {
      resolved[echelon] = v;
    }
  }
  return resolved;
}

/** Which echelon (poi/role1/role2) should currently be displayed, based on admin force-advance or default poi. */
export function currentEchelon(session) {
  return session.currentEchelon || "poi";
}
