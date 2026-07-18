// All persistence: localStorage sessions keyed by sessionId, plus
// export/import of the full log as JSON.

const SESSIONS_KEY = "emcc_sessions_v1";
const SETTINGS_KEY = "emcc_settings_v1";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSettings() {
  try {
    return { pin: "1111", ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { pin: "1111" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function makeSessionId(cardId) {
  return `${cardId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Find the most recent non-ended session for a given card id, if any. */
export function findActiveSession(cardId) {
  const sessions = readAll();
  const matches = Object.values(sessions)
    .filter((s) => s.cardId === cardId && s.status !== "ended")
    .sort((a, b) => b.createdAt - a.createdAt);
  return matches[0] || null;
}

export function getSession(sessionId) {
  return readAll()[sessionId] || null;
}

export function listSessions() {
  return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
}

export function createSession(cardId) {
  const sessions = readAll();
  const id = makeSessionId(cardId);
  const now = Date.now();
  const session = {
    id,
    cardId,
    createdAt: now,
    status: "active", // active | paused | ended
    currentEchelon: "poi",
    ledger: [
      { type: "scenario_start", ts: now, actorName: null, actorRole: null },
    ],
    admin: {
      graded: false,
      triageChoice: null,
      evacChoice: null,
      triageCorrect: null,
      evacCorrect: null,
    },
  };
  sessions[id] = session;
  writeAll(sessions);
  return session;
}

export function updateSession(sessionId, updater) {
  const sessions = readAll();
  const session = sessions[sessionId];
  if (!session) return null;
  updater(session);
  sessions[sessionId] = session;
  writeAll(sessions);
  return session;
}

export function addLedgerEntry(sessionId, entry) {
  return updateSession(sessionId, (session) => {
    session.ledger.push({ ts: Date.now(), ...entry });
  });
}

export function deleteSession(sessionId) {
  const sessions = readAll();
  delete sessions[sessionId];
  writeAll(sessions);
}

export function exportAll() {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), sessions: readAll(), settings: getSettings() },
    null,
    2
  );
}

export function importAll(jsonText, { merge = true } = {}) {
  const data = JSON.parse(jsonText);
  if (!data.sessions) throw new Error("Invalid export file: missing sessions");
  const sessions = merge ? { ...readAll(), ...data.sessions } : data.sessions;
  writeAll(sessions);
  if (data.settings) saveSettings(data.settings);
}
