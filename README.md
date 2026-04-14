# ICT304 Concept Explorer

An offline study app for the ICT304 AI System Design exam. Built for ADHD+dyslexia-friendly learning through 5-layer understanding cards, spaced retrieval, and zero gamification pressure.

## Quick Start

```bash
git clone https://github.com/calvyntwh/ict304-exam.git
cd ict304-exam
./run.sh
```

Then serve over Tailscale:

```bash
tailscale serve 8080
```

Access via your Tailscale domain (e.g. `https://your-vps.tail1234.ts.net/`).

On macOS (no Caddy installed):

```bash
python3 -m http.server 8080
```

## Architecture

- **Backend**: SQLite via [sql-wasm](https://sql.js.org/) — all 104 concepts in `kb_all.db`
- **Frontend**: Vanilla HTML/CSS/JS + Bulma 1.0.4 CSS — no build step, no framework
- **Persistence**: Confidence ratings stored in `localStorage`
- **Server**: Any static file server (Caddy, Python http.server, etc.) — needed because WASM requires same-origin

## Features

**5-Layer Understanding Cards**
Each concept reveals in 5 progressive layers (locked until MCQ answered):
1. **What is it?** — vivid story to make the concept memorable
2. **Analogy** — real-world comparison that makes it click
3. **Because** — causal chain explaining *why* it works this way
4. **Where it breaks** — failure modes and common pitfalls
5. **Exam Answer** — full Q&A for the concept (L5, always unlocked)

**MCQ Practice**
- Each concept has a multiple-choice question
- All content layers are locked until the MCQ is answered
- Badge shows `?` → `✓` / `✗` states after answering

**Spaced Retrieval Quiz**
- Prioritises low-confidence concepts for efficient study
- Interleaves all 6 modules (weighted toward M5/M4 — highest exam weight)
- 20-question sessions with self-scoring
- Session state persists — resume after refresh

**Progress Tracking**
- Confidence ratings (Low/Med/High) persist in localStorage
- Stats show reviewed/remaining counts and weak spots per module
- Module priority: M5 (Deployment) → M4 (Eval) → M3 → M2 → M6 → M1

**Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| `/` | Focus search |
| `Q` | Start quiz |
| `←` / `→` | Prev/next concept |
| `1`–`4` | Reveal layer 1–4 |
| `,` | Mark Low confidence |
| `.` | Mark Med confidence |
| `/` | Mark High confidence |
| `M` | Toggle MCQ widget |
| `Esc` | Close overlays |

## Content

All 104 questions from `ICT304_Exam_Revision_104Q.ipynb` mapped across 6 modules:
- M1 AI Foundations (Q1–14)
- M2 ML Systems (Q15–20)
- M3 System Engineering (Q21–33)
- M4 Model Eval (Q34–57)
- M5 Deployment (Q58–75)
- M6 Responsible AI (Q76–104)

## Design

Dark academic aesthetic, ADHD+dyslexia-friendly:
- **Inter** for body (wide letter spacing, clear character distinction)
- **Crimson Pro** for headings (warm, academic)
- **JetBrains Mono** for code/labels
- No timers, no streaks, no gamification
- Generous whitespace, one concept at a time

## File Layout

```
sqlite-refactor/
├── index.html          # App shell
├── app.css             # All styles
├── app.js              # All application logic (SQLite + UI)
├── bulma.min.css       # Bulma 1.0.4 CSS (local copy)
├── sql-wasm/
│   ├── sql-wasm.js     # sql.js WASM loader
│   └── sql-wasm.wasm   # SQLite binary
├── kb_all.db           # Knowledge base — 104 concepts (source of truth)
├── diagrams/           # 39 PNG diagrams
└── Caddyfile           # Caddy server config
```

## Editing Content

`kb_all.db` is the source of truth. To edit a concept, write a Python script:

```python
import sqlite3
conn = sqlite3.connect('kb_all.db')
cur = conn.cursor()
cur.execute("UPDATE concepts SET L5 = ? WHERE id = 'Q36'", (new_content,))
conn.commit()
```
