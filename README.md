# ICT304 Concept Explorer

An offline, single-file study app for the ICT304 AI System Design exam. Built for ADHD+dyslexia-friendly learning through 4-layer understanding cards, spaced retrieval, and zero gamification pressure.

## How to Use

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge)
2. That's it — no server, no install, no internet required

## Features

**4-Layer Understanding Cards**
Each of the 104 concepts reveals in 4 progressive layers:
1. **What is it?** — vivid story to make the concept memorable
2. **Analogy** — real-world comparison that makes it click
3. **Because** — causal chain explaining *why* it works this way
4. **Where it breaks** — failure modes and common pitfalls

**Spaced Retrieval Quiz**
- Prioritises low-confidence concepts for efficient study
- Interleaves all 6 modules (weighted toward M5/M4 — highest exam weight)
- 20-question sessions with self-scoring

**Progress Tracking**
- Confidence ratings (Low/Med/High) persist in LocalStorage
- Stats show reviewed/remaining counts and weak spots per module
- Module priority: M5 (Deployment) → M4 (Eval) → M3 → M2 → M6 → M1

**Keyboard Shortcuts**
- `/` — focus search
- `Q` — start quiz
- `←` / `→` — prev/next concept
- `1-4` — reveal layer 1-4
- `H` / `M` / `L` — mark confidence
- `Esc` — close modals

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
- Inter font (wide letter spacing, clear character distinction)
- Crimson Pro headings (warm, academic)
- No timers, no streaks, no gamification
- Generous whitespace, one concept at a time
- Strictly offline — zero network requests
