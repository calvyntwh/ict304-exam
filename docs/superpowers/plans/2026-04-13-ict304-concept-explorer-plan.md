# ICT304 Concept Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file, offline HTML study app that turns 104 exam questions into 4-layer understanding cards with quiz mode and spaced retrieval.

**Architecture:** Single `index.html` file with embedded CSS, JS, and a pre-built JSON knowledge base. Vanilla JS, no frameworks. LocalStorage for persistence. All concept text rendered via `textContent` (not innerHTML) for security.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Fonts (Crimson Pro, Inter, JetBrains Mono), LocalStorage API.

---

## File Structure

```
study-app/
├── index.html              # Complete app (HTML + CSS + JS + knowledge base)
└── README.md              # How to use (open in browser)
```

---

## Security Model

This app is **strictly offline** with a **static embedded knowledge base** — no network requests, no user-provided content. However, all concept text (topic names, layer content) is rendered via `textContent` to prevent XSS even in edge cases (e.g., if knowledge base JSON contains malicious content).

---

## Task 1: Build Knowledge Base JSON

**Files:**
- Create: `index.html` (knowledge base block only — rest filled in later tasks)
- Source data: Research agents outputs — 104 Q&A + exam notes concept cards

**Output:** A `<script type="application/json" id="kb">` block. The JSON contains `concepts` array. Each concept has `id`, `module`, `topic`, and `layers.L1/L2/L3/L4`. L1 = vivid one-liner story, L2 = real-world analogy, L3 = because chain + formula if applicable, L4 = failure modes.

**Schema:**
```json
{
  "concepts": [
    {
      "id": "Q58",
      "module": 5,
      "topic": "Data Leakage Problem",
      "layers": {
        "L1": "Studying with the answer key hidden under the exam paper — you get a perfect score in practice but fail the real test because you never actually learned the material.",
        "L2": "Like looking at the answer key before an exam — you appear to know everything during practice, but when the real exam comes you have no idea how to solve the problems.",
        "L3": "If the model sees the answers during training, it learns to exploit those correlations rather than genuine patterns. When deployed on truly new data, those correlations don't exist and performance collapses. This is why proper train/test splitting is critical.",
        "L4": "Most dangerous because it's invisible — the model appears to work fine during evaluation. Common sources: including test data in training, target encoding before splitting, leaking future information into features."
      }
    }
  ]
}
```

**Content population approach:**
- All 104 Q entries — use exam notes agent's `conceptCards` array for L2/L3/L4 where available
- For gaps: derive L2 (analogy) from the Q's answer using patterns from similar concepts
- Calculation questions (CTR Q73, Brier Score Q72, binary encoding formula Q31) — L3 includes formula in monospace font

- [ ] **Step 1: Create `index.html` with knowledge base `<script>` tag and DOCTYPE**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ICT304 Concept Explorer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>/* CSS goes here — filled in Task 2 */</style>
</head>
<body>
  <script type="application/json" id="kb">
  {
    "concepts": [
      /* ALL 104 concepts — filled from research agent data */
    ]
  }
  </script>
  <script>
  /* App JS goes here — filled in Tasks 3-8 */
  </script>
</body>
</html>
```

- [ ] **Step 2: Populate the `concepts` array**

Extract all 104 questions from the research agent output. Use the exam_notes agent's `conceptCards` for L2/L3/L4 where provided. For calculation topics, include formula text in L3.

---

## Task 2: HTML Skeleton + CSS Variables + Layout Grid

**Files:**
- Modify: `index.html` — add CSS, layout structure

- [ ] **Step 1: Write CSS custom properties and base styles**

```css
:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --border: #2a2d3a;
  --primary: #6c8aff;
  --accent: #f5a623;
  --success: #4ade80;
  --danger: #f87171;
  --text: #e8eaf0;
  --text-secondary: #8b8fa8;
  --m1: #ff6b6b; --m2: #ffa94d; --m3: #ffd43b;
  --m4: #69db7c; --m5: #4dabf7; --m6: #da77f2;
  --font-heading: 'Crimson Pro', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 12px;
  --sidebar-width: 220px;
  --header-height: 56px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.7;
  min-height: 100vh;
}
```

- [ ] **Step 2: Write app layout grid**

```css
.app {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
  height: 100vh;
  overflow: hidden;
}

.header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  gap: 16px;
}

.sidebar {
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px 0;
  background: var(--surface);
}

.main {
  overflow-y: auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#concept-card {
  width: 100%;
  max-width: 720px;
}
```

- [ ] **Step 3: Add responsive mobile breakpoint**

```css
@media (max-width: 768px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: var(--header-height) auto 1fr;
  }
  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    padding: 8px 16px;
  }
  .sidebar-inner { display: flex; gap: 8px; overflow-x: auto; }
  .main { padding: 20px 16px; }
}
```

---

## Task 3: Header + Sidebar + Module List + State Management

**Files:**
- Modify: `index.html` — add header HTML, sidebar HTML, JS for rendering

- [ ] **Step 1: Add header HTML inside `.app` div**

```html
<header class="header">
  <h1 class="app-title">ICT304 Concept Explorer</h1>
  <div class="header-actions">
    <button id="btn-quiz" class="btn btn-primary">Quiz Mode</button>
    <button id="btn-stats" class="btn btn-ghost">Stats</button>
    <button id="btn-help" class="btn btn-ghost" title="Keyboard shortcuts">?</button>
  </div>
