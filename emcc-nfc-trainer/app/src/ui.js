import { MARCH_CATEGORIES, actionLabel } from "./interventions.js";
import { resolveVitals } from "./state-machine.js";

const VITAL_LABELS = {
  rr: "RR",
  lung_sounds: "Lung Sounds",
  spo2: "SpO2",
  pulse: "Pulse",
  pulse_location: "Pulse Location",
  rate_rhythm: "Rate/Rhythm",
  bp: "B/P",
  cap_refill: "Cap Refill",
  avpu: "AVPU",
  perrl: "PERRL",
  gcs: "GCS",
  temp: "Temp",
};

const ECHELON_LABELS = { poi: "Front Line / CCP", role1: "Role I", role2: "Role II" };

export function toast(msg, ms = 2200) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), ms);
}

export function formatElapsed(ms) {
  if (ms == null || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function vitalValueEl(value) {
  if (value == null) return `<span class="vv unobtainable">unobtainable</span>`;
  return `<span class="vv">${escapeHtml(String(value))}</span>`;
}

export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Renders the casualty tab: patient instructions + current-echelon vitals only (never the answer key). */
export function renderCasualty(card, resolved, echelon) {
  const instrEl = document.getElementById("casualty-instructions");
  instrEl.innerHTML = `
    <h3>Presentation</h3>
    ${(card.patient_instructions || [])
      .map((line) => `<div class="instr-line">${escapeHtml(line)}</div>`)
      .join("")}
  `;

  const vitals = resolveVitals(card, resolved.state);
  const vitalsEl = document.getElementById("casualty-vitals");
  const echelonsToShow = echelonsUpTo(echelon);
  vitalsEl.innerHTML = `
    <h3>Vitals</h3>
    ${echelonsToShow
      .map((ech) => {
        const v = vitals ? vitals[ech] : null;
        if (!v) return "";
        return `
          <div class="vitals-echelon">
            <h4>${ECHELON_LABELS[ech]}</h4>
            <div class="vitals-grid">
              ${Object.entries(VITAL_LABELS)
                .map(([key, label]) => {
                  const val = v[key];
                  if (val === undefined) return "";
                  return `<span class="vk">${label}</span>${vitalValueEl(val)}`;
                })
                .join("")}
            </div>
          </div>
        `;
      })
      .join("")}
  `;
}

function echelonsUpTo(echelon) {
  const order = ["poi", "role1", "role2"];
  const idx = order.indexOf(echelon);
  return order.slice(0, idx + 1);
}

/** Renders the MARCH treatment checklist. loggedActionIds = Set of action ids already logged this session. */
export function renderTreatmentChecklist(loggedActionIds, onAction) {
  const el = document.getElementById("march-checklist");
  el.innerHTML = "";
  for (const cat of MARCH_CATEGORIES) {
    const section = document.createElement("div");
    section.className = "march-cat";
    section.innerHTML = `<h3>${cat.label}</h3>`;
    for (const action of cat.actions) {
      const btn = document.createElement("button");
      btn.className = "action-btn" + (loggedActionIds.has(action.id) ? " logged" : "");
      btn.textContent = loggedActionIds.has(action.id) ? `✓ ${action.label}` : action.label;
      btn.addEventListener("click", () => onAction(action.id));
      section.appendChild(btn);
    }
    el.appendChild(section);
  }
}

export function renderHistory(card, session) {
  const el = document.getElementById("history-list");
  el.innerHTML = "";
  const entries = [...session.ledger].sort((a, b) => a.ts - b.ts);
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "hist-entry";
    const time = new Date(entry.ts).toLocaleTimeString();
    let main = "";
    let sub = "";
    if (entry.type === "scenario_start") {
      main = "Scenario started";
    } else if (entry.type === "intervention") {
      main = actionLabel(entry.action);
      sub = [entry.actorName, entry.actorRole].filter(Boolean).join(" · ") || "Unknown responder";
    } else if (entry.type === "state_change") {
      main = `State → ${entry.toState}`;
      sub = entry.via ? `via ${entry.via}` : "";
    } else if (entry.type === "echelon_advance") {
      main = `Advanced to ${ECHELON_LABELS[entry.toEchelon] || entry.toEchelon}`;
      sub = entry.actorName ? `by ${entry.actorName}` : "";
    } else if (entry.type === "grade") {
      main = `Graded: Triage ${entry.triageCorrect ? "✓" : "✗"}, Evac ${entry.evacCorrect ? "✓" : "✗"}`;
    } else if (entry.type === "admin") {
      main = entry.label || "Admin action";
    }
    li.innerHTML = `<div class="hist-time">${time}</div><div class="hist-main">${escapeHtml(main)}</div>${
      sub ? `<div class="hist-sub">${escapeHtml(sub)}</div>` : ""
    }`;
    el.appendChild(li);
  }
  if (entries.length === 0) {
    el.innerHTML = `<li class="hist-entry">No events yet.</li>`;
  }
}

export function setStatePill(state) {
  const pill = document.getElementById("scenario-state-pill");
  pill.textContent = humanState(state);
  pill.className = "pill " + state;
}

function humanState(state) {
  return state.replace(/_/g, " ").toUpperCase();
}
