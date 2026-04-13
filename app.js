// ─── Database Layer ────────────────────────────────────────────────────────────
var DB = null;

async function initDB() {
  return new Promise(function(resolve, reject) {
    initSqlJs({
      locateFile: function(file) { return 'sql-wasm/' + file; }
    }).then(function(SQL) {
      fetch('kb_all.db').then(function(resp) {
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

function getModuleStats() {
  return dbQuery('SELECT module, COUNT(*) as count FROM concepts GROUP BY module ORDER BY module');
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

// ─── App State ─────────────────────────────────────────────────────────────

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

  // Event delegation
  container.onclick = function(e) {
    var btn = e.target.closest('.module-btn');
    if (btn) selectModule(parseInt(btn.dataset.module));
  };
}

// ─── Render: Progress ───────────────────────────────────────────────────────

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

// ─── Render: Concept Card ───────────────────────────────────────────────────

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
      state.quiz = { queue: [concept.id], index: 0, sessionSize: 1 };
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
  var mcqAnswered = state.mcq_answers && state.mcq_answers[concept.id];

  var layersHtml = ['L1','L2','L3','L4','L5'].map(function(key) {
    var labels = {
      L1: 'What is it?',
      L2: 'Real-world analogy',
      L3: 'Because...',
      L4: 'Where it breaks',
      L5: 'Exam Answer'
    };
    var content = concept[key] || '';
    if (!content) return '';
    return '<div class="layer" data-layer="' + key + '">' +
      '<div class="layer-header">' +
        '<span class="layer-label">' + labels[key] + '</span>' +
        '<button class="layer-toggle">[ reveal ]</button>' +
      '</div>' +
      '<div class="layer-content"></div>' +
    '</div>';
  }).join('');

  var diagramHtml = '';
  if (diagramPath) {
    diagramHtml = '<button class="btn btn-ghost diagram-btn" id="diagram-btn">Show Diagram</button>' +
      '<div class="diagram-container hidden" id="diagram-container">' +
        '<img id="diagram-img" src="' + diagramPath + '" alt="Diagram">' +
      '</div>';
  }

  var mcqBadge = mcqAnswered
    ? '<span class="mcq-badge mcq-answered">MCQ ✓</span>'
    : (mcq ? '<button class="btn btn-ghost mcq-btn" id="mcq-btn">MCQ Practice</button>' : '');

  card.innerHTML =
    '<div class="concept-header">' +
      '<div class="concept-meta">' +
        '<span class="concept-badge" style="color:var(--m' + concept.module + ')">Module ' + concept.module + '</span>' +
        '<span class="concept-badge">' + concept.id + '</span>' +
        mcqBadge +
      '</div>' +
      '<h2 class="concept-topic"></h2>' +
    '</div>' +
    '<div class="layers">' + layersHtml + '</div>' +
    diagramHtml +
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
    '</div>' +
    '<div id="mcq-widget"></div>';

  // textContent for concept text (security)
  card.querySelector('.concept-topic').textContent = concept.topic;

  // Set layer content
  var layerEls = card.querySelectorAll('.layer');
  ['L1','L2','L3','L4','L5'].forEach(function(key, i) {
    if (!concept[key]) return;
    layerEls[i].querySelector('.layer-content').textContent = concept[key];
  });

  // Set confidence button state
  if (conf) {
    var btn = card.querySelector('[data-cf="' + conf + '"]');
    if (btn) btn.classList.add('selected', conf);
  }

  // Diagram toggle
  var diagBtn = document.getElementById('diagram-btn');
  var diagContainer = document.getElementById('diagram-container');
  if (diagBtn && diagContainer) {
    diagBtn.onclick = function() {
      diagContainer.classList.toggle('hidden');
      diagBtn.textContent = diagContainer.classList.contains('hidden') ? 'Show Diagram' : 'Hide Diagram';
    };
  }

  // MCQ widget
  if (mcq && !mcqAnswered) {
    var mcqBtn = document.getElementById('mcq-btn');
    var mcqWidget = document.getElementById('mcq-widget');
    if (mcqBtn && mcqWidget) {
      mcqBtn.onclick = function() { renderMCQWidget(mcqWidget, concept, mcq); };
    }
  }

  attachLayerListeners(layerEls);
  attachConfidenceListeners(concept);
  attachNavListeners();
  updateNavButtons();
}

// ─── MCQ Widget ─────────────────────────────────────────────────────────────

function renderMCQWidget(container, concept, mcq) {
  // Shuffle options so correct isn't always first
  var options = mcq.options.slice();
  var correctIdx = mcq.correct;
  // Shuffle but track where correct ended up
  for (var i = options.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = options[i]; options[i] = options[j]; options[j] = tmp;
  }
  var newCorrectIdx = options.indexOf(mcq.options[correctIdx]);

  container.innerHTML =
    '<div class="mcq-widget">' +
      '<div class="mcq-question"></div>' +
      options.map(function(opt, i) {
        return '<label class="mcq-option">' +
          '<input type="radio" name="mcq" value="' + i + '"> ' +
          '<span class="mcq-opt-text"></span>' +
        '</label>';
      }).join('') +
      '<button class="btn btn-primary" id="mcq-check">Check Answer</button>' +
      '<div class="mcq-feedback hidden" id="mcq-feedback"></div>' +
    '</div>';

  container.querySelector('.mcq-question').textContent = mcq.question;
  container.querySelectorAll('.mcq-opt-text').forEach(function(el, i) {
    el.textContent = options[i];
  });

  container.querySelector('#mcq-check').onclick = function() {
    var selected = container.querySelector('input[name="mcq"]:checked');
    if (!selected) return;
    var chosen = parseInt(selected.value);
    var isCorrect = chosen === newCorrectIdx;
    saveMCQAnswer(concept.id, isCorrect);

    var feedback = container.querySelector('#mcq-feedback');
    feedback.classList.remove('hidden');
    if (isCorrect) {
      feedback.innerHTML = '<span class="mcq-correct">Correct!</span>';
      feedback.style.color = 'var(--success)';
    } else {
      feedback.innerHTML = '<span class="mcq-wrong">Wrong. The correct answer is highlighted.</span>';
      feedback.style.color = 'var(--danger)';
      // Highlight correct
      container.querySelectorAll('.mcq-option')[newCorrectIdx].style.color = 'var(--success)';
    }
    // Disable all radios
    container.querySelectorAll('input[name="mcq"]').forEach(function(r) { r.disabled = true; });

    // Update concept card mcq badge
    var badge = document.querySelector('.mcq-badge');
    if (badge) {
      badge.textContent = 'MCQ ✓';
      badge.classList.add('mcq-answered');
    }
    var mcqBtn = document.getElementById('mcq-btn');
    if (mcqBtn) mcqBtn.style.display = 'none';
  };
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

function startQuiz() {
  var state = loadState();
  var all = getConcepts();
  // Priority: low -> med -> unvisited
  var low = all.filter(function(c) { return state.confidence[c.id] === 'low'; });
  var med = all.filter(function(c) { return state.confidence[c.id] === 'med'; });
  var unvisited = all.filter(function(c) { return !state.confidence[c.id]; });
  var queue = shuffle(low.concat(med).concat(unvisited)).slice(0, 20);
  state.quiz = {
    queue: queue.map(function(c) { return c.id; }),
    index: 0,
    sessionSize: Math.min(20, queue.length)
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
  var overlay = document.getElementById('quiz-overlay');

  if (!state.quiz || state.quiz.index >= state.quiz.queue.length) {
    overlay.innerHTML =
      '<div class="quiz-complete">' +
        '<h2>Session Complete!</h2>' +
        '<p>You reviewed ' + state.quiz.sessionSize + ' concepts.</p>' +
        '<button class="btn btn-primary" id="quiz-done-btn">Back to Explorer</button>' +
      '</div>';
    overlay.querySelector('#quiz-done-btn').onclick = closeQuiz;
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
      '<div class="quiz-answer hidden" id="quiz-answer">' +
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
  overlay.querySelector('#quiz-answer-text').textContent = answerText;

  overlay.querySelector('#quiz-close-btn').onclick = closeQuiz;
  overlay.querySelector('#quiz-reveal-btn').onclick = function() {
    document.getElementById('quiz-reveal-area').classList.add('hidden');
    document.getElementById('quiz-answer').classList.remove('hidden');
  };
  overlay.querySelector('#quiz-next-btn').onclick = function() {
    var selected = document.querySelector('[data-qcf].selected');
    if (selected) saveConfidence(concept.id, selected.dataset.qcf);
    advanceQuiz();
  };
  overlay.querySelector('#quiz-skip-btn').onclick = function() { advanceQuiz(); };

  // Confidence button handlers
  document.querySelectorAll('[data-qcf]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-qcf]').forEach(function(b) {
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
  document.getElementById('quiz-overlay').classList.add('hidden');
  renderModuleList();
  updateProgress();
}

function showQuizOverlay() {
  document.getElementById('quiz-overlay').classList.remove('hidden');
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

  var moduleRows = [1,2,3,4,5,6].map(function(n) {
    var mods = all.filter(function(c) { return c.module === n; });
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
  overlay.querySelector('#stats-close-btn').onclick = function() { overlay.remove(); };
  overlay.querySelectorAll('.stat-weak-item').forEach(function(item) {
    item.onclick = function() {
      overlay.remove();
      jumpToConcept(item.dataset.jump);
    };
    // textContent for security
    var topic = item.querySelector('.stat-weak-topic');
    var concept = getConcept(item.dataset.jump);
    if (topic && concept) topic.textContent = concept.topic;
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
    ['1-5', 'Reveal layer 1-5'],
    ['H / M / L', 'Mark confidence'],
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
        '<div class="stat-section-label">5-Layer Understanding</div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">1</span><span>What is it? — vivid story</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">2</span><span>Analogy — everyday comparison</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">3</span><span>Because — causal chain</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">4</span><span>Breaks — failure modes</span></div>' +
        '<div class="layer-guide-row"><span class="layer-guide-num">5</span><span>Exam Answer — full written response</span></div>' +
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
    case '5': revealLayerByKey('L5'); break;
    case 'l': case 'L': markCurrentConfidence('low'); break;
    case 'm': case 'M': markCurrentConfidence('med'); break;
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

  } catch (err) {
    document.getElementById('app-loading').innerHTML =
      '<p style="color:var(--danger)">Failed to load: ' + err.message + '</p>';
  }
}

window.addEventListener('DOMContentLoaded', initApp);