</header>
```

- [ ] **Step 2: Add sidebar HTML**

```html
<aside class="sidebar">
  <div class="sidebar-inner">
    <nav class="module-list" id="module-list"></nav>
    <div class="sidebar-divider"></div>
    <div class="progress-section" id="progress-section"></div>
  </div>
</aside>
```

- [ ] **Step 3: Add main content area HTML**

```html
<main class="main" id="main">
  <div id="concept-card"></div>
</main>
```

- [ ] **Step 4: Write LocalStorage state management**

```javascript
var STORAGE_KEY = 'ict304_study_app_v1';

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 5: Write `renderModuleList()` function**

```javascript
function renderModuleList() {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var state = loadState();
  var moduleNames = ['AI Foundations','ML Systems','System Engineering',
                     'Model Eval','Deployment','Responsible AI'];
  var counts = {1:0,2:0,3:0,4:0,5:0,6:0};
  var confCounts = {1:{l:0,m:0,h:0},2:{l:0,m:0,h:0},3:{l:0,m:0,h:0},
                     4:{l:0,m:0,h:0},5:{l:0,m:0,h:0},6:{l:0,m:0,h:0}};
  kb.concepts.forEach(function(c) { counts[c.module]++; });
  if (state.confidence) {
    kb.concepts.forEach(function(c) {
      var lv = state.confidence[c.id];
      if (lv === 'low') confCounts[c.module].l++;
      else if (lv === 'med') confCounts[c.module].m++;
      else if (lv === 'high') confCounts[c.module].h++;
    });
  }
  var container = document.getElementById('module-list');
  container.innerHTML = '';
  moduleNames.forEach(function(name, i) {
    var n = i + 1;
    var dotColor = confDotColor(confCounts[n]);
    var btn = document.createElement('button');
    btn.className = 'module-btn' + (state.lastModule === n ? ' active' : '');
    btn.dataset.module = n;
    btn.innerHTML =
      '<span class="module-dot" style="background:var(--m' + n + ')"></span>' +
      '<span class="module-name">M' + n + ' ' + name + '</span>' +
      '<span class="module-count">' + counts[n] + '</span>';
    container.appendChild(btn);
  });
}

function confDotColor(conf) {
  var total = conf.l + conf.m + conf.h;
  if (total === 0) return 'var(--text-secondary)';
  if (conf.l / total > 0.5) return 'var(--accent)';
  if (conf.h / total > 0.5) return 'var(--success)';
  return 'var(--text-secondary)';
}
```

- [ ] **Step 6: Write `updateProgress()` function**

```javascript
function updateProgress() {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var state = loadState();
  var total = kb.concepts.length;
  var reviewed = kb.concepts.filter(function(c) { return !!state.confidence[c.id]; }).length;
  var low = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
  var med = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'med'; }).length;
  var high = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'high'; }).length;
  var pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  var section = document.getElementById('progress-section');
  if (!section) return;
  section.innerHTML =
    '<div class="progress-wrap">' +
      '<div class="progress-label">Progress</div>' +
      '<div class="progress-count">' + reviewed + '/' + total + '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="progress-pct">' + pct + '%</div>' +
      '<div class="confidence-summary">' +
        '<span class="conf-dot" style="background:var(--accent)"></span>' + low + ' low ' +
        '<span class="conf-dot" style="background:var(--text-secondary)"></span>' + med + ' med ' +
        '<span class="conf-dot" style="background:var(--success)"></span>' + high + ' high' +
      '</div>' +
    '</div>';
}
```

- [ ] **Step 7: Add button and progress CSS**

```css
.btn {
  border: none; border-radius: 8px; padding: 8px 16px;
  font-family: var(--font-body); font-size: 14px; cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-ghost { background: transparent; color: var(--text-secondary); }
.btn-ghost:hover { color: var(--text); }

.module-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 16px; border: none;
  background: transparent; color: var(--text);
  font-size: 13px; cursor: pointer; text-align: left;
  transition: background 0.15s;
}
.module-btn:hover { background: var(--bg); }
.module-btn.active { background: var(--bg); color: var(--primary); }
.module-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.module-count { margin-left: auto; color: var(--text-secondary); font-size: 12px; }

.progress-wrap { padding: 12px 16px; }
.progress-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary); margin-bottom: 8px; }
.progress-count { font-size: 13px; margin-bottom: 4px; }
.progress-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
.progress-fill { height: 100%; background: var(--primary); transition: width 0.3s; }
.progress-pct { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }
.confidence-summary { font-size: 12px; display: flex; align-items: center; gap: 6px; }
.conf-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
```

