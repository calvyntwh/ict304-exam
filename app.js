// ─── Database Layer ───────────────────────────────────────────────────────────
var DB = null;

async function initDB() {
  return new Promise(function(resolve, reject) {
    initSqlJs({
      locateFile: function(file) { return 'sql-wasm/' + file; }
    }).then(function(SQL) {
      fetch('kb_all.db?t=' + Date.now()).then(function(resp) {
        if (!resp.ok) throw new Error('kb_all.db not found — make sure it is in the same directory as index.html');
        return resp.arrayBuffer();
      }).then(function(buf) {
        DB = new SQL.Database(new Uint8Array(buf));
        console.log('[DB] Loaded kb_all.db');
        resolve();
      }).catch(reject);
    }).catch(reject);
  });
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  // Process tables first (they contain | chars that would break other patterns)
  // Match entire markdown table block (all rows in one unit) before processing
  // Pattern: a line starting with |, followed by any number of complete table rows (lines starting with |)
  text = text.replace(/(\|(?:[^\n]*\|[^\n]*)+(?:\r?\n(?=\|)[^\n]*\|[^\n]*)*)(?=\r?\n|$)/g, function(match) {
    var rows = match.trim().split(/\r?\n/);
    var html = '<table class="md-table">';
    rows.forEach(function(row, i) {
      var cells = row.split('|').filter(function(c) { return c.trim(); });
      // Skip separator rows like |---|---|
      if (i === 1 && cells.length > 0 && cells.every(function(c) { return /^[-:\s|]+$/.test(c); })) return;
      var tag = i === 0 ? 'th' : 'td';
      html += '<tr>';
      cells.forEach(function(cell) { html += '<' + tag + '>' + cell.trim() + '</' + tag + '>'; });
      html += '</tr>';
    });
    return html + '</table>';
  });
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (not inside words)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

function dbQuery(sql, params) {
  if (!DB) throw new Error('DB not initialized');
  var stmt = DB.prepare(sql);
  if (params) stmt.bind(params);
  var results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

// ─── KB Query Helpers ────────────────────────────────────────────────────────

function getConcepts(module) {
  if (module) return dbQuery('SELECT * FROM concepts WHERE module = ? ORDER BY id', [module]);
  return dbQuery('SELECT * FROM concepts ORDER BY id');
}

function getConcept(id) {
  var r = dbQuery('SELECT * FROM concepts WHERE id = ?', [id]);
  return r[0] || null;
}

function getDiagramPath(conceptId) {
  var r = dbQuery('SELECT png_path FROM diagrams WHERE concept_id = ?', [conceptId]);
  return r[0] ? r[0].png_path : null;
}

function parseMCQ(concept) {
  if (!concept.mcq_options) return null;
  try {
    return {
      question: concept.mcq_question || '',
      options: JSON.parse(concept.mcq_options),
      correct: concept.mcq_correct || 0
    };
  } catch (e) { return null; }
}

// ─── State Management ────────────────────────────────────────────────────────

var STORAGE_KEY = 'ict304_study_app_v2';

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveConfidence(conceptId, level) {
  var state = loadState();
  state.confidence = state.confidence || {};
  state.confidence[conceptId] = level;
  saveState(state);
}

function saveMCQAnswer(conceptId, correct) {
  var state = loadState();
  state.mcq_answers = state.mcq_answers || {};
  state.mcq_answers[conceptId] = { correct: correct, attempted_at: Date.now() };
  saveState(state);
}

function getMCQAnswer(conceptId) {
  var state = loadState();
  return (state.mcq_answers || {})[conceptId] || null;
}

// ─── App State ───────────────────────────────────────────────────────────────

var currentModule = null;
var conceptIndex = 0;
var currentConcepts = [];

// ─── Render: Module List ────────────────────────────────────────────────────

function confDotColor(conf) {
  var total = conf.l + conf.m + conf.h;
  if (total === 0) return 'var(--text-secondary)';
  if (conf.l / total > 0.5) return 'var(--accent)';
  if (conf.h / total > 0.5) return 'var(--success)';
  return 'var(--text-secondary)';
}

function renderModuleList() {
  var state = loadState();
  var allConcepts = getConcepts();
  var moduleNames = ['AI Foundations', 'ML Systems', 'System Engineering',
                     'Model Eval', 'Deployment', 'Responsible AI'];

  var counts = {1:0,2:0,3:0,4:0,5:0,6:0};
  var confCounts = {1:{l:0,m:0,h:0},2:{l:0,m:0,h:0},3:{l:0,m:0,h:0},
                    4:{l:0,m:0,h:0},5:{l:0,m:0,h:0},6:{l:0,m:0,h:0}};
  allConcepts.forEach(function(c) { counts[c.module]++; });
  if (state.confidence) {
    allConcepts.forEach(function(c) {
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
    var btn = document.createElement('button');
    btn.className = 'module-btn' + (state.lastModule === n ? ' active' : '');
    btn.dataset.module = n;
    btn.innerHTML =
      '<span class="module-dot" style="background:var(--m' + n + ')"></span>' +
      '<span class="module-name">M' + n + ' ' + name + '</span>' +
      '<span class="module-count">' + counts[n] + '</span>';
    container.appendChild(btn);
  });

  container.onclick = function(e) {
    var btn = e.target.closest('.module-btn');
    if (btn) selectModule(parseInt(btn.dataset.module));
  };
}

// ─── Render: Progress ────────────────────────────────────────────────────────

function updateProgress() {
  var state = loadState();
  var all = getConcepts();
  var total = all.length;
  var reviewed = all.filter(function(c) { return !!state.confidence[c.id]; }).length;
  var low = all.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
  var med = all.filter(function(c) { return state.confidence[c.id] === 'med'; }).length;
  var high = all.filter(function(c) { return state.confidence[c.id] === 'high'; }).length;
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

// ─── Navigate ───────────────────────────────────────────────────────────────

function selectModule(moduleNum) {
  currentModule = moduleNum;
  currentConcepts = getConcepts(moduleNum);
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
  document.getElementById('main').scrollTop = 0;
}

function navigate(dir) {
  conceptIndex = Math.max(0, Math.min(currentConcepts.length - 1, conceptIndex + dir));
  renderConceptCard(currentConcepts[conceptIndex]);
  document.getElementById('main').scrollTop = 0;
}

function updateNavButtons() {
  var prev = document.getElementById('nav-prev');
  var next = document.getElementById('nav-next');
  if (prev) prev.disabled = conceptIndex <= 0;
  if (next) next.disabled = conceptIndex >= currentConcepts.length - 1;
}

function jumpToConcept(id) {
  var concept = getConcept(id);
  if (!concept) return;
  currentModule = concept.module;
  currentConcepts = getConcepts(concept.module);
  conceptIndex = currentConcepts.findIndex(function(c) { return c.id === id; });
  if (conceptIndex < 0) conceptIndex = 0;
  renderConceptCard(concept);
  document.getElementById('main').scrollTop = 0;
}

// ─── Render: Concept Card ────────────────────────────────────────────────────

function attachLayerListeners(layerEls) {
  layerEls.forEach(function(layer) {
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
        b.classList.remove('selected', 'low', 'med', 'high');
      });
      btn.classList.add('selected', level);
      renderModuleList();
      updateProgress();
    });
  });
}

