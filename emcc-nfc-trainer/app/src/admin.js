import * as Ledger from "./ledger.js";
import { resolveState } from "./state-machine.js";
import * as UI from "./ui.js";

let ctx = null; // { getState, onSessionMutated, onExitToScenario, onExitToScan }

export function initAdmin(context) {
  ctx = context;
  wirePinOverlay();
  document.getElementById("admin-close").addEventListener("click", closeAdmin);
}

export function openAdmin() {
  document.getElementById("pin-error").hidden = true;
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-overlay").hidden = false;
  document.getElementById("pin-input").focus();
}

function wirePinOverlay() {
  document.getElementById("pin-cancel").addEventListener("click", () => {
    document.getElementById("pin-overlay").hidden = true;
  });
  document.getElementById("pin-submit").addEventListener("click", submitPin);
  document.getElementById("pin-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitPin();
  });
}

function submitPin() {
  const entered = document.getElementById("pin-input").value;
  const settings = Ledger.getSettings();
  if (entered === settings.pin) {
    document.getElementById("pin-overlay").hidden = true;
    showAdminScreen();
  } else {
    document.getElementById("pin-error").hidden = false;
  }
}

function closeAdmin() {
  const { state } = getStateAndSession();
  if (state.session) ctx.onExitToScenario();
  else ctx.onExitToScan();
}

function getStateAndSession() {
  const state = ctx.getState();
  return { state, session: state.session, card: state.card };
}

function showAdminScreen() {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-admin").classList.add("active");
  renderAdmin();
}

function renderAdmin() {
  const { state, session, card } = getStateAndSession();
  const body = document.getElementById("admin-body");
  body.innerHTML = "";

  if (session && card) {
    body.appendChild(renderAnswerKey(card, session));
    body.appendChild(renderStateMachine(card, session));
    body.appendChild(renderControls(card, session));
    body.appendChild(renderGrading(card, session));
  } else {
    const notice = document.createElement("div");
    notice.className = "admin-section";
    notice.innerHTML = `<h3>No active scenario</h3><p>Scan or load a card first to see its answer key, controls, and grading.</p>`;
    body.appendChild(notice);
  }

  body.appendChild(renderDataManagement());
  body.appendChild(renderPinChange());
}

function renderAnswerKey(card, session) {
  const el = document.createElement("div");
  el.className = "admin-section";

  const loggedActions = new Set(
    session.ledger.filter((e) => e.type === "intervention").map((e) => e.action)
  );
  const override = (card.rules || []).find(
    (r) => r.action && loggedActions.has(r.action) && (r.evac_override || r.triage_override)
  );

  const triageLine = override?.triage_override
    ? `<div class="answer-key">Triage: <s style="color:var(--fg-dim);">${card.triage_answer}</s> → ${override.triage_override}</div>`
    : `<div class="answer-key">Triage: ${card.triage_answer}</div>`;
  const evacLine = override?.evac_override
    ? `<div class="answer-key">Evac: <s style="color:var(--fg-dim);">${card.evac_answer}</s> → ${override.evac_override}</div>`
    : `<div class="answer-key">Evac: ${card.evac_answer}</div>`;

  el.innerHTML = `
    <h3>Answer Key — Card #${card.id}</h3>
    ${triageLine}
    ${evacLine}
    ${override ? `<p style="color:var(--accent);font-size:0.85rem;">${escapeHtml(override.note || "")}</p>` : ""}
    <p>${escapeHtml(card.diagnosis)}</p>
  `;
  return el;
}

