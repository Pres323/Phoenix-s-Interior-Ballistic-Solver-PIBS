import { resolveState } from "./state-machine.js";
import * as Ledger from "./ledger.js";
import * as NFC from "./nfc.js";
import * as UI from "./ui.js";
import { initAdmin, openAdmin } from "./admin.js";

const state = {
  cards: null, // Map<id, card>
  session: null,
  card: null,
  activeTab: "casualty",
  stopScan: null,
};

async function loadCards() {
  const res = await fetch("../data/cards.json", { cache: "no-cache" });
  const json = await res.json();
  const map = new Map();
  for (const c of json.cards) map.set(c.id, c);
  return map;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function loadCardById(cardId) {
  const card = state.cards.get(cardId);
  if (!card) {
    UI.toast(`No card #${cardId} in the data set.`);
    return;
  }
  let session = Ledger.findActiveSession(cardId);
  if (!session) session = Ledger.createSession(cardId);
  state.card = card;
  state.session = session;
  enterScenario();
}

function enterScenario() {
  showScreen("screen-scenario");
  document.getElementById("scenario-moi-loc").textContent = state.card.location
    ? `${state.card.moi} — ${state.card.location}`
    : state.card.moi;
  setTab("casualty");
  tick();
  restoreActorFields();
}

function restoreActorFields() {
  const last = JSON.parse(localStorage.getItem("emcc_last_actor") || "{}");
  document.getElementById("actor-name").value = last.name || "";
  document.getElementById("actor-role").value = last.role || "";
}

function saveActorFields() {
  const name = document.getElementById("actor-name").value.trim();
  const role = document.getElementById("actor-role").value.trim();
  localStorage.setItem("emcc_last_actor", JSON.stringify({ name, role }));
  return { name, role };
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
  renderActiveTab();
}

function renderActiveTab() {
  if (!state.card || !state.session) return;
  const resolved = resolveState(state.card, state.session.ledger, Date.now());
  UI.setStatePill(resolved.state);

  if (state.activeTab === "casualty") {
    UI.renderCasualty(state.card, resolved, state.session.currentEchelon || "poi");
  } else if (state.activeTab === "treat") {
    const logged = new Set(
      state.session.ledger.filter((e) => e.type === "intervention").map((e) => e.action)
    );
    UI.renderTreatmentChecklist(logged, handleAction);
  } else if (state.activeTab === "history") {
    UI.renderHistory(state.card, state.session);
  }
}

function handleAction(actionId) {
  if (state.session.status === "ended") {
    UI.toast("Scenario has ended.");
    return;
  }
  const actor = saveActorFields();
  Ledger.addLedgerEntry(state.session.id, {
    type: "intervention",
    action: actionId,
    actorName: actor.name || null,
    actorRole: actor.role || null,
  });
  state.session = Ledger.getSession(state.session.id);
  UI.toast("Logged.");
  renderActiveTab();
}

function tick() {
  if (!state.session || !document.getElementById("screen-scenario").classList.contains("active")) return;
  const start = state.session.ledger.find((e) => e.type === "scenario_start");
  const elapsed = start ? Date.now() - start.ts : 0;
  document.getElementById("scenario-timer").textContent = UI.formatElapsed(elapsed);

  const resolved = resolveState(state.card, state.session.ledger, Date.now());
  UI.setStatePill(resolved.state);
  if (state.activeTab === "casualty") {
    UI.renderCasualty(state.card, resolved, state.session.currentEchelon || "poi");
  }
}

function wireScan() {
  const btn = document.getElementById("scan-btn");
  const statusEl = document.getElementById("scan-status");

  if (!NFC.nfcSupported()) {
    statusEl.textContent = "Web NFC isn't available on this device/browser (needs Chrome on Android). Use manual entry below.";
    btn.disabled = true;
    btn.style.opacity = 0.4;
    return;
  }

  btn.addEventListener("click", () => {
    if (state.stopScan) state.stopScan();
    statusEl.textContent = "Scanning… hold phone near tag.";
    state.stopScan = NFC.startScan(
      (cardId) => {
        statusEl.textContent = `Read card #${cardId}.`;
        loadCardById(cardId);
      },
      (err) => {
        statusEl.textContent = `NFC error: ${err.message}`;
      }
    );
  });
}

function wireManualForm() {
  document.getElementById("manual-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = parseInt(document.getElementById("manual-card-id").value, 10);
    if (val >= 1 && val <= 49) loadCardById(val);
  });
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function wireBack() {
  document.getElementById("back-to-scan").addEventListener("click", () => {
    showScreen("screen-scan");
    renderResumeList();
  });
}

function renderResumeList() {
  const sessions = Ledger.listSessions().filter((s) => s.status !== "ended");
  const wrap = document.getElementById("resume-list-wrap");
  const list = document.getElementById("resume-list");
  if (sessions.length === 0) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  list.innerHTML = "";
  for (const s of sessions.slice(0, 8)) {
    const card = state.cards.get(s.cardId);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const label = card ? (card.location ? `${card.moi} / ${card.location}` : card.moi) : "unknown";
    btn.textContent = `#${s.cardId} — ${label} (${s.status})`;
    btn.addEventListener("click", () => loadCardById(s.cardId));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function wireAdminEntry() {
  const title = document.getElementById("app-title");
  let pressTimer = null;
  const start = () => {
    pressTimer = setTimeout(() => {
      openAdmin();
    }, 800);
  };
  const cancel = () => clearTimeout(pressTimer);
  title.addEventListener("touchstart", start);
  title.addEventListener("touchend", cancel);
  title.addEventListener("touchcancel", cancel);
  title.addEventListener("mousedown", start);
  title.addEventListener("mouseup", cancel);
  title.addEventListener("mouseleave", cancel);
}

async function main() {
  state.cards = await loadCards();
  wireScan();
  wireManualForm();
  wireTabs();
  wireBack();
  wireAdminEntry();
  renderResumeList();

  initAdmin({
    getState: () => state,
    onSessionMutated: () => {
      state.session = Ledger.getSession(state.session.id);
      renderActiveTab();
      renderResumeList();
    },
    onExitToScenario: () => {
      showScreen("screen-scenario");
      renderActiveTab();
    },
    onExitToScan: () => {
      showScreen("screen-scan");
      renderResumeList();
    },
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(() => {
      document.getElementById("offline-badge").hidden = false;
    }).catch(() => {});
  }

  setInterval(tick, 1000);
}

main();