---

## Task 4: Concept Card — 4-Layer Reveal

**Files:**
- Modify: `index.html` — add concept card CSS and JS

- [ ] **Step 1: Add concept card CSS**

```css
.concept-header { margin-bottom: 24px; }

.concept-meta {
  display: flex; gap: 10px; align-items: center;
  margin-bottom: 10px; flex-wrap: wrap;
}

.concept-badge {
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; padding: 3px 10px;
  border-radius: 100px; background: var(--surface);
  border: 1px solid var(--border); color: var(--text-secondary);
}

.concept-topic {
  font-family: var(--font-heading); font-size: 28px;
  font-weight: 600; color: var(--text); line-height: 1.3;
}

.layer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.layer:hover { border-color: var(--primary); }
.layer.revealed { border-color: var(--border); }
.layer.revealed:hover { border-color: var(--border); }

.layer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; cursor: pointer; user-select: none;
}
.layer-header:hover { background: rgba(255,255,255,0.02); }

.layer-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--primary);
}

.layer-toggle {
  font-size: 12px; color: var(--primary);
  background: none; border: none; cursor: pointer;
  padding: 2px 8px; border-radius: 4px;
}

.layer-content {
  padding: 0 20px 16px;
  font-size: 16px; line-height: 1.8; color: var(--text);
  display: none;
}
.layer-content.expanded { display: block; }
.layer-content code {
  font-family: var(--font-mono); font-size: 14px;
  background: var(--bg); padding: 1px 6px; border-radius: 4px;
}

.confidence-row {
  display: flex; gap: 10px; margin-top: 16px;
  margin-bottom: 24px; align-items: center; flex-wrap: wrap;
}

.confidence-btn {
  padding: 8px 16px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text-secondary); font-size: 13px;
  cursor: pointer; transition: all 0.15s; font-family: var(--font-body);
}
.confidence-btn:hover { border-color: var(--primary); color: var(--text); }
.confidence-btn.selected.low { background: #7f1d1d; border-color: var(--accent); color: var(--accent); }
.confidence-btn.selected.med { background: #713f12; border-color: var(--accent); color: var(--accent); }
.confidence-btn.selected.high { background: #14532d; border-color: var(--success); color: var(--success); }

.card-nav {
  display: flex; justify-content: space-between;
  align-items: center; gap: 16px; margin-top: 24px;
}

.nav-btn {
  padding: 10px 20px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text); font-size: 14px; cursor: pointer;
  transition: all 0.15s; font-family: var(--font-body);
}
.nav-btn:hover { border-color: var(--primary); color: var(--primary); }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
```

- [ ] **Step 2: Write `renderConceptCard(concept)` function**