function attachNavListeners() {
  var prev = document.getElementById('nav-prev');
  var next = document.getElementById('nav-next');
  var quizThis = document.getElementById('nav-quiz-this');
  if (prev) prev.onclick = function() { navigate(-1); };
  if (next) next.onclick = function() { navigate(1); };
  if (quizThis) {
    quizThis.onclick = function() {
      var state = loadState();
      var concept = currentConcepts[conceptIndex];
      // Isolate "Quiz This" from the main quiz session
      state.singleQuizId = concept.id;
      delete state.quiz;
      saveState(state);
      showQuizOverlay();
      renderQuizCard();
    };
  }
}

function renderConceptCard(concept) {
  var state = loadState();
  var conf = (state.confidence || {})[concept.id] || null;
  var card = document.getElementById('concept-card');
  var mcq = parseMCQ(concept);
  var diagramPath = getDiagramPath(concept.id);
  var mcqAnswer = getMCQAnswer(concept.id);
  var mcqAnswered = !!(mcqAnswer && mcqAnswer.answered);
  var wasCorrect = mcqAnswer && mcqAnswer.correct;

  // Regular layers L1-L4 (L5 is separate exam answer section)
  var regularLayers = ['L1','L2','L3','L4'];
  var layerLabels = {
    L1: 'What is it?',
    L2: 'Real-world analogy',
    L3: 'Because...',
    L4: 'Where it breaks'
  };

  var layersHtml = regularLayers.map(function(key) {
    var content = concept[key] || '';
    if (!content) return '';
    return '<div class="layer" data-layer="' + key + '">' +
      '<div class="layer-header">' +
        '<span class="layer-label">' + layerLabels[key] + '</span>' +
        '<button class="layer-toggle">[ reveal ]</button>' +
      '</div>' +
      '<div class="layer-content"></div>' +
    '</div>';
  }).join('');

  // MCQ badge states: ? (unanswered), ✓ (correct), ✗ (wrong)
  var badgeChar = mcqAnswered ? (wasCorrect ? '\u2713' : '\u2717') : '?';
  var badgeClass = mcqAnswered
    ? (wasCorrect ? 'mcq-badge-correct' : 'mcq-badge-wrong')
    : '';

  var mcqBadgeHtml =
    '<span class="mcq-badge ' + badgeClass + '" id="mcq-badge-' + concept.id + '" ' +
    'title="MCQ Practice" style="cursor:pointer">' + badgeChar + '</span>';

  var mcqBtnHtml = mcq
    ? '<button class="mcq-btn" id="mcq-btn-' + concept.id + '">MCQ Practice</button>'
    : '';

  // Layers locked until MCQ answered
  var layersContainerClass = 'layers' + (mcqAnswered ? '' : ' layers-locked');
  var layersLockedNote = !mcqAnswered
    ? '<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-bottom:8px">Answer MCQ first to unlock layers</div>'
    : '';

  // Diagram section
  var diagramHtml = '';
  if (diagramPath) {
    diagramHtml =
      '<div class="diagram-section" id="diagram-section-' + concept.id + '">' +
        '<button class="diagram-btn" id="diagram-btn-' + concept.id + '">[ Show Diagram ]</button>' +
        '<div class="diagram-content" id="diagram-content-' + concept.id + '"></div>' +
      '</div>';
  }

  // L5 exam answer section (always visible, separate from layers)
  var examAnswerHtml = '';
  if (concept.L5) {
    examAnswerHtml =
      '<div class="exam-answer-section" id="exam-answer-section-' + concept.id + '">' +
        '<button class="exam-answer-btn" id="exam-answer-btn-' + concept.id + '">[ Show Exam Answer — full Q&amp;A ]</button>' +
        '<div class="exam-answer-content" id="exam-answer-content-' + concept.id + '"></div>' +
      '</div>';
  }

  card.innerHTML =
    '<div class="concept-header">' +
      '<div class="concept-meta">' +
        '<span class="concept-badge" style="color:var(--m' + concept.module + ')">Module ' + concept.module + '</span>' +
        '<span class="concept-badge">' + concept.id + '</span>' +
        mcqBadgeHtml +
        mcqBtnHtml +
      '</div>' +
      '<h2 class="concept-topic"></h2>' +
    '</div>' +

    // MCQ inline widget container (hidden by default)
    '<div class="mcq-container" id="mcq-container-' + concept.id + '"></div>' +

    // Layers (locked until MCQ answered)
    '<div class="' + layersContainerClass + '" id="layers-' + concept.id + '">' +
      layersLockedNote +
      layersHtml +
    '</div>' +

    examAnswerHtml +
    diagramHtml +

    // Confidence row
    '<div class="confidence-row" id="conf-row-' + concept.id + '">' +
      '<span style="font-size:13px;color:var(--text-secondary)">How confident?</span>' +
      '<button class="confidence-btn" data-cf="low">&#x1F534; Low</button>' +
      '<button class="confidence-btn" data-cf="med">&#x1F7E1; Med</button>' +
      '<button class="confidence-btn" data-cf="high">&#x1F7E2; High</button>' +
    '</div>' +

    // Navigation
    '<div class="card-nav">' +
      '<button class="nav-btn" id="nav-prev">&larr; Prev</button>' +
      '<button class="btn btn-primary" id="nav-quiz-this">Quiz This</button>' +
      '<button class="nav-btn" id="nav-next">Next &rarr;</button>' +
    '</div>';

  // textContent for concept topic (XSS security)
  card.querySelector('.concept-topic').textContent = concept.topic;

  // Set layer content (L1-L4 only)
  var layerEls = card.querySelectorAll('.layer');
  regularLayers.forEach(function(key, i) {
    if (!concept[key]) return;
    layerEls[i].querySelector('.layer-content').textContent = concept[key];
  });

  // L5 exam answer content
  if (concept.L5) {
    var examContent = document.getElementById('exam-answer-content-' + concept.id);
    if (examContent) examContent.innerHTML = renderMarkdown(concept.L5);
    var examBtn = document.getElementById('exam-answer-btn-' + concept.id);
    if (examBtn) {
      examBtn.addEventListener('click', function() {
        var content = document.getElementById('exam-answer-content-' + concept.id);
        var btn = document.getElementById('exam-answer-btn-' + concept.id);
        if (content.classList.contains('expanded')) {
          content.classList.remove('expanded');
          btn.textContent = '[ Show Exam Answer — full Q&A ]';
        } else {
          content.classList.add('expanded');
          btn.textContent = '[ Hide Exam Answer ]';
        }
      });
    }
  }

  // Set confidence button state
  if (conf) {
    var btn = card.querySelector('[data-cf="' + conf + '"]');
    if (btn) btn.classList.add('selected', conf);
  }

  // Diagram toggle
  if (diagramPath) {
    var diagBtn = document.getElementById('diagram-btn-' + concept.id);
    var diagContent = document.getElementById('diagram-content-' + concept.id);
    if (diagBtn && diagContent) {
      diagBtn.addEventListener('click', function() {
        if (diagContent.classList.contains('diagram-expanded')) {
          diagContent.classList.remove('diagram-expanded');
          diagBtn.textContent = '[ Show Diagram ]';
        } else {
          // Lazy-load image
          if (!diagContent.querySelector('img')) {
            var img = document.createElement('img');
            img.className = 'diagram-img';
            img.src = diagramPath;
            img.alt = 'Diagram for ' + concept.topic;
            diagContent.appendChild(img);
          }
          diagContent.classList.add('diagram-expanded');
          diagBtn.textContent = '[ Hide Diagram ]';
        }
      });
    }
  }

  // MCQ badge click → toggle widget
  var mcqBadge = document.getElementById('mcq-badge-' + concept.id);
  var mcqContainer = document.getElementById('mcq-container-' + concept.id);
  var mcqToggleBtn = document.getElementById('mcq-btn-' + concept.id);

  function openMCQWidget() {
    if (!mcq || mcqAnswered) return;
    renderMCQWidget(mcqContainer, concept, mcq);
    mcqContainer.classList.add('mcq-open');
    if (mcqToggleBtn) mcqToggleBtn.textContent = 'Hide MCQ';
  }

  function closeMCQWidget() {
    mcqContainer.classList.remove('mcq-open');
    mcqContainer.innerHTML = '';
    if (mcqToggleBtn) mcqToggleBtn.textContent = 'MCQ Practice';
  }

  if (mcqBadge) {
    mcqBadge.addEventListener('click', function() {
      if (mcqContainer.classList.contains('mcq-open')) {
        closeMCQWidget();
      } else {
        openMCQWidget();
      }
    });
  }

  if (mcqToggleBtn && !mcqAnswered) {
    mcqToggleBtn.addEventListener('click', function() {
      if (mcqContainer.classList.contains('mcq-open')) {
        closeMCQWidget();
      } else {
        openMCQWidget();
      }
    });
  }

  // If MCQ already answered, render widget inline so user can review
  if (mcqAnswered && mcq) {
    renderMCQWidget(mcqContainer, concept, mcq);
    mcqContainer.classList.add('mcq-open');
    if (mcqToggleBtn) mcqToggleBtn.style.display = 'none';
  }

  attachLayerListeners(layerEls);
  attachConfidenceListeners(concept);
  attachNavListeners();
  updateNavButtons();
}

