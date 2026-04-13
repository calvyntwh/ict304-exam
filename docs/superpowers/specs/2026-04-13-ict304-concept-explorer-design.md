# ICT304 Concept Explorer — Design Spec

## 1. Concept & Vision

A single-file, offline HTML study app designed for an ADHD+dyslexic learner preparing for a closed-book exam in 48 hours. The app transforms the 104-question revision set and exam notes into an **interactive concept map** where every topic reveals understanding in four progressive layers — not definitions, but **stories**.

The core philosophy: *you cannot memorize what you understand*. Every concept is presented as a narrative with analogies, causal chains, and failure modes — not bullet points. The app should feel like **exploring a map of ideas**, not studying flashcards.

---

## 2. Design Language

**Aesthetic:** Dark academic — calm, low-distraction, like a well-designed note-taking app at night. Not gamified, not childish.

**Color Palette:**
- Background: `#0f1117` (near-black)
- Surface: `#1a1d27` (card backgrounds)
- Border: `#2a2d3a` (subtle separation)
- Primary: `#6c8aff` (soft indigo — links, active states)
- Accent: `#f5a623` (amber — warnings, confidence low)
- Success: `#4ade80` (green — confidence high)
- Text Primary: `#e8eaf0`
- Text Secondary: `#8b8fa8`
- Module Colors (left sidebar tabs):
  - M1: `#ff6b6b` (coral)
  - M2: `#ffa94d` (orange)
  - M3: `#ffd43b` (yellow)
  - M4: `#69db7c` (green)
  - M5: `#4dabf7` (blue)
  - M6: `#da77f2` (purple)

**Typography:**
- Headings: `'Crimson Pro'`, serif — readable, academic feel
- Body: `'Inter'`, sans-serif — clean, dyslexia-friendly (wide letter spacing, clear distinction between similar characters)
- Monospace: `'JetBrains Mono'` — for formulas/technical terms

**Motion:**
- Cards reveal layers with a gentle 250ms fade+slide
- Module transitions slide left/right 200ms ease-out
- No jarring animations, no auto-playing elements

---

## 3. Layout & Structure

```
┌──────────────────────────────────────────────────────────────┐
│  ICT304 Concept Explorer          [Quiz Mode] [Stats]  [?]  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│  MODULES   │   CONCEPT CARD (center, max-width 720px)       │
│            │                                                 │
│  M1 [■]    │   Topic: Data Leakage                          │
│  M2 [□]    │   Module: 5  |  Q58                            │
│  M3 [■]    │                                                 │
│  M4 [□]    │   ┌─────────────────────────────────────────┐  │
│  M5 [□]    │   │ LAYER 1 — What is it?                  │  │
│  M6 [□]    │   │ "Studying with the answer key hidden   │  │
│            │   │ under the exam paper..."                 │  │
│  ───────── │   │                           [Reveal ↓]   │  │
│  QUIZ      │   └─────────────────────────────────────────┘  │
│  [Start]   │   ┌─────────────────────────────────────────┐  │
│            │   │ LAYER 2 — Real-world analogy             │  │
│  ───────── │   │ (appears after tap)                      │  │
│  PROGRESS  │   └─────────────────────────────────────────┘  │
│  34/104    │   ┌─────────────────────────────────────────┐  │
│  ████░░░░  │   │ LAYER 3 — Because chain                 │  │
│            │   │ (appears after tap)                      │  │
│  CONFIDENCE│   └─────────────────────────────────────────┘  │
│  12 Low    │   ┌─────────────────────────────────────────┐  │
│  15 Med    │   │ LAYER 4 — Failure modes                 │  │
│   7 High   │   │ (appears after tap)                     │  │
│            │   └─────────────────────────────────────────┘  │
│            │                                                 │
│            │   [← Prev]          [Quiz This Topic]         │
│            │                                     [Next →] │
└────────────┴─────────────────────────────────────────────────┘
```

**Responsive:** On mobile (<768px), sidebar collapses to a top module tab bar. Cards go full-width with padding.

---

## 4. Features & Interactions

### 4.1 Concept Card — 4-Layer Progressive Reveal

Each concept has exactly 4 layers. Only Layer 1 is visible on open. Each subsequent layer reveals on tap/click.

| Layer | Content Type | What It Shows |
|-------|-------------|---------------|
| Layer 1 | One-liner story | A vivid 1-2 sentence story explaining the concept |
| Layer 2 | Real-world analogy | An everyday analogy that makes the concept click |
| Layer 3 | Because chain | 2-3 sentences on *why* it works this way |
| Layer 4 | Failure modes | What breaks, edge cases, common mistakes |

**Tap interaction:** Each layer card has a "Reveal" button. On mobile, tapping the card itself reveals the next layer.

**Confidence marking:** After revealing Layer 4, the user can mark confidence: 🟢 High / 🟡 Medium / 🔴 Low. This persists in LocalStorage.

### 4.2 Module Browser

- Left sidebar lists all 6 modules
- Each module shows a colored dot: red=low confidence, amber=medium, green=high
- Clicking a module filters to concepts in that module
- Concept count shown per module

### 4.3 Quiz Mode

**Entry:** Click "Quiz Mode" button.

