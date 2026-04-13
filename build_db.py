#!/usr/bin/env python3
"""Build kb_all.db from kb_all.json + diagrams/ directory."""
import json, sqlite3, os

KB_JSON = 'kb_all.json'
DB_PATH = 'kb_all.db'
DIAGRAMS_DIR = 'diagrams'
PNG_MAP = {}

# Scan diagrams/ for PNG files matching Q{n}_{name}.png pattern
for fname in os.listdir(DIAGRAMS_DIR):
    if fname.endswith('.png') and fname[0] == 'Q':
        qid = fname.split('_', 1)[0]  # "Q2" from "Q2_hierarchy.png"
        PNG_MAP[qid] = os.path.join(DIAGRAMS_DIR, fname)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    module INTEGER NOT NULL,
    topic TEXT NOT NULL,
    L1 TEXT,
    L2 TEXT,
    L3 TEXT,
    L4 TEXT,
    L5 TEXT,
    mcq_question TEXT,
    mcq_options TEXT,
    mcq_correct INTEGER
)
''')
cur.execute('''
CREATE TABLE IF NOT EXISTS diagrams (
    concept_id TEXT PRIMARY KEY,
    png_path TEXT NOT NULL
)
''')
cur.execute('''
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
)
''')
cur.execute('CREATE INDEX IF NOT EXISTS idx_module ON concepts(module)')
cur.execute('CREATE INDEX IF NOT EXISTS idx_concepts_id ON concepts(id)')

with open(KB_JSON, 'r') as f:
    kb = json.load(f)

# Insert metadata
for k, v in kb.get('metadata', {}).items():
    val = json.dumps(v) if isinstance(v, list) else str(v)
    cur.execute('INSERT OR REPLACE INTO metadata VALUES (?, ?)', (k, val))

# Insert concepts
for c in kb['concepts']:
    cur.execute('''INSERT OR REPLACE INTO concepts
        (id, module, topic, L1, L2, L3, L4, L5, mcq_question, mcq_options, mcq_correct)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)''', (
        c['id'],
        c['module'],
        c['topic'],
        c['layers'].get('L1', ''),
        c['layers'].get('L2', ''),
        c['layers'].get('L3', ''),
        c['layers'].get('L4', ''),
        c['layers'].get('L5', ''),
        c['mcq'].get('question', ''),
        json.dumps(c['mcq'].get('options', [])),
        c['mcq'].get('correct', 0),
    ))
    if c['id'] in PNG_MAP:
        cur.execute('INSERT OR REPLACE INTO diagrams VALUES (?, ?)',
                    (c['id'], PNG_MAP[c['id']]))

conn.commit()
conn.close()

with sqlite3.connect(DB_PATH) as conn:
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM concepts')
    count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM diagrams')
    dcount = cur.fetchone()[0]
print(f'Built {DB_PATH}: {count} concepts, {dcount} diagrams')