// ─── MCQ Widget ─────────────────────────────────────────────────────────────

function renderMCQWidget(container, concept, mcq) {
  // Seeded shuffle so correct answer isn't always in the same position
  var shuffled = mcq.options.slice();
  var seed = concept.id.split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0);
  var rng = function(n) { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = rng(i + 1);
    var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }

  // Find correct answer position in shuffled array
  var correctAnswerText = mcq.options[mcq.correct];
  var correctIdx = shuffled.indexOf(correctAnswerText);

  var existingAnswer = getMCQAnswer(concept.id);
  var wasAnswered = !!(existingAnswer && existingAnswer.answered);
  var letters = ['A', 'B', 'C', 'D'];

  // Build option elements using DOM (no innerHTML for user content)
  var optionsContainer = document.createElement('div');
  shuffled.forEach(function(opt, idx) {
    var label = document.createElement('label');
    label.className = 'mcq-option';
    label.dataset.idx = String(idx);

    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mcq-' + concept.id;
    radio.value = String(idx);
    if (wasAnswered) radio.disabled = true;

    var letterSpan = document.createElement('span');
    letterSpan.className = 'mcq-letter';
    letterSpan.textContent = letters[idx];

    var textSpan = document.createElement('span');
    textSpan.className = 'mcq-text';
    // textContent for user content (XSS security)
    textSpan.textContent = opt;

    label.appendChild(radio);
    label.appendChild(letterSpan);
    label.appendChild(textSpan);
    optionsContainer.appendChild(label);
  });

  container.innerHTML =
    '<div class="mcq-widget" id="mcq-widget-' + concept.id + '">' +
      '<div class="mcq-question"></div>' +
      '<div class="mcq-options"></div>' +
      '<div class="mcq-feedback hidden" id="mcq-feedback-' + concept.id + '"></div>' +
      '<div class="mcq-actions">' +
        '<button class="mcq-check-btn" id="mcq-check-' + concept.id + '"' +
          (wasAnswered ? ' disabled' : '') + '>' +
          (wasAnswered ? 'Answered' : 'Check Answer') +
        '</button>' +
      '</div>' +
    '</div>';

  // textContent for question (XSS security)
  container.querySelector('.mcq-question').textContent = mcq.question;
  container.querySelector('.mcq-options').appendChild(optionsContainer);

  // Apply answered styles if already done
  if (wasAnswered) {
    var optionEls = container.querySelectorAll('.mcq-option');
    optionEls.forEach(function(opt) {
      var idx = parseInt(opt.dataset.idx, 10);
      opt.classList.add('mcq-answered');
      if (idx === correctIdx) opt.classList.add('mcq-correct');
    });
    var fb = document.getElementById('mcq-feedback-' + concept.id);
    fb.classList.remove('hidden');
    fb.innerHTML = existingAnswer.correct
      ? '<span class="mcq-correct-msg">Correct!</span> Layers unlocked below.'
      : '<span class="mcq-wrong-msg">Not quite.</span> Correct answer is highlighted above.';
  }

  // Check button handler
  var checkBtn = document.getElementById('mcq-check-' + concept.id);
  checkBtn.addEventListener('click', function() {
    var selected = container.querySelector('input[type="radio"]:checked');
    if (!selected) {
      var fb = document.getElementById('mcq-feedback-' + concept.id);
      fb.textContent = 'Please select an answer first.';
      fb.classList.remove('hidden');
      return;
    }
    var selectedIdx = parseInt(selected.value, 10);
    var isCorrect = (selectedIdx === correctIdx);
    saveMCQAnswer(concept.id, isCorrect);

    var optionEls = container.querySelectorAll('.mcq-option');
    optionEls.forEach(function(opt) {
      var idx = parseInt(opt.dataset.idx, 10);
      opt.classList.add('mcq-answered');
      opt.querySelector('input').disabled = true;
      if (idx === correctIdx) opt.classList.add('mcq-correct');
      else if (idx === selectedIdx && !isCorrect) opt.classList.add('mcq-wrong');
    });

    var fb = document.getElementById('mcq-feedback-' + concept.id);
    fb.innerHTML = isCorrect
      ? '<span class="mcq-correct-msg">Correct!</span> Layers unlocked below.'
      : '<span class="mcq-wrong-msg">Not quite.</span> Correct answer is highlighted above.';
    fb.classList.remove('hidden');
    checkBtn.textContent = 'Answered';
    checkBtn.disabled = true;

    // Update badge
    var badge = document.getElementById('mcq-badge-' + concept.id);
    if (badge) {
      badge.textContent = isCorrect ? '\u2713' : '\u2717';
      badge.className = 'mcq-badge ' + (isCorrect ? 'mcq-badge-correct' : 'mcq-badge-wrong');
    }

    // Unlock layers
    var layersContainer = document.getElementById('layers-' + concept.id);
    if (layersContainer) {
      layersContainer.classList.remove('layers-locked');
      // Remove the "Answer MCQ first" note
      var note = layersContainer.querySelector('div[style*="italic"]');
      if (note) note.remove();
    }
    var layerBtns = layersContainer ? layersContainer.querySelectorAll('.layer-toggle') : [];
    layerBtns.forEach(function(btn) { btn.disabled = false; btn.style.opacity = ''; });

    // Hide MCQ toggle button (already answered)
    var mcqToggleBtn = document.getElementById('mcq-btn-' + concept.id);
    if (mcqToggleBtn) mcqToggleBtn.style.display = 'none';
  });
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