function renderStateMachine(card, session) {
  const resolved = resolveState(card, session.ledger, Date.now());
  const el = document.createElement("div");
  el.className = "admin-section";
  const statesHtml = Object.entries(card.states)
    .map(([name, def]) => {
      const isCurrent = name === resolved.state;
      return `<div style="margin-bottom:8px;${isCurrent ? "color:var(--accent);font-weight:800;" : ""}">
        ${isCurrent ? "▶ " : ""}${name}${def.inferred ? " (inferred)" : ""}
        ${def.note ? `<div style="color:var(--fg-dim);font-size:0.8rem;font-weight:400;">${escapeHtml(def.note)}</div>` : ""}
      </div>`;
    })
    .join("");
  const rulesHtml = (card.rules || [])
    .map(
      (r) =>
        `<div style="font-size:0.8rem;color:var(--fg-dim);margin-bottom:4px;">${escapeHtml(JSON.stringify(r))}</div>`
    )
    .join("");
  el.innerHTML = `
    <h3>State Machine (current: ${resolved.state})</h3>
    ${statesHtml}
    <h3 style="margin-top:12px;">Rules</h3>
    ${rulesHtml}
  `;
  return el;
}

function renderControls(card, session) {
  const el = document.createElement("div");
  el.className = "admin-section";
  el.innerHTML = `<h3>Scenario Controls</h3><div class="admin-controls"></div>`;
  const controls = el.querySelector(".admin-controls");

  const addBtn = (label, onClick, danger = false) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (danger) btn.classList.add("danger");
    btn.addEventListener("click", onClick);
    controls.appendChild(btn);
  };

  if (session.status === "active") {
    addBtn("Pause", () => {
      Ledger.updateSession(session.id, (s) => {
        s.status = "paused";
        s.pausedAt = Date.now();
      });
      Ledger.addLedgerEntry(session.id, { type: "admin", label: "Scenario paused" });
      ctx.onSessionMutated();
    });
  } else if (session.status === "paused") {
    addBtn("Resume", () => {
      Ledger.updateSession(session.id, (s) => {
        const pausedMs = Date.now() - (s.pausedAt || Date.now());
        // Shift scenario_start forward so elapsed time doesn't include the pause.
        const startEntry = s.ledger.find((e) => e.type === "scenario_start");
        if (startEntry) startEntry.ts += pausedMs;
        s.status = "active";
        delete s.pausedAt;
      });
      Ledger.addLedgerEntry(session.id, { type: "admin", label: "Scenario resumed" });
      ctx.onSessionMutated();
    });
  }

  addBtn("Force-advance echelon", () => {
    const order = ["poi", "role1", "role2"];
    const idx = order.indexOf(session.currentEchelon || "poi");
    const next = order[Math.min(idx + 1, order.length - 1)];
    Ledger.updateSession(session.id, (s) => {
      s.currentEchelon = next;
    });
    Ledger.addLedgerEntry(session.id, { type: "echelon_advance", toEchelon: next });
    ctx.onSessionMutated();
  });

  addBtn(
    "Reset scenario",
    () => {
      if (!confirm("Reset this scenario? Ledger history will be cleared.")) return;
      const cardId = session.cardId;
      Ledger.deleteSession(session.id);
      const fresh = Ledger.createSession(cardId);
      const state = ctx.getState();
      state.session = fresh;
      ctx.onSessionMutated();
    },
    true
  );

  addBtn(
    "End scenario",
    () => {
      Ledger.updateSession(session.id, (s) => {
        s.status = "ended";
      });
      Ledger.addLedgerEntry(session.id, { type: "admin", label: "Scenario ended" });
      ctx.onSessionMutated();
    },
    true
  );

  return el;
}

