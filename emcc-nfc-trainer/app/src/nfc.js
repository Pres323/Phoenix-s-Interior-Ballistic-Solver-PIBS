// Web NFC scanning. Tags are written by /nfc-writer with a plain text
// record: "emcc:card:<N>". This module only reads.

export function nfcSupported() {
  return "NDEFReader" in window;
}

/**
 * Start a Web NFC scan session. Calls onCard(cardId) for each recognized
 * tag, onError(err) on failure. Returns an abort() function.
 */
export function startScan(onCard, onError) {
  if (!nfcSupported()) {
    onError(new Error("Web NFC is not supported in this browser."));
    return () => {};
  }

  const controller = new AbortController();
  const reader = new NDEFReader();

  reader
    .scan({ signal: controller.signal })
    .then(() => {
      reader.onreading = (event) => {
        try {
          const cardId = decodeEmccPayload(event.message);
          if (cardId != null) onCard(cardId);
          else onError(new Error("Tag read, but it isn't an EMCC card tag."));
        } catch (err) {
          onError(err);
        }
      };
      reader.onreadingerror = () => onError(new Error("Failed to read tag — try again."));
    })
    .catch((err) => onError(err));

  return () => controller.abort();
}

function decodeEmccPayload(message) {
  const decoder = new TextDecoder();
  for (const record of message.records) {
    if (record.recordType === "text" || record.recordType === "url") {
      const text = decoder.decode(record.data);
      const match = text.match(/emcc:card:(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}