```javascript
// State variables (module scope via closure)
var currentModule = null;
var conceptIndex = 0;
var currentConcepts = [];

function renderConceptCard(concept) {
  var state = loadState();
  var conf = (state.confidence || {})[concept.id] || null;
  var card = document.getElementById('concept-card');

  // Build layer HTML
  var layersHtml = ['L1','L2','L3','L4'].map(function(key) {
    var labels = {'L1':'What is it?','L2':'Real-world analogy','L3':'Because...','L4':'Where it breaks'};
    var content = concept.layers[key] || 'Not available — check source material.';
    return '<div class="layer" data-layer="' + key + '">' +
      '<div class="layer-header">' +
        '<span class="layer-label">' + labels[key] + '</span>' +
        '<button class="layer-toggle">[ reveal ]</button>' +
      '</div>' +
      '<div class="layer-content"></div>' +
    '</div>';
  }).join('');

  card.innerHTML =
    '<div class="concept-header">' +
      '<div class="concept-meta">' +
        '<span class="concept-badge" style="color:var(--m' + concept.module + ')">Module ' + concept.module + '</span>' +
        '<span class="concept-badge">' + concept.id + '</span>' +
      '</div>' +
      '<h2 class="concept-topic"></h2>' +
    '</div>' +
    '<div class="layers">' + layersHtml + '</div>' +
    '<div class="confidence-row" id="conf-row-' + concept.id + '">' +
      '<span style="font-size:13px;color:var(--text-secondary)">How confident?</span>' +
      '<button class="confidence-btn" data-cf="low">&#x1F534; Low</button>' +
      '<button class="confidence-btn" data-cf="med">&#x1F7E1; Med</button>' +
      '<button class="confidence-btn" data-cf="high">&#x1F7E2; High</button>' +
    '</div>' +
    '<div class="card-nav">' +
      '<button class="nav-btn" id="nav-prev">&larr; Prev</button>' +
      '<button class="btn btn-primary" id="nav-quiz-this">Quiz This</button>' +
      '<button class="nav-btn" id="nav-next">Next &rarr;</button>' +
    '</div>';

  // Use textContent for concept text (security)
  card.querySelector('.concept-topic').textContent = concept.topic;

  // Set layer content via textContent
  var layerEls = card.querySelectorAll('.layer');
  ['L1','L2','L3','L4'].forEach(function(key, i) {
    var content = concept.layers[key] || '';
    layerEls[i].querySelector('.layer-content').textContent = content;
  });

  // Set confidence button state
  if (conf) {
    card.querySelector('[data-cf="' + conf + '"]').classList.add('selected', conf);
  }

  attachLayerListeners(layerEls);
  attachConfidenceListeners(concept);
  attachNavListeners();
  updateNavButtons();
}

function attachLayerListeners(layerEls) {
  layerEls.forEach(function(layer) {
    var key = layer.dataset.layer;
    var header = layer.querySelector('.layer-header');
    var toggle = layer.querySelector('.layer-toggle');
    var content = layer.querySelector('.layer-content');

    header.addEventListener('click', function() {
      if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.textContent = '[ reveal ]';
        layer.classList.remove('revealed');
      } else {
        content.classList.add('expanded');
        toggle.textContent = '[ hide ]';
        layer.classList.add('revealed');
      }
    });
  });
}

function attachConfidenceListeners(concept) {
  var row = document.getElementById('conf-row-' + concept.id);
  if (!row) return;
  row.querySelectorAll('.confidence-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var level = btn.dataset.cf;
      saveConfidence(concept.id, level);
      row.querySelectorAll('.confidence-btn').forEach(function(b) {
        b.classList.remove('selected','low','med','high');
      });
      btn.classList.add('selected', level);
      renderModuleList();
      updateProgress();
    });
  });
}

function attachNavListeners() {
  document.getElementById('nav-prev').onclick = function() { navigate(-1); };
  document.getElementById('nav-next').onclick = function() { navigate(1); };
  var quizBtn = document.getElementById('nav-quiz-this');
  if (quizBtn) {
    quizBtn.onclick = function() {
      var state = loadState();
      var concept = currentConcepts[conceptIndex];
      state.quiz = { queue: [concept.id], index: 0, sessionSize: 1 };
      saveState(state);
      showQuizOverlay();
      renderQuizCard();
    };
  }
}

function updateNavButtons() {
  var prev = document.getElementById('nav-prev');
  var next = document.getElementById('nav-next');
  if (prev) prev.disabled = conceptIndex <= 0;
  if (next) next.disabled = conceptIndex >= currentConcepts.length - 1;
}
```

- [ ] **Step 3: Write `selectModule(moduleNum)` and `navigate(dir)`**

```javascript
function selectModule(moduleNum) {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  currentModule = moduleNum;
  currentConcepts = moduleNum
    ? kb.concepts.filter(function(c) { return c.module === moduleNum; })
    : kb.concepts;
  conceptIndex = 0;
  var state = loadState();
  state.lastModule = moduleNum;
  saveState(state);
  document.querySelectorAll('.module-btn').forEach(function(btn) {
    btn.classList.toggle('active', parseInt(btn.dataset.module) === moduleNum);
  });
  if (currentConcepts.length > 0) {
    renderConceptCard(currentConcepts[conceptIndex]);
  }
}

function navigate(dir) {
  conceptIndex = Math.max(0, Math.min(currentConcepts.length - 1, conceptIndex + dir));
  renderConceptCard(currentConcepts[conceptIndex]);
  document.getElementById('main').scrollTop = 0;
}
```

---

## Task 5: Quiz Mode — Spaced Retrieval Engine

**Files:**
- Modify: `index.html` — add quiz overlay HTML, CSS, and JS

- [ ] **Step 1: Write quiz overlay HTML (hidden by default) and CSS**

```html
<div class="quiz-overlay hidden" id="quiz-overlay"></div>
```

```css
.quiz-overlay {
  position: fixed; inset: 0;
  background: rgba(15,17,23,0.97);
  z-index: 100;
  display: flex; flex-direction: column;
  align-items: center; padding: 32px 24px;
  overflow-y: auto;
}
.quiz-overlay.hidden { display: none; }

.quiz-header {
  width: 100%; max-width: 720px;
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 24px;
}
.quiz-progress-label { font-size: 13px; color: var(--text-secondary); }
.quiz-progress-bar {
  width: 200px; height: 4px; background: var(--border);
  border-radius: 2px; margin-top: 8px; overflow: hidden;
}
.quiz-progress-fill {
  height: 100%; background: var(--primary);
  transition: width 0.3s ease; border-radius: 2px;
}
.quiz-card {
  width: 100%; max-width: 720px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 32px;
}
.quiz-topic {
  font-family: var(--font-heading); font-size: 24px;
  color: var(--text); margin-bottom: 8px;
}
.quiz-meta { font-size: 13px; color: var(--text-secondary); margin-bottom: 28px; }
.quiz-reveal-area { text-align: center; padding: 24px 0; }
.quiz-reveal-btn {
  padding: 14px 28px; border-radius: 8px; border: none;
  background: var(--primary); color: #fff;
  font-size: 16px; cursor: pointer; font-family: var(--font-body);
  transition: opacity 0.15s;
}
.quiz-reveal-btn:hover { opacity: 0.85; }
.quiz-answer { display: none; }
.quiz-answer.visible { display: block; }
.quiz-answer-text {
  font-size: 15px; line-height: 1.8; color: var(--text);
  margin-bottom: 20px;
}
.quiz-answer-text hr {
  border: none; border-top: 1px solid var(--border); margin: 20px 0;
}
.quiz-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.quiz-skip-btn {
  padding: 12px 20px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); font-size: 14px;
  cursor: pointer; font-family: var(--font-body);
}
.quiz-complete {
  text-align: center; padding: 48px;
  font-family: var(--font-heading);
}
.quiz-complete h2 { font-size: 28px; margin-bottom: 12px; }
.quiz-complete p { color: var(--text-secondary); font-size: 16px; margin-bottom: 24px; }
```