var QUIZ_SESSION_SIZE = 20;

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function startQuiz() {
  var state = loadState();
  state.confidence = state.confidence || {};
  // Clear any stray "Quiz This" state before starting a full session
  delete state.singleQuizId;
  var all = getConcepts();
  var low = all.filter(function(c) { return state.confidence[c.id] === 'low'; });
  var med = all.filter(function(c) { return state.confidence[c.id] === 'med'; });
  var unvisited = all.filter(function(c) { return !state.confidence[c.id]; });
  // Prioritise low > med > unvisited; shuffle within each tier
  var queue = shuffle(low.slice()).concat(shuffle(med.slice())).concat(shuffle(unvisited.slice())).slice(0, QUIZ_SESSION_SIZE);
  state.quiz = {
    queue: queue.map(function(c) { return c.id; }),
    index: 0,
    sessionSize: Math.min(QUIZ_SESSION_SIZE, queue.length)
  };
  saveState(state);
  document.getElementById('quiz-overlay').classList.remove('hidden');
  renderQuizCard();
}

function showQuizOverlay() {
  document.getElementById('quiz-overlay').classList.remove('hidden');
}

function renderQuizCard() {
  var state = loadState();
  var overlay = document.getElementById('quiz-overlay');

  // "Quiz This" mode — single concept, isolated from main quiz session
  if (state.singleQuizId) {
    var concept = getConcept(state.singleQuizId);
    if (!concept) {
      closeQuiz();
      return;
    }
    var answerText = [concept.L1, concept.L2, concept.L3, concept.L4].filter(Boolean).join('\n---\n');
    if (concept.L5) {
      answerText += '\n\n[ EXAM ANSWER ]\n' + concept.L5;
    }
    overlay.innerHTML =
      '<div class="quiz-header">' +
        '<div><div class="quiz-progress-label">Quiz This</div></div>' +
        '<button class="nav-btn" id="quiz-close-btn">&#x2715; Close</button>' +
      '</div>' +
      '<div class="quiz-card">' +
        '<div class="quiz-topic"></div>' +
        '<div class="quiz-meta">Module ' + concept.module + ' &middot; ' + concept.id + '</div>' +
        '<div class="quiz-reveal-area" id="quiz-reveal-area">' +
          '<button class="quiz-reveal-btn" id="quiz-reveal-btn">Try to recall before revealing!</button>' +
        '</div>' +
        '<div class="quiz-answer" id="quiz-answer">' +
          '<div class="quiz-answer-text" id="quiz-answer-text"></div>' +
          '<div class="confidence-row" id="quiz-conf-row">' +
            '<span style="font-size:13px;color:var(--text-secondary)">Your confidence:</span>' +
            '<button class="confidence-btn" data-qcf="low">&#x1F534; Low</button>' +
            '<button class="confidence-btn" data-qcf="med">&#x1F7E1; Med</button>' +
            '<button class="confidence-btn" data-qcf="high">&#x1F7E2; High</button>' +
          '</div>' +
          '<div class="quiz-actions">' +
            '<button class="quiz-reveal-btn" id="quiz-next-btn">Done — Back to Explorer</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    // textContent for user content (XSS security)
    overlay.querySelector('.quiz-topic').textContent = concept.topic;
    overlay.querySelector('.quiz-answer-text').textContent = answerText;

    document.getElementById('quiz-close-btn').onclick = closeQuiz;
    document.getElementById('quiz-reveal-btn').onclick = function() {
      document.getElementById('quiz-reveal-area').style.display = 'none';
      document.getElementById('quiz-answer').classList.add('visible');
    };
    document.getElementById('quiz-next-btn').onclick = function() {
      var selected = overlay.querySelector('[data-qcf].selected');
      if (selected) saveConfidence(concept.id, selected.dataset.qcf);
      closeQuiz();
    };
    overlay.querySelectorAll('[data-qcf]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        overlay.querySelectorAll('[data-qcf]').forEach(function(b) {
          b.classList.remove('selected', 'low', 'med', 'high');
        });
        btn.classList.add('selected', btn.dataset.qcf);
      });
    });
    return;
  }

  // Session complete
  if (!state.quiz || !state.quiz.queue || state.quiz.index >= state.quiz.queue.length) {
    var sessionSize = state.quiz ? state.quiz.sessionSize : 0;
    overlay.innerHTML =
      '<div class="quiz-complete">' +
        '<h2>Session Complete!</h2>' +
        '<p>You reviewed ' + sessionSize + ' concepts.</p>' +
        '<button class="btn btn-primary" id="quiz-done-btn">Back to Explorer</button>' +
      '</div>';
    document.getElementById('quiz-done-btn').onclick = closeQuiz;
    return;
  }

  var conceptId = state.quiz.queue[state.quiz.index];
  var concept = getConcept(conceptId);
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
      '<button class="nav-btn" id="quiz-close-btn">&#x2715; Close</button>' +
    '</div>' +
    '<div class="quiz-card">' +
      '<div class="quiz-topic"></div>' +
      '<div class="quiz-meta">Module ' + concept.module + ' &middot; ' + concept.id + '</div>' +
      '<div class="quiz-reveal-area" id="quiz-reveal-area">' +
        '<button class="quiz-reveal-btn" id="quiz-reveal-btn">Try to recall before revealing!</button>' +
      '</div>' +
      '<div class="quiz-answer" id="quiz-answer">' +
        '<div class="quiz-answer-text" id="quiz-answer-text"></div>' +
        '<div class="confidence-row" id="quiz-conf-row">' +
          '<span style="font-size:13px;color:var(--text-secondary)">Your confidence:</span>' +
          '<button class="confidence-btn" data-qcf="low">&#x1F534; Low</button>' +
          '<button class="confidence-btn" data-qcf="med">&#x1F7E1; Med</button>' +
          '<button class="confidence-btn" data-qcf="high">&#x1F7E2; High</button>' +
        '</div>' +
        '<div class="quiz-actions">' +
          '<button class="quiz-reveal-btn" id="quiz-next-btn">Next &rarr;</button>' +
          '<button class="quiz-skip-btn" id="quiz-skip-btn">Skip</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  overlay.querySelector('.quiz-topic').textContent = concept.topic;

  var answerText = [concept.L1, concept.L2, concept.L3, concept.L4].filter(Boolean).join('\n---\n');
  if (concept.L5) {
    answerText += '\n\n[ EXAM ANSWER ]\n' + concept.L5;
  }
  overlay.querySelector('.quiz-answer-text').textContent = answerText;

  document.getElementById('quiz-close-btn').onclick = closeQuiz;
  document.getElementById('quiz-reveal-btn').onclick = function() {
    document.getElementById('quiz-reveal-area').style.display = 'none';
    document.getElementById('quiz-answer').classList.remove('hidden');
  };
  document.getElementById('quiz-next-btn').onclick = function() {
    var selected = overlay.querySelector('[data-qcf].selected');
    if (selected) saveConfidence(concept.id, selected.dataset.qcf);
    advanceQuiz();
  };
  document.getElementById('quiz-skip-btn').onclick = function() { advanceQuiz(); };

  overlay.querySelectorAll('[data-qcf]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      overlay.querySelectorAll('[data-qcf]').forEach(function(b) {
        b.classList.remove('selected', 'low', 'med', 'high');
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
  var state = loadState();
  delete state.singleQuizId;
  delete state.quiz;
  saveState(state);
  document.getElementById('quiz-overlay').classList.add('hidden');
  renderModuleList();
  updateProgress();
}

