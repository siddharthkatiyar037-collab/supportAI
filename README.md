# SupportAI — Multilingual Customer Support Bot

An AI-powered multilingual customer support chatbot built for India and global audiences.
Powered by **Groq API (llama-3.3-70b-versatile)** for ultra-fast AI responses.

---

## Features

| Feature | Details |
|---|---|
| Language auto-detection | Hindi, Hinglish, English, Arabic, Spanish, French, German |
| Hinglish support | Detects code-mixed Hindi-English; responds like a real Indian support agent |
| Greeting detection | Responds to "hi", "hello", "namaste", "hola", "bonjour" and more |
| FAQ engine | Instant pre-written answers — no API call needed for common queries |
| Groq AI fallback | Unknown queries answered live via Groq API |
| Language selector | Manual dropdown to lock response language |
| Escalate to human | One click or natural phrase triggers agent handoff |
| Mobile responsive | Collapsible sidebar, compact layout |

---

## Setup

### 1. Get a free Groq API key
- Go to **console.groq.com**
- Sign up free — no credit card needed
- Click **API Keys → Create API Key**
- Copy your key

### 2. Add your key to the project
Open `src/utils/claudeApi.js` and replace the placeholder:

```js
const API_KEY = 'YOUR_GROQ_API_KEY_HERE';
```

with your actual key:

```js
const API_KEY = 'gsk_your_actual_key_here';
```

### 3. Run the project
```bash
# Option A — open directly
open index.html

# Option B — local server (recommended)
npx serve .
# then visit http://localhost:3000
```

---

## Project Structure

```
supportai/
├── index.html                      # App shell — layout, topbar, sidebar, chat
├── .gitignore                      # Keeps API keys and OS files out of git
├── src/
│   ├── styles/
│   │   └── main.css                # BEM styles, CSS tokens, responsive
│   ├── utils/
│   │   ├── langDetect.js           # Language & greeting detection engine
│   │   ├── faqEngine.js            # Keyword FAQ matcher + multilingual answers
│   │   └── claudeApi.js            # Groq API wrapper with language prompts
│   └── components/
│       ├── chatUI.js               # Message rendering, typing indicator, chips
│       └── app.js                  # Main controller — orchestrates everything
└── README.md
```

---

## How It Works

```
User types message
       │
       ▼
LangDetect.detect()       ← Script ranges + vocabulary scoring
       │
       ▼
LangDetect.isGreeting()   ← Returns warm greeting in detected language
       │
       ▼
FAQEngine.match()         ← Keyword match → instant pre-written answer
       │ (no match)
       ▼
ClaudeAPI.send()          ← Groq API with language-tuned system prompt
       │
       ▼
ChatUI.addBotMessage()    ← Renders reply in the chat feed
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3 (BEM), JavaScript ES6+ |
| Fonts | DM Sans + Syne (Google Fonts) |
| Icons | Tabler Icons |
| AI | Groq API — llama-3.3-70b-versatile |
| Language detection | Custom rule-based engine |
| FAQ matching | Keyword scoring engine |

---

## Security

- **Never commit your real API key** to version control
- The `.gitignore` is already set up to protect `.env` files
- For production deployments, proxy API requests through a backend server

---

## Hackathon Category
**Support Chat Bot — Customer Support**

*Powered by Groq API*