- [ ] **Step 2: Write quiz state machine**

```javascript
var QUIZ_SESSION_SIZE = 20;

function startQuiz() {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var state = loadState();
  // Priority: low confidence -> medium -> unvisited -> random shuffle
  var low = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'low'; });
  var med = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'med'; });
  var unvisited = kb.concepts.filter(function(c) { return !state.confidence[c.id]; });
  var queue = shuffle(low.concat(med).concat(unvisited)).slice(0, QUIZ_SESSION_SIZE);
  state.quiz = {
    queue: queue.map(function(c) { return c.id; }),
    index: 0,
    sessionSize: Math.min(QUIZ_SESSION_SIZE, queue.length)
  };
  saveState(state);
  document.getElementById('quiz-overlay').classList.remove('hidden');
  renderQuizCard();
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function renderQuizCard() {
  var state = loadState();
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var overlay = document.getElementById('quiz-overlay');

  if (!state.quiz || state.quiz.index >= state.quiz.queue.length) {
    overlay.innerHTML =
      '<div class="quiz-complete">' +
        '<h2>Session Complete!</h2>' +
        '<p>You reviewed ' + state.quiz.sessionSize + ' concepts.</p>' +
        '<button class="btn btn-primary" onclick="closeQuiz()">Back to Explorer</button>' +
      '</div>';
    return;
  }

  var conceptId = state.quiz.queue[state.quiz.index];
  var concept = kb.concepts.find(function(c) { return c.id === conceptId; });
  var progress = state.quiz.index;
  var total = state.quiz.sessionSize;

  overlay.innerHTML =
    '<div class="quiz-header">' +
      '<div>' +
        '<div class="quiz-progress-label">' + progress + ' / ' + total + '</div>' +
        '<div class="quiz-progress-bar">' +
          '<div class="quiz-progress-fill" style="width:' + ((progress / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>' +
      '<button class="nav-btn" id="quiz-close">&#x2715; Close</button>' +
    '</div>' +
    '<div class="quiz-card">' +
      '<div class="quiz-topic"></div>' +
      '<div class="quiz-meta">Module ' + concept.module + ' &middot; ' + concept.id + '</div>' +
      '<div class="quiz-reveal-area" id="quiz-reveal-area">' +
        '<button class="quiz-reveal-btn" id="quiz-reveal">Try to recall before revealing!</button>' +
      '</div>' +
      '<div class="quiz-answer" id="quiz-answer">' +
        '<div class="quiz-answer-text" id="quiz-answer-text"></div>' +
        '<div class="confidence-row">' +
          '<span style="font-size:13px;color:var(--text-secondary)">Your confidence:</span>' +
          '<button class="confidence-btn" data-qcf="low">&#x1F534; Low</button>' +
          '<button class="confidence-btn" data-qcf="med">&#x1F7E1; Med</button>' +
          '<button class="confidence-btn" data-qcf="high">&#x1F7E2; High</button>' +
        '</div>' +
        '<div class="quiz-actions">' +
          '<button class="quiz-reveal-btn" id="quiz-next">Next &rarr;</button>' +
          '<button class="quiz-skip-btn" id="quiz-skip">Skip</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // textContent for concept text (security)
  overlay.querySelector('.quiz-topic').textContent = concept.topic;

  // Build answer text (L1-L4 joined)
  var answerText = [concept.layers.L1, concept.layers.L2, concept.layers.L3, concept.layers.L4]
    .filter(Boolean)
    .join('\n---\n');
  overlay.querySelector('.quiz-answer-text').textContent = answerText;

  document.getElementById('quiz-close').onclick = closeQuiz;
  document.getElementById('quiz-reveal').onclick = function() {
    document.getElementById('quiz-reveal-area').style.display = 'none';
    document.getElementById('quiz-answer').classList.add('visible');
  };
  document.getElementById('quiz-next').onclick = function() {
    var selected = document.querySelector('[data-qcf].selected');
    if (selected) {
      saveConfidence(concept.id, selected.dataset.qcf);
    }
    advanceQuiz();
  };
  document.getElementById('quiz-skip').onclick = function() { advanceQuiz(); };
  document.querySelectorAll('[data-qcf]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-qcf]').forEach(function(b) {
        b.classList.remove('selected','low','med','high');
      });
      btn.classList.add('selected', btn.dataset.qcf);
    });
  });
}

function advanceQuiz() {
  var state = loadState();
  state.quiz.index++;
  saveState(state);
  renderQuizCard();
}

function closeQuiz() {
  document.getElementById('quiz-overlay').classList.add('hidden');
  renderModuleList();
  updateProgress();
}
```