function renderGrading(card, session) {
  const el = document.createElement("div");
  el.className = "admin-section";
  const triageOptions = ["Immediate", "Delayed", "Minimal", "Expectant", "Convenience"];
  const evacOptions = ["Urgent Surgical", "Urgent", "Priority", "Routine", "Convenience"];

  const loggedActions = new Set(
    session.ledger.filter((e) => e.type === "intervention").map((e) => e.action)
  );
  const override = (card.rules || []).find(
    (r) => r.action && loggedActions.has(r.action) && (r.evac_override || r.triage_override)
  );
  const effectiveTriage = override?.triage_override || card.triage_answer;
  const effectiveEvac = override?.evac_override || card.evac_answer;

  el.innerHTML = `
    <h3>Grade Trainee</h3>
    <div class="grade-row">
      <label>Trainee's triage choice</label>
      <select id="grade-triage">
        <option value="">— select —</option>
        ${triageOptions.map((o) => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>
    <div class="grade-row">
      <label>Trainee's evac choice</label>
      <select id="grade-evac">
        <option value="">— select —</option>
        ${evacOptions.map((o) => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>
    <button class="btn primary" id="grade-submit">Record Grade</button>
    <div id="grade-result"></div>
  `;

  const resultEl = el.querySelector("#grade-result");
  if (session.admin && session.admin.graded) {
    resultEl.innerHTML = gradeResultHtml(session.admin);
  }

  el.querySelector("#grade-submit").addEventListener("click", () => {
    const triageChoice = el.querySelector("#grade-triage").value;
    const evacChoice = el.querySelector("#grade-evac").value;
    if (!triageChoice || !evacChoice) {
      UI.toast("Select both triage and evac before grading.");
      return;
    }
    const triageCorrect = triageChoice === effectiveTriage;
    const evacCorrect = evacChoice === effectiveEvac;
    const admin = { graded: true, triageChoice, evacChoice, triageCorrect, evacCorrect };
    Ledger.updateSession(session.id, (s) => {
      s.admin = admin;
    });
    Ledger.addLedgerEntry(session.id, { type: "grade", triageCorrect, evacCorrect, triageChoice, evacChoice });
    resultEl.innerHTML = gradeResultHtml(admin);
    ctx.onSessionMutated();
  });

  return el;
}

function gradeResultHtml(admin) {
  return `
    <div class="grade-result ${admin.triageCorrect ? "correct" : "incorrect"}">
      Triage: ${admin.triageChoice} ${admin.triageCorrect ? "✓ correct" : "✗ incorrect"}
    </div>
    <div class="grade-result ${admin.evacCorrect ? "correct" : "incorrect"}">
      Evac: ${admin.evacChoice} ${admin.evacCorrect ? "✓ correct" : "✗ incorrect"}
    </div>
  `;
}

function renderDataManagement() {
  const el = document.createElement("div");
  el.className = "admin-section";
  el.innerHTML = `
    <h3>Session Data</h3>
    <div class="admin-controls">
      <button id="admin-export">Export JSON</button>
      <button id="admin-import">Import JSON</button>
    </div>
    <input type="file" id="admin-import-file" accept="application/json" hidden />
  `;
  el.querySelector("#admin-export").addEventListener("click", () => {
    const blob = new Blob([Ledger.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emcc-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  el.querySelector("#admin-import").addEventListener("click", () => {
    el.querySelector("#admin-import-file").click();
  });
  el.querySelector("#admin-import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      Ledger.importAll(await file.text());
      UI.toast("Import complete.");
      ctx.onSessionMutated();
    } catch (err) {
      UI.toast(`Import failed: ${err.message}`);
    }
  });
  return el;
}

function renderPinChange() {
  const el = document.createElement("div");
  el.className = "admin-section";
  el.innerHTML = `
    <h3>OC/T PIN</h3>
    <div class="grade-row">
      <label>Change PIN (4+ digits)</label>
      <input id="new-pin" type="password" inputmode="numeric" maxlength="8" style="min-height:44px;border-radius:10px;border:2px solid var(--border);background:var(--bg-raised-2);color:var(--fg);padding:6px 10px;" />
    </div>
    <button class="btn" id="save-pin">Save PIN</button>
  `;
  el.querySelector("#save-pin").addEventListener("click", () => {
    const val = el.querySelector("#new-pin").value;
    if (val.length < 4) {
      UI.toast("PIN must be at least 4 digits.");
      return;
    }
    Ledger.saveSettings({ ...Ledger.getSettings(), pin: val });
    UI.toast("PIN updated.");
    el.querySelector("#new-pin").value = "";
  });
  return el;
}

function escapeHtml(str) {
  return UI.escapeHtml(String(str ?? ""));
}
