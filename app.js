const $ = id => document.getElementById(id);
const conversation = $("conversation");
const dialog = $("settings");
let history = [];
let listening = false;

const saved = JSON.parse(localStorage.getItem("jarvisSettings") || "{}");
$("nameField").value = saved.name || "";
$("titleField").value = saved.title || "sir";
$("keyField").value = saved.key || "";
$("modelField").value = saved.model || "gemini-2.5-flash";
$("speakField").checked = saved.speak !== false;
$("userTitle").textContent = saved.title || "sir";

$("settingsBtn").onclick = () => dialog.showModal();
$("saveSettings").onclick = e => {
  e.preventDefault();
  const s = {name:$("nameField").value.trim(),title:$("titleField").value.trim() || "sir",
    key:$("keyField").value.trim(),model:$("modelField").value.trim() || "gemini-2.5-flash",
    speak:$("speakField").checked};
  localStorage.setItem("jarvisSettings", JSON.stringify(s));
  $("userTitle").textContent = s.title;
  dialog.close();
  say("Settings updated, " + s.title + ".");
};
function settings(){return JSON.parse(localStorage.getItem("jarvisSettings") || "{}");}
function addMessage(role, text){
  const box=document.createElement("div"); box.className="message "+role;
  const who=document.createElement("span"); who.className="speaker"; who.textContent=role==="user"?"YOU":"JARVIS";
  const p=document.createElement("p"); p.textContent=text;
  box.append(who,p); conversation.append(box); conversation.scrollTop=conversation.scrollHeight;
}
function setStatus(s,h){$("status").textContent=s;$("hint").textContent=h;}
function say(text){
  const s=settings(); if(s.speak===false || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.rate=.94; u.pitch=.88;
  const voices=speechSynthesis.getVoices();
  const british=voices.find(v=>/en-GB/i.test(v.lang));
  if(british)u.voice=british;
  speechSynthesis.speak(u);
}
async function ask(text){
  const s=settings();
  if(!s.key){addMessage("assistant","I need your Gemini API key first. Open Settings and add it. You can create a free key in Google AI Studio.");return;}
  addMessage("user",text); history.push({role:"user",parts:[{text}]});
  setStatus("PROCESSING","Consulting Gemini…");
  try{
    const system=`You are J.A.R.V.I.S., a polished, helpful personal AI assistant inspired by a fictional high-tech butler. Address the user as ${s.title||"sir"}. Their name is ${s.name||"not specified"}. Be warm, composed, concise, intelligent, and honest. You are running on an Android phone and must never claim to perform actions you cannot actually perform.`;
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model||"gemini-2.5-flash")}:generateContent`,{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":s.key},
      body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:history,generationConfig:{temperature:.75,maxOutputTokens:700}})
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.error?.message||`HTTP ${response.status}`);
    const answer=data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim()||"I received an empty response.";
    history.push({role:"model",parts:[{text:answer}]}); addMessage("assistant",answer); say(answer);
    if(history.length>20)history=history.slice(-20);
    setStatus("SYSTEM READY","Tap the reactor and speak, or type a message.");
  }catch(err){
    history.pop(); addMessage("assistant","I couldn't reach Gemini: "+err.message+" Check your API key, model name, and internet connection.");
    setStatus("CONNECTION ISSUE","Check Settings and try again.");
  }
}
$("chatForm").addEventListener("submit",e=>{e.preventDefault();const t=$("messageInput").value.trim();if(!t)return;$("messageInput").value="";ask(t);});
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
  const rec=new SpeechRecognition(); rec.lang="en-PH";rec.interimResults=false;rec.maxAlternatives=1;
  rec.onstart=()=>{listening=true;document.body.classList.add("listening");setStatus("LISTENING","I'm listening, "+(settings().title||"sir")+".");};
  rec.onresult=e=>{const t=e.results[0][0].transcript;ask(t);};
  rec.onerror=e=>{setStatus("MICROPHONE ISSUE",e.error==="not-allowed"?"Allow microphone access in Chrome.":"Please try speaking again.");};
  rec.onend=()=>{listening=false;document.body.classList.remove("listening");if($("status").textContent==="LISTENING")setStatus("SYSTEM READY","Tap the reactor and speak, or type a message.");};
  $("micBtn").onclick=()=>{if(listening)rec.stop();else{try{rec.start();}catch(e){}}};
}else{
  $("micBtn").onclick=()=>{setStatus("VOICE INPUT UNAVAILABLE","Try opening this app in Chrome on Android.");};
}
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