---

## Task 6: Stats Modal + Progress Stats

**Files:**
- Modify: `index.html` — add stats modal

- [ ] **Step 1: Write `renderStatsModal()`**

```javascript
function renderStatsModal() {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var state = loadState();
  var total = kb.concepts.length;
  var reviewed = kb.concepts.filter(function(c) { return !!state.confidence[c.id]; }).length;
  var low = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
  var med = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'med'; }).length;
  var high = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'high'; }).length;
  var weakSpots = kb.concepts.filter(function(c) { return state.confidence[c.id] === 'low'; });
  var retentionPct = reviewed > 0 ? Math.round(((reviewed - low) / reviewed) * 100) : 0;

  var moduleRows = [1,2,3,4,5,6].map(function(n) {
    var mods = kb.concepts.filter(function(c) { return c.module === n; });
    var rev = mods.filter(function(c) { return !!state.confidence[c.id]; });
    var lowN = mods.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
    return '<div class="stat-module-row">' +
      '<span class="stat-dot" style="background:var(--m' + n + ')"></span>' +
      '<span class="stat-module-name">M' + n + '</span>' +
      '<span class="stat-count">' + rev.length + '/' + mods.length + '</span>' +
      (lowN > 0 ? '<span class="stat-low">' + lowN + ' low</span>' : '') +
    '</div>';
  }).join('');

  var weakHtml = weakSpots.length > 0
    ? '<div class="stat-weak-spots">' +
        '<div class="stat-section-label">Weak spots — prioritize in quiz</div>' +
        weakSpots.slice(0, 12).map(function(c) {
          return '<div class="stat-weak-item" data-jump="' + c.id + '">' +
            '<span class="stat-weak-id">' + c.id + '</span>' +
            '<span>' + c.topic + '</span></div>';
        }).join('') + '</div>'
    : '<div style="font-size:13px;color:var(--text-secondary);padding:12px 0">No weak spots yet — keep studying!</div>';

  var modal = document.createElement('div');
  modal.className = 'quiz-overlay';
  modal.id = 'stats-overlay';
  modal.innerHTML =
    '<div class="quiz-header">' +
      '<h2 class="stat-modal-title">Study Stats</h2>' +
      '<button class="nav-btn" id="stats-close">&#x2715;</button>' +
    '</div>' +
    '<div class="stats-body">' +
      '<div class="stat-cards">' +
        '<div class="stat-card"><div class="stat-card-num">' + reviewed + '</div><div class="stat-card-label">Reviewed</div></div>' +
        '<div class="stat-card"><div class="stat-card-num">' + (total - reviewed) + '</div><div class="stat-card-label">Remaining</div></div>' +
        '<div class="stat-card"><div class="stat-card-num" style="color:var(--success)">' + retentionPct + '%</div><div class="stat-card-label">Retention</div></div>' +
      '</div>' +
      '<div class="stat-modules">' +
        '<div class="stat-section-label">By Module</div>' +
        moduleRows +
      '</div>' +
      weakHtml +
    '</div>';
  document.body.appendChild(modal);
  modal.querySelector('#stats-close').onclick = closeStatsModal;
  modal.querySelectorAll('.stat-weak-item').forEach(function(item) {
    item.onclick = function() {
      closeStatsModal();
      jumpToConcept(item.dataset.jump);
    };
  });
}

function closeStatsModal() {
  var el = document.getElementById('stats-overlay');
  if (el) el.remove();
}

function jumpToConcept(id) {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var concept = kb.concepts.find(function(c) { return c.id === id; });
  if (concept) {
    selectModule(concept.module);
    conceptIndex = currentConcepts.findIndex(function(c) { return c.id === id; });
    renderConceptCard(concept);
    document.getElementById('main').scrollTop = 0;
  }
}
```

- [ ] **Step 2: Add stats modal CSS**

