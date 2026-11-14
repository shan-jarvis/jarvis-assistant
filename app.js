const $ = id => document.getElementById(id);
const conversation = $("conversation");
const dialog = $("settings");

let listening = false;
let previousInteractionId = null;
let activeModel = null;

const DEFAULT_MODEL = "gemini-3.6-flash";

const saved = JSON.parse(localStorage.getItem("jarvisSettings") || "{}");

$("nameField").value = saved.name || "";
$("titleField").value = saved.title || "sir";
$("keyField").value = saved.key || "";
$("modelField").value = saved.model || DEFAULT_MODEL;
$("speakField").checked = saved.speak !== false;
$("userTitle").textContent = saved.title || "sir";

function settings() {
  return JSON.parse(localStorage.getItem("jarvisSettings") || "{}");
}

$("settingsBtn").onclick = () => dialog.showModal();

$("saveSettings").onclick = e => {
  e.preventDefault();

  const s = {
    name: $("nameField").value.trim(),
    title: $("titleField").value.trim() || "sir",
    key: $("keyField").value.trim(),
    model: $("modelField").value.trim() || DEFAULT_MODEL,
    speak: $("speakField").checked
  };

  localStorage.setItem("jarvisSettings", JSON.stringify(s));
  $("userTitle").textContent = s.title;
  previousInteractionId = null;
  activeModel = null;
  dialog.close();
  say("Settings updated, " + s.title + ".");
};

function addMessage(role, text) {
  const box = document.createElement("div");
  box.className = "message " + role;

  const who = document.createElement("span");
  who.className = "speaker";
  who.textContent = role === "user" ? "YOU" : "JARVIS";

  const p = document.createElement("p");
  p.textContent = text;

  box.append(who, p);
  conversation.append(box);
  conversation.scrollTop = conversation.scrollHeight;
}

function setStatus(status, hint) {
  $("status").textContent = status;
  $("hint").textContent = hint;
}// JARVIS VOICE
function say(text) {
  const s = settings();

  if (s.speak === false || !("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 0.72;
  utterance.volume = 1;

  const voices = speechSynthesis.getVoices();

  const maleVoice = voices.find(v =>
    /^en/i.test(v.lang) &&
    /male|david|daniel|james|george|mark|guy|ryan|aaron|fred/i.test(v.name)
  );

  const englishVoice = voices.find(v => /^en/i.test(v.lang));

  if (maleVoice) {
    utterance.voice = maleVoice;
  } else if (englishVoice) {
    utterance.voice = englishVoice;
  }

  speechSynthesis.speak(utterance);
}

// GEMINI CONNECTION
async function ask(text) {
  const s = settings();

  if (!s.key) {
    addMessage("assistant", "I need your Gemini API key first. Open Settings and add it.");
    return;
  }

  const model = s.model || DEFAULT_MODEL;

  if (activeModel && activeModel !== model) {
    previousInteractionId = null;
  }

  activeModel = model;

  addMessage("user", text);
  setStatus("PROCESSING", "Consulting Gemini...");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const system = `You are J.A.R.V.I.S., a polished, intelligent personal AI assistant. Address the user as ${s.title || "sir"}. Their name is ${s.name || "not specified"}. Be warm, composed, concise, helpful, and honest. You run on an Android phone and must never claim to perform actions you cannot actually perform.`;

    const body = {
      model: model,
      input: text,
      system_instruction: system,
      generation_config: {
        temperature: 0.7,
        max_output_tokens: 700,
        thinking_level: "low"
      }
    };

    if (previousInteractionId) {
      body.previous_interaction_id = previousInteractionId;
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": s.key
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    previousInteractionId = data.id || previousInteractionId;

    let answer = "";

    if (Array.isArray(data.steps)) {
      answer = data.steps
        .filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .filter(item => item.type === "text")
        .map(item => item.text || "")
        .join("")
        .trim();
    }

    if (!answer && Array.isArray(data.outputs)) {
      answer = data.outputs
        .filter(item => item.type === "text")
        .map(item => item.text || "")
        .join("")
        .trim();
    }

    if (!answer) {
      throw new Error("Gemini returned no text. Please try again.");
    }

    addMessage("assistant", answer);
    say(answer);

    setStatus("SYSTEM READY", "Tap the reactor and speak, or type a message.");

  } catch (err) {
    const message = err.name === "AbortError"
      ? "Gemini took too long to respond. Please try again."
      : err.message;

    addMessage("assistant", "I couldn't reach Gemini: " + message);
    setStatus("CONNECTION ISSUE", "Check your API key and internet connection.");

  } finally {
    clearTimeout(timeout);
  }
}// TEXT CHAT
$("chatForm").addEventListener("submit", e => {
  e.preventDefault();

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text) return;

  input.value = "";
  ask(text);
});

// VOICE RECOGNITION
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const rec = new SpeechRecognition();

  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onstart = () => {
    listening = true;
    document.body.classList.add("listening");

    setStatus(
      "LISTENING",
      "I'm listening, " + (settings().title || "sir") + "."
    );
  };

  rec.onresult = e => {
    const spokenText = e.results[0][0].transcript;

    if (spokenText.trim()) {
      ask(spokenText);
    }
  };

  rec.onerror = e => {
    listening = false;
    document.body.classList.remove("listening");

    setStatus(
      "MICROPHONE ISSUE",
      e.error === "not-allowed"
        ? "Allow microphone access in Chrome."
        : "Please try speaking again."
    );
  };

  rec.onend = () => {
    listening = false;
    document.body.classList.remove("listening");

    if ($("status").textContent === "LISTENING") {
      setStatus(
        "SYSTEM READY",
        "Tap the reactor and speak, or type a message."
      );
    }
  };

  $("micBtn").onclick = () => {
    if (listening) {
      rec.stop();
    } else {
      try {
        rec.start();
      } catch (err) {
        setStatus("MICROPHONE ISSUE", "Please try again.");
      }
    }
  };

} else {
  $("micBtn").onclick = () => {
    setStatus(
      "VOICE INPUT UNAVAILABLE",
      "Try opening this app in Chrome on Android."
    );
  };
}// SERVICE WORKER
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// LOAD AVAILABLE VOICES
if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => {
    speechSynthesis.getVoices();
  };

  speechSynthesis.getVoices();
}