// ─── Stats Modal ────────────────────────────────────────────────────────────

function renderStatsModal() {
  var state = loadState();
  var all = getConcepts();
  var total = all.length;
  var reviewed = all.filter(function(c) { return !!state.confidence[c.id]; }).length;
  var low = all.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
  var med = all.filter(function(c) { return state.confidence[c.id] === 'med'; }).length;
  var high = all.filter(function(c) { return state.confidence[c.id] === 'high'; }).length;
  var weakSpots = all.filter(function(c) { return state.confidence[c.id] === 'low'; });
  var retentionPct = reviewed > 0 ? Math.round(((reviewed - low) / reviewed) * 100) : 0;

  var moduleNames = ['AI Foundations', 'ML Systems', 'System Engineering',
                     'Model Eval', 'Deployment', 'Responsible AI'];
  var moduleRows = [1,2,3,4,5,6].map(function(n) {
    var mods = all.filter(function(c) { return c.module === n; });
    var rev = mods.filter(function(c) { return !!state.confidence[c.id]; });
    var lowN = mods.filter(function(c) { return state.confidence[c.id] === 'low'; }).length;
    return '<div class="stat-module-row">' +
      '<span class="stat-dot" style="background:var(--m' + n + ')"></span>' +
      '<span class="stat-module-name">M' + n + ' ' + moduleNames[n-1] + '</span>' +
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
            '<span class="stat-weak-topic"></span></div>';
        }).join('') + '</div>'
    : '<div style="font-size:13px;color:var(--text-secondary);padding:12px 0">No weak spots yet — keep studying!</div>';

  var overlay = document.createElement('div');
  overlay.className = 'quiz-overlay';
  overlay.id = 'stats-overlay';
  overlay.innerHTML =
    '<div class="quiz-header">' +
      '<h2 class="stat-modal-title">Study Stats</h2>' +
      '<button class="nav-btn" id="stats-close-btn">&#x2715;</button>' +
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

  document.body.appendChild(overlay);

  // textContent for weak spot topics (XSS security)
  overlay.querySelectorAll('.stat-weak-topic').forEach(function(el, i) {
    el.textContent = weakSpots[i] ? weakSpots[i].topic : '';
  });

  overlay.querySelector('#stats-close-btn').onclick = function() { overlay.remove(); };
  overlay.querySelectorAll('.stat-weak-item').forEach(function(item) {
    item.onclick = function() {
      overlay.remove();
      jumpToConcept(item.dataset.jump);
    };
  });
}