```css
.stats-body { width: 100%; max-width: 720px; }
.stat-modal-title { font-family: var(--font-heading); font-size: 22px; }
.stat-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; text-align: center;
}
.stat-card-num { font-size: 32px; font-weight: 600; }
.stat-card-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.stat-modules {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; margin-bottom: 16px;
}
.stat-section-label { font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary); margin-bottom: 12px; }
.stat-module-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 8px; font-size: 13px;
}
.stat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.stat-module-name { flex: 1; }
.stat-count { color: var(--text-secondary); }
.stat-low { color: var(--accent); font-size: 12px; }
.stat-weak-spots {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
}
.stat-weak-item {
  display: flex; gap: 12px; padding: 8px 0;
  border-bottom: 1px solid var(--border); font-size: 13px; cursor: pointer;
  color: var(--primary);
}
.stat-weak-item:last-child { border-bottom: none; }
.stat-weak-id { color: var(--text-secondary); flex-shrink: 0; min-width: 32px; }
```

---

## Task 7: Search + Keyboard Shortcuts

**Files:**
- Modify: `index.html` — add search input HTML and JS

- [ ] **Step 1: Add search input to header HTML**

```html
<div class="search-wrap">
  <input type="text" id="search-input" class="search-input"
    placeholder="Search... (press /)" autocomplete="off" spellcheck="false">
  <div class="search-results hidden" id="search-results"></div>
</div>
```

- [ ] **Step 2: Add search CSS**

```css
.search-wrap { position: relative; flex: 1; max-width: 300px; }
.search-input {
  width: 100%; padding: 8px 12px 8px 36px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text);
  font-family: var(--font-body); font-size: 14px; outline: none;
}
.search-input:focus { border-color: var(--primary); }
.search-input::placeholder { color: var(--text-secondary); }
.search-results {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); max-height: 320px; overflow-y: auto;
  z-index: 200; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.search-results.hidden { display: none; }
.search-result-item {
  padding: 10px 14px; font-size: 13px; cursor: pointer;
  border-bottom: 1px solid var(--border); transition: background 0.1s;
}
.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover,
.search-result-item.focused { background: var(--bg); }
.search-result-topic { color: var(--text); font-weight: 500; margin-bottom: 2px; }
.search-result-meta { font-size: 11px; color: var(--text-secondary); }
.search-no-results { padding: 12px 14px; font-size: 13px; color: var(--text-secondary); }
```

- [ ] **Step 3: Write `handleSearch(query)` function**

```javascript
function handleSearch(query) {
  var kb = JSON.parse(document.getElementById('kb').textContent);
  var results = document.getElementById('search-results');
  if (!query.trim()) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }
  var q = query.toLowerCase();
  var matches = kb.concepts.filter(function(c) {
    return c.topic.toLowerCase().indexOf(q) !== -1 ||
           c.id.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  if (matches.length === 0) {
    results.innerHTML = '<div class="search-no-results">No matches found</div>';
    results.classList.remove('hidden');
    return;
  }

  var html = matches.map(function(c) {
    return '<div class="search-result-item" data-id="' + c.id + '">' +
      '<div class="search-result-topic"></div>' +
      '<div class="search-result-meta"></div>' +
    '</div>';
  }).join('');

  results.innerHTML = html;
  results.classList.remove('hidden');

  results.querySelectorAll('.search-result-item').forEach(function(item) {
    var concept = kb.concepts.find(function(c) { return c.id === item.dataset.id; });
    // textContent for security
    item.querySelector('.search-result-topic').textContent = concept.topic;
    item.querySelector('.search-result-meta').textContent = concept.id + ' · Module ' + concept.module;
    item.onclick = function() {
      results.classList.add('hidden');
      document.getElementById('search-input').value = '';
      jumpToConcept(concept.id);
    };
  });
}
```

- [ ] **Step 4: Write keyboard shortcuts handler**

```javascript
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case '/':
      e.preventDefault();
      document.getElementById('search-input').focus();
      break;
    case 'q': case 'Q':
      startQuiz();
      break;
    case 'ArrowLeft':
      if (!document.getElementById('quiz-overlay').classList.contains('hidden')) return;
      navigate(-1);
      break;
    case 'ArrowRight':
      if (document.getElementById('quiz-overlay').classList.contains('hidden')) {
        navigate(1);
      }
      break;
    case '1': revealLayerByKey('L1'); break;
    case '2': revealLayerByKey('L2'); break;
    case '3': revealLayerByKey('L3'); break;
    case '4': revealLayerByKey('L4'); break;
    case 'l': case 'L': markCurrentConfidence('low'); break;
    case 'm': case 'M': markCurrentConfidence('med'); break;
    case 'h': case 'H': markCurrentConfidence('high'); break;
    case 'Escape':
      closeQuiz();
      closeStatsModal();
      break;
  }
});

function revealLayerByKey(key) {
  var el = document.querySelector('.layer[data-layer="' + key + '"]');
  if (el) el.querySelector('.layer-header').click();
}

function markCurrentConfidence(level) {
  var concept = currentConcepts[conceptIndex];
  if (concept) {
    saveConfidence(concept.id, level);
    var row = document.getElementById('conf-row-' + concept.id);
    if (row) {
      row.querySelectorAll('.confidence-btn').forEach(function(b) {
        b.classList.remove('selected','low','med','high');
        if (b.dataset.cf === level) b.classList.add('selected', level);
      });
    }
    renderModuleList();
    updateProgress();
  }
}
```

