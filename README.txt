J.A.R.V.I.S. STARTER — HONOR X9b / ANDROID

WHAT THIS FIRST BUILD DOES
- Gemini text chat
- Android browser speech recognition (if supported)
- Android text-to-speech
- Futuristic responsive interface
- Installable PWA shell

IMPORTANT LIMITATIONS
- This is a first prototype, not a full Android app.
- It does not make real phone calls or reliably run as an always-on background assistant.
- Browser voice recognition support depends on Chrome/device/network.
- Notifications and background wake-word listening are not implemented yet.
- API key is stored in localStorage for convenience. This is NOT secure for a public app. Do not publish/share this prototype or your key.
- Keep the Gemini project on the free tier. Do not add billing/payment details. Free quotas and available models can change.

SETUP (PHONE)
1. Extract this ZIP using your phone's Files app.
2. Put the folder on a static HTTPS host you control (for example, a free static hosting account). A PWA/service worker needs HTTPS or localhost.
3. Open the hosted site in Chrome.
4. Tap the gear icon, paste your Gemini API key, and save.
5. Test typed chat first, then microphone and speech.
6. In Chrome menu, choose "Add to Home screen" / "Install app" if available.

GEMINI API KEY
Create/manage it only at:
https://aistudio.google.com/app/apikey
Do not send the key to anyone, including in chat. Do not enable billing.
Google free tier has limited models and quotas; availability can vary by region/account.

PHONE CALLS
An app cannot silently place ordinary cellular calls for free. Later we can add an internet voice-call style experience, but a real phone number calling service generally needs a telephony provider and may cost money.