function closeStatsModal() {
  var el = document.getElementById('stats-overlay');
  if (el) el.remove();
}

// ─── Help Modal ─────────────────────────────────────────────────────────────

function renderHelpModal() {
  var shortcuts = [
    ['/', 'Focus search'],
    ['Q', 'Start quiz mode'],
    ['\u2190 / \u2192', 'Prev / next concept'],
    ['1-4', 'Reveal layer 1-4'],
    ['M', 'Toggle MCQ widget'],
    [',', 'Mark confidence: med'],
    ['L', 'Mark confidence: low'],
    ['H', 'Mark confidence: high'],
    ['Esc', 'Close modal'],
  ];
  var html = shortcuts.map(function(row) {
    return '<div class="shortcut-row">' +
      '<kbd class="shortcut-key">' + row[0] + '</kbd>' +
      '<span class="shortcut-desc">' + row[1] + '</span>' +
    '</div>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.className = 'quiz-overlay';
  overlay.id = 'help-overlay';
  overlay.innerHTML =
    '<div style="width:100%;max-width:520px">' +
      '<div class="quiz-header">' +
        '<h2 class="stat-modal-title">Keyboard Shortcuts</h2>' +
        '<button class="nav-btn" id="help-close-btn">&#x2715;</button>' +
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
  document.body.appendChild(overlay);
  overlay.querySelector('#help-close-btn').onclick = function() { overlay.remove(); };
}

// ─── Search ─────────────────────────────────────────────────────────────────

function handleSearch(query) {
  var results = document.getElementById('search-results');
  if (!query.trim()) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }
  var q = query.toLowerCase();
  var all = getConcepts();
  var matches = all.filter(function(c) {
    return c.topic.toLowerCase().indexOf(q) !== -1 || c.id.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  if (matches.length === 0) {
    results.innerHTML = '<div class="search-no-results">No matches found</div>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = matches.map(function(c) {
    return '<div class="search-result-item" data-id="' + c.id + '">' +
      '<div class="search-result-topic"></div>' +
      '<div class="search-result-meta"></div>' +
    '</div>';
  }).join('');
  results.classList.remove('hidden');

  results.querySelectorAll('.search-result-item').forEach(function(item) {
    var concept = getConcept(item.dataset.id);
    // textContent for user content (XSS security)
    item.querySelector('.search-result-topic').textContent = concept.topic;
    item.querySelector('.search-result-meta').textContent = concept.id + ' · Module ' + concept.module;
    item.onclick = function() {
      results.classList.add('hidden');
      document.getElementById('search-input').value = '';
      jumpToConcept(concept.id);
    };
  });
}

function markCurrentConfidence(level) {
  var concept = currentConcepts[conceptIndex];
  if (!concept) return;
  saveConfidence(concept.id, level);
  var row = document.getElementById('conf-row-' + concept.id);
  if (row) {
    row.querySelectorAll('.confidence-btn').forEach(function(b) {
      b.classList.remove('selected', 'low', 'med', 'high');
      if (b.dataset.cf === level) b.classList.add('selected', level);
    });
  }
  renderModuleList();
  updateProgress();
}

function revealLayerByKey(key) {
  var el = document.querySelector('.layer[data-layer="' + key + '"]');
  if (el) el.querySelector('.layer-header').click();
}

function toggleMCQWidget() {
  if (currentConcepts.length === 0) return;
  var concept = currentConcepts[conceptIndex];
  var mcqContainer = document.getElementById('mcq-container-' + concept.id);
  var mcqBtn = document.getElementById('mcq-btn-' + concept.id);
  if (!mcqContainer) return;
  if (mcqContainer.classList.contains('mcq-open')) {
    mcqContainer.classList.remove('mcq-open');
    mcqContainer.innerHTML = '';
    if (mcqBtn) mcqBtn.textContent = 'MCQ Practice';
  } else {
    var mcq = parseMCQ(concept);
    var mcqAnswer = getMCQAnswer(concept.id);
    if (mcq && !(mcqAnswer && mcqAnswer.answered)) {
      renderMCQWidget(mcqContainer, concept, mcq);
      mcqContainer.classList.add('mcq-open');
      if (mcqBtn) mcqBtn.textContent = 'Hide MCQ';
    }
  }
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case '/':
      e.preventDefault();
      document.getElementById('search-input').focus();
      break;
    case 'q': case 'Q':
      if (!document.getElementById('quiz-overlay').classList.contains('hidden')) return;
      startQuiz();
      break;
    case 'ArrowLeft':
      if (!document.getElementById('quiz-overlay').classList.contains('hidden')) return;
      navigate(-1);
      break;
    case 'ArrowRight':
      if (!document.getElementById('quiz-overlay').classList.contains('hidden')) return;
      navigate(1);
      break;
    case '1': revealLayerByKey('L1'); break;
    case '2': revealLayerByKey('L2'); break;
    case '3': revealLayerByKey('L3'); break;
    case '4': revealLayerByKey('L4'); break;
    case 'm': case 'M': toggleMCQWidget(); break;
    case ',': markCurrentConfidence('med'); break;
    case 'l': case 'L': markCurrentConfidence('low'); break;
    case 'h': case 'H': markCurrentConfidence('high'); break;
    case 'Escape':
      closeQuiz();
      closeStatsModal();
      var help = document.getElementById('help-overlay');
      if (help) help.remove();
      break;
  }
});