**How it works:**
1. Presents a concept card with Layer 1 hidden (shows only the topic name and module)
2. User tries to recall the concept before tapping reveal
3. After reveal, mark confidence
4. Moves to next concept (prioritizes low-confidence concepts first — spaced retrieval)
5. Session ends after 20 concepts or user exits

**Interleaving:** Quiz pulls from all modules, weighted toward low-confidence areas.

### 4.4 Progress & Stats

- **Overall progress:** "34/104 concepts reviewed" with progress bar
- **Confidence breakdown:** Red/Amber/Green counts
- **Weak spots:** Lists topics with 🔴 Low confidence — these get priority in quiz
- **Module breakdown:** Per-module coverage percentage

### 4.5 Search

- Search bar at top — fuzzy search across topic names
- Results highlight matching concepts
- Click result to jump to that concept

### 4.6 Keyboard Shortcuts (accessibility)

- `←` / `→` — prev/next concept
- `Space` — reveal next layer
- `1-4` — reveal layer 1-4 directly
- `H` / `M` / `L` — mark High/Medium/Low confidence
- `/` — focus search
- `Q` — toggle quiz mode

---

## 5. Knowledge Base

**Source files:**
- `ICT304_Exam_Revision_104Q.ipynb` → 104 Q&A entries (primary source)
- `ICT304_Exam_notes.pdf` → 60+ concept cards with analogy/because_chain/failure_mode
- `Lectures/` notebooks → visual/diagram descriptions for reference

**Concept card schema (per concept):**
```json
{
  "id": "Q58",
  "module": 5,
  "topic": "Data Leakage Problem",
  "layers": {
    "L1": "Studying with the answer key hidden under the exam paper — you get a perfect score in practice but fail the real test...",
    "L2": "Like looking at the answer key before an exam...",
    "L3": "If the model sees the answers during training, it learns to exploit those correlations...",
    "L4": "Most dangerous because it's invisible — the model appears to work fine during evaluation..."
  },
  "confidence": null,
  "related_diagrams": ["ML pipeline diagram", "Train/Val/Test split diagram"]
}
```

**Content generation approach:**
- Agent-generated content from 104Q + exam notes → manually curated JSON
- Each concept gets exactly 4 layers of understanding
- Calculations/formulas (CTR, Brier Score, etc.) include plain-English explanation + the formula itself

---

## 6. Technical Approach

**Single HTML file** — no build step, no server, fully offline.

```
index.html
├── <style> — all CSS embedded
├── <script> — all JS embedded
└── <script type="application/json"> — embedded knowledge base (JSON)
```

**External resources (CDN, used only if available):**
- Google Fonts: Crimson Pro, Inter, JetBrains Mono (with system fallbacks)

**Key implementation decisions:**
- Vanilla JS — no React/Vue/frameworks (keeps file simple, fast load)
- LocalStorage for persistence (confidence ratings, quiz progress)
- CSS Grid + Flexbox for layout
- `data-` attributes for state management
- No bundler, no npm, no dependencies

**Knowledge base:** Pre-built JSON embedded in the HTML at generation time. The app reads it at runtime — no parsing required.

---

## 7. Concept Prioritization

**Exam priority (study order):**
1. M5 (Deployment/ML Failures/Monitoring) — 25% weight, ~28 concepts
2. M4 (Model Selection/Evaluation/Ensembles) — 20% weight, ~20 concepts
3. M3 (System Engineering/EDP/Lifecycle) — 15% weight, ~15 concepts
4. M2 (Data Prep/Feature Engineering) — 15% weight, ~12 concepts
5. M6 (Responsible AI/Fairness/Privacy) — 15% weight, ~20 concepts
6. M1 (AI Foundations) — 10% weight, ~14 concepts

**High-value study targets (extended response likely):**
- Q1: Intelligent Systems characteristics (M1)
- Q21: Project consideration factors (M3)
- Q25/26: System design processes (M3)
- Q63: Validation of requirements (M5)
- Q65: Ensemble methods (M4)
- Q72: Evaluation methods (M4)
- Q90: ML-Specific failures (M6)
- Q93: Distribution shifts (M6)
- Q98/99: Responsible AI (M6)

---

## 8. Accessibility (ADHD+Dyslexia)

- **No time pressure** — no timers, no streaks, no gamification pressure
- **Chunked content** — one concept at a time, clear visual hierarchy
- **Visual differentiation** — module colors, confidence colors, layer borders
- **Generous whitespace** — nothing feels cramped
- **Keyboard navigable** — no mouse required
- **Font choices** — Inter for body (designed for screen readability), Crimson Pro for headings (warm, academic)
- **No auto-play** — nothing moves unless the user taps
- **Focus mode** — can hide sidebar for distraction-free reading

---

## 9. Scope for MVP (v1.0)

**Included:**
- Full knowledge base from 104Q + exam notes
- 4-layer concept cards
- Module browser
- Confidence tracking (LocalStorage)
- Quiz mode (spaced retrieval, interleaved)
- Progress stats
- Search
- Keyboard shortcuts
- Responsive mobile layout

**Deferred (v1.1+):**
- Dark/light theme toggle
- Export/import progress
- Concept relationship graph view
- Additional visual diagrams from lectures
- Formula rendering (MathJax/KaTeX)