---

## Task 8: Initialization + Help Modal + Final Integration

**Files:**
- Modify: `index.html` — wiring init, help modal, "open in browser" test

- [ ] **Step 1: Write `initApp()` and wire all event listeners**

```javascript
function initApp() {
  renderModuleList();
  updateProgress();
  var state = loadState();
  selectModule(state.lastModule || 5); // Default to Module 5 (highest weight)

  // Wire buttons
  document.getElementById('btn-quiz').onclick = startQuiz;
  document.getElementById('btn-stats').onclick = renderStatsModal;
  document.getElementById('btn-help').onclick = renderHelpModal;

  // Search
  var searchInput = document.getElementById('search-input');
  searchInput.oninput = function() { handleSearch(searchInput.value); };
  searchInput.onblur = function() {
    var results = document.getElementById('search-results');
    setTimeout(function() { results.classList.add('hidden'); }, 200);
  };
  searchInput.onfocus = function() {
    if (searchInput.value) handleSearch(searchInput.value);
  };

  // Sidebar module clicks (event delegation)
  document.getElementById('module-list').onclick = function(e) {
    var btn = e.target.closest('.module-btn');
    if (btn) selectModule(parseInt(btn.dataset.module));
  };
}
```

- [ ] **Step 2: Write help modal**

```javascript
function renderHelpModal() {
  var shortcuts = [
    ['/', 'Focus search'],
    ['Q', 'Start quiz mode'],
    ['\u2190 / \u2192', 'Prev / next concept'],
    ['1-4', 'Reveal layer 1-4'],
    ['H / M / L', 'Mark confidence'],
    ['Esc', 'Close modal'],
  ];
  var html = shortcuts.map(function(row) {
    return '<div class="shortcut-row">' +
      '<kbd class="shortcut-key">' + row[0] + '</kbd>' +
      '<span class="shortcut-desc">' + row[1] + '</span>' +
    '</div>';
  }).join('');

  var modal = document.createElement('div');
  modal.className = 'quiz-overlay';
  modal.id = 'help-overlay';
  modal.innerHTML =
    '<div style="width:100%;max-width:520px">' +
      '<div class="quiz-header">' +
        '<h2 class="stat-modal-title">Keyboard Shortcuts</h2>' +
        '<button class="nav-btn" id="help-close">&#x2715;</button>' +
      '</div>' +
      '<div class="shortcuts-grid">' + html + '</div>' +
      '<div class="layer-guide">' +
        '<div class="stat-section-label">4-Layer Understanding</div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">1</span><span>What is it? — vivid story</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">2</span><span>Analogy — everyday comparison</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">3</span><span>Because — causal chain</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">4</span><span>Breaks — failure modes</span></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.querySelector('#help-close').onclick = function() { modal.remove(); };
}

function saveConfidence(conceptId, level) {
  var state = loadState();
  state.confidence = state.confidence || {};
  state.confidence[conceptId] = level;
  saveState(state);
}
```

- [ ] **Step 3: Add shortcuts CSS and close button style**

```css
.shortcuts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
.shortcut-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
}
.shortcut-key {
  background: var(--bg); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 4px;
  font-family: var(--font-mono); font-size: 13px; min-width: 44px;
  text-align: center; color: var(--text);
}
.shortcut-desc { font-size: 13px; color: var(--text-secondary); }
.layer-guide {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
}
.layer-guide-row {
  display: flex; align-items: center; gap: 12px;
  font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;
}
.layer-guide-row:last-child { margin-bottom: 0; }
.layer-guide-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--primary); color: #fff;
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
```

- [ ] **Step 4: Final browser test checklist**

Manually open `index.html` in Chrome/Firefox and verify:

- [ ] App loads without console errors
- [ ] Module list renders 6 modules with concept counts
- [ ] Clicking M5 shows concept cards for Module 5
- [ ] Tapping a layer reveals/hides content
- [ ] Confidence buttons (Low/Med/High) save and persist after reload
- [ ] Quiz Mode opens overlay, shows concepts, tracks confidence
- [ ] Search finds concepts by topic name and Q-number
- [ ] Stats modal shows correct counts and weak spots
- [ ] Weak spot click jumps to that concept
- [ ] Keyboard shortcuts work (`Q`, `/`, arrows, `1-4`, `Esc`)
- [ ] Mobile layout shows tabbed module list at top
- [ ] LocalStorage persists state after browser restart

- [ ] **Step 5: Commit**

```bash
git add index.html README.md
git commit -m "feat: complete ICT304 Concept Explorer

Single-file offline HTML study app for ICT304 exam prep.
- 104 concepts from 104Q with 4-layer understanding cards
- Module browser + progress tracking via LocalStorage
- Quiz mode with spaced retrieval (low-confidence priority)
- Search + keyboard shortcuts
- ADHD+dyslexia-friendly dark academic design
- Strictly offline, zero dependencies"
```
