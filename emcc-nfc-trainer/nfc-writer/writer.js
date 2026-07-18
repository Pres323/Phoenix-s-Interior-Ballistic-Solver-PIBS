const state = {
  cards: new Map(), // id -> card (may be empty if data failed to load; UI falls back to bare numbers)
  batch: {
    queue: [],
    index: 0,
    statuses: [], // 'pending' | 'done' | 'skipped'
    controller: null,
    running: false,
  },
};

const supported = "NDEFReader" in window;

function payloadFor(cardId) {
  return `emcc:card:${cardId}`;
}

function cardLabel(id) {
  const c = state.cards.get(id);
  return c ? `#${id} — ${c.moi} / ${c.location}` : `#${id}`;
}

async function loadCards() {
  try {
    const res = await fetch("../data/cards.json", { cache: "no-cache" });
    const json = await res.json();
    for (const c of json.cards) state.cards.set(c.id, c);
  } catch (err) {
    console.warn("Could not load data/cards.json — falling back to bare card numbers.", err);
  }
}

function showSupportBanner() {
  const banner = document.getElementById("support-banner");
  if (!supported) {
    banner.hidden = false;
    banner.classList.add("error");
    banner.textContent =
      "Web NFC isn't available in this browser (needs Chrome on Android, served over HTTPS or localhost). You can still pick a card and copy its payload string to write with another NFC app — see the Manual fallback box below. Verify/Batch modes need Web NFC and are disabled.";
    document.getElementById("write-btn").disabled = true;
    document.getElementById("verify-btn").disabled = true;
    document.getElementById("batch-write-btn").disabled = true;
  } else if (!window.isSecureContext) {
    banner.hidden = false;
    banner.classList.add("error");
    banner.textContent = "Web NFC requires HTTPS (or localhost). Serve this page over a secure origin to write tags.";
    document.getElementById("write-btn").disabled = true;
    document.getElementById("verify-btn").disabled = true;
    document.getElementById("batch-write-btn").disabled = true;
  }
}

function populateWriteSelect() {
  const sel = document.getElementById("write-card-select");
  sel.innerHTML = "";
  for (let id = 1; id <= 49; id++) {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = cardLabel(id);
    sel.appendChild(opt);
  }
  sel.addEventListener("change", updateWritePayload);
  updateWritePayload();
}

function updateWritePayload() {
  const id = document.getElementById("write-card-select").value;
  document.getElementById("write-payload").textContent = payloadFor(id);
}

function setStatus(elId, text, kind) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = "status-text" + (kind ? ` ${kind}` : "");
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.toggle("active", p.id === `panel-${btn.dataset.tab}`));
      if (btn.dataset.tab !== "batch") stopBatch();
    });
  });
}

function wireCopy() {
  document.getElementById("write-copy").addEventListener("click", async () => {
    const text = document.getElementById("write-payload").textContent;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("write-status", "Payload copied to clipboard.", "ok");
    } catch {
      setStatus("write-status", "Couldn't copy — select and copy the text manually.", "err");
    }
  });
}

function wireWrite() {
  document.getElementById("write-btn").addEventListener("click", async () => {
    if (!supported) return;
    const id = document.getElementById("write-card-select").value;
    setStatus("write-status", "Hold phone near blank tag…");
    try {
      const writer = new NDEFReader();
      await writer.write({ records: [{ recordType: "text", data: payloadFor(id) }] });
      setStatus("write-status", `Wrote card #${id} to tag.`, "ok");
    } catch (err) {
      setStatus("write-status", `Write failed: ${err.message}`, "err");
    }
  });
}