// ─── Init ───────────────────────────────────────────────────────────────────

async function initApp() {
  try {
    await initDB();
    document.getElementById('app-loading').style.display = 'none';
    document.getElementById('app').style.display = '';

    renderModuleList();
    updateProgress();
    var state = loadState();
    selectModule(state.lastModule || 5); // Default to M5 (highest exam weight)

    // Resume any in-progress quiz session (user left mid-quiz)
    // Skip sessionSize===1 — those are "Quiz This" sessions, not resumable
    if (state.singleQuizId || (state.quiz && state.quiz.queue && state.quiz.queue.length > 0 && state.quiz.sessionSize !== 1)) {
      showQuizOverlay();
      renderQuizCard();
    }

    // Wire header buttons
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

    // Navbar burger toggle (Bulma requires JS for mobile menu)
    var burger = document.getElementById('navbar-burger');
    var menu = document.getElementById('navbar-menu');
    if (burger && menu) {
      burger.addEventListener('click', function() {
        burger.classList.toggle('is-active');
        menu.classList.toggle('is-active');
      });
    }

  } catch (err) {
    document.getElementById('app-loading').innerHTML =
      '<p style="color:var(--danger)">Failed to load: ' + err.message + '</p>';
  }
}

window.addEventListener('DOMContentLoaded', initApp);
