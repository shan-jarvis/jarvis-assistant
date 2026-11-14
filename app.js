
const $ = id => document.getElementById(id);
const conversation = $("conversation");
const dialog = $("settings");

let listening = false;
let previousInteractionId = null;
let activeModel = null;

const saved = JSON.parse(localStorage.getItem("jarvisSettings") || "{}");

$("nameField").value = saved.name || "";
$("titleField").value = saved.title || "sir";
$("keyField").value = saved.key || "";
$("modelField").value = saved.model === "gemini-2.5-flash"
  ? "gemini-3.8-flash"
  : (saved.model || "gemini-3.8-flash");
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
    model: $("modelField").value.trim() || "gemini-3.8-flash",
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
}

function say(text) {
  const s = settings();

  if (s.speak === false || !("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.94;
  utterance.pitch = 0.88;

  const voices = speechSynthesis.getVoices();
  const british = voices.find(v => /en-GB/i.test(v.lang));

  if (british) utterance.voice = british;

  speechSynthesis.speak(utterance);
}

async function ask(text) {
  const s = settings();

  if (!s.key) {
    addMessage("assistant", "I need your Gemini API key first. Open Settings and add it.");
    return;
  }

  const model = s.model || "gemini-3.8-flash";

  if (activeModel && activeModel !== model) {
    previousInteractionId = null;
  }

  activeModel = model;

  addMessage("user", text);
  setStatus("PROCESSING", "Consulting Gemini...");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const system = `You are J.A.R.V.I.S., a polished, helpful personal AI assistant inspired by a fictional high-tech butler. Address the user as ${s.title || "sir"}. Their name is ${s.name || "not specified"}. Be warm, composed, concise, intelligent, and honest. You are running on an Android phone and must never claim to perform actions you cannot actually perform.`;

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
    let message = err.name === "AbortError"
      ? "Gemini took too long to respond. Please try again."
      : err.message;

    addMessage("assistant", "I couldn't reach Gemini: " + message);
    setStatus("CONNECTION ISSUE", "Check your API key and internet connection.");

  } finally {
    clearTimeout(timeout);
  }
}

$("chatForm").addEventListener("submit", e => {
  e.preventDefault();

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text) return;

  input.value = "";
  ask(text);
});

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const rec = new SpeechRecognition();

  rec.lang = "en-PH";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    listening = true;
    document.body.classList.add("listening");
    setStatus("LISTENING", "I'm listening, " + (settings().title || "sir") + ".");
  };

  rec.onresult = e => {
    const spokenText = e.results[0][0].transcript;
    ask(spokenText);
  };

  rec.onerror = e => {
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
      setStatus("SYSTEM READY", "Tap the reactor and speak, or type a message.");
    }
  };

  $("micBtn").onclick = () => {
    if (listening) {
      rec.stop();
    } else {
      try {
        rec.start();
      } catch (e) {
        setStatus("MICROPHONE ISSUE", "Please try again.");
      }
    }
  };

} else {
  $("micBtn").onclick = () => {
    setStatus("VOICE INPUT UNAVAILABLE", "Try opening this app in Chrome on Android.");
  };
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