function wireVerify() {
  document.getElementById("verify-btn").addEventListener("click", async () => {
    if (!supported) return;
    setStatus("verify-status", "Hold phone near tag to verify…");
    document.getElementById("verify-result").hidden = true;
    try {
      const reader = new NDEFReader();
      const controller = new AbortController();
      await reader.scan({ signal: controller.signal });
      reader.onreading = (event) => {
        controller.abort();
        const decoder = new TextDecoder();
        let cardId = null;
        for (const record of event.message.records) {
          const text = decoder.decode(record.data);
          const match = text.match(/emcc:card:(\d+)/);
          if (match) cardId = parseInt(match[1], 10);
        }
        if (cardId == null) {
          setStatus("verify-status", "Tag read, but it isn't an EMCC card tag.", "err");
          return;
        }
        setStatus("verify-status", "Tag read.", "ok");
        renderVerifyResult(cardId);
      };
      reader.onreadingerror = () => setStatus("verify-status", "Failed to read tag — try again.", "err");
    } catch (err) {
      setStatus("verify-status", `Scan failed: ${err.message}`, "err");
    }
  });
}

function renderVerifyResult(cardId) {
  const card = state.cards.get(cardId);
  const el = document.getElementById("verify-result");
  el.hidden = false;
  el.innerHTML = card
    ? `
      <h3>Tag maps to</h3>
      <div class="verify-result"><span class="vv">#${card.id} — ${card.moi} / ${card.location}</span></div>
      <div class="verify-result"><span class="vk">Diagnosis:</span> ${card.diagnosis}</div>
      <div class="verify-result"><span class="vk">Triage / Evac:</span> ${card.triage_answer} / ${card.evac_answer}</div>
    `
    : `<h3>Tag maps to</h3><div class="verify-result"><span class="vv">#${cardId}</span> (card data not loaded — check data/cards.json)</div>`;
}

function renderBatchProgress() {
  const el = document.getElementById("batch-progress");
  el.innerHTML = "";
  state.batch.queue.forEach((id, i) => {
    const chip = document.createElement("div");
    const status = state.batch.statuses[i];
    chip.className =
      "batch-chip" +
      (status === "done" ? " done" : status === "skipped" ? " skipped" : i === state.batch.index ? " current" : "");
    chip.textContent = String(id);
    el.appendChild(chip);
  });
  document.getElementById("batch-current-id").textContent =
    state.batch.index < state.batch.queue.length ? state.batch.queue[state.batch.index] : "—";
}

function resetBatch() {
  state.batch.queue = Array.from({ length: 49 }, (_, i) => i + 1);
  state.batch.index = 0;
  state.batch.statuses = state.batch.queue.map(() => "pending");
  renderBatchProgress();
  setStatus("batch-status", "", null);
}

function stopBatch() {
  if (state.batch.controller) state.batch.controller.abort();
  state.batch.running = false;
}

async function runBatch() {
  if (!supported || state.batch.running) return;
  state.batch.running = true;
  while (state.batch.index < state.batch.queue.length && state.batch.running) {
    renderBatchProgress();
    const id = state.batch.queue[state.batch.index];
    setStatus("batch-status", `Hold phone near blank tag for card #${id}…`);
    const controller = new AbortController();
    state.batch.controller = controller;
    try {
      const writer = new NDEFReader();
      await writer.write({ records: [{ recordType: "text", data: payloadFor(id) }] }, { signal: controller.signal });
      state.batch.statuses[state.batch.index] = "done";
      setStatus("batch-status", `Wrote card #${id}. Advancing…`, "ok");
      state.batch.index++;
      renderBatchProgress();
    } catch (err) {
      state.batch.running = false;
      setStatus("batch-status", `Stopped: ${err.message}. Tap the button to resume.`, "err");
      break;
    }
  }
  state.batch.running = false;
  if (state.batch.index >= state.batch.queue.length) {
    setStatus("batch-status", "Batch complete — all 49 cards written.", "ok");
  }
}

function wireBatch() {
  resetBatch();
  document.getElementById("batch-write-btn").addEventListener("click", runBatch);
  document.getElementById("batch-skip").addEventListener("click", () => {
    if (state.batch.index < state.batch.queue.length) {
      state.batch.statuses[state.batch.index] = "skipped";
      state.batch.index++;
      renderBatchProgress();
    }
  });
  document.getElementById("batch-restart").addEventListener("click", () => {
    stopBatch();
    resetBatch();
  });
}

async function main() {
  await loadCards();
  showSupportBanner();
  populateWriteSelect();
  wireTabs();
  wireCopy();
  wireWrite();
  wireVerify();
  wireBatch();
}

main();
