#!/usr/bin/env python3
"""Build ICT304 Concept Explorer HTML app from Q&A data."""
import json, re, random, sys

# ── helpers ──────────────────────────────────────────────────────────────────────

def strip_md(text):
    """Remove markdown syntax for cleaner plain-text output."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)          # italic
    text = re.sub(r'#+\s*', '', text)                  # headers
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)   # links
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def first_sentence(text, max_len=200):
    """Rough sentence split — first sentence or first max_len chars."""
    text = strip_md(text)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    for s in sentences:
        s = s.strip()
        if len(s) > 30:
            return s[:max_len] + ('...' if len(s) > max_len else '')
    return sentences[0][:max_len] if sentences else text[:max_len]

# ── module map ────────────────────────────────────────────────────────────────

MODULE_MAP = {
    'M1': list(range(1, 15)),    # Q1-Q14
    'M2': list(range(15, 21)),   # Q15-Q20
    'M3': list(range(21, 34)),  # Q21-Q33
    'M4': list(range(34, 58)),   # Q34-Q57
    'M5': list(range(58, 76)),  # Q58-Q75
    'M6': list(range(76, 105)),  # Q76-Q104
# ── fill in gaps ──────────────────────────────────────────────────────────
    1:  "Intelligence emerges from combining five capabilities: perception (data), learning (improvement), reasoning (logic), autonomy (independence), and adaptability (flexibility). Lose any one and you get a brittle or limited system.",
    11: "Selection prevents garbage-in-garbage-out. Preprocessing handles missing values and noise. Transformation makes data compatible with mining algorithms. Interpretation makes patterns actionable. Evaluation validates findings against goals.",
    12: "Symbolic methods need expert-encoded rules but can't learn from data. Connectionist learns from data but is a black box. Evolutionary searches without gradients. Statistical methods need large datasets.",
    13: "Directed mining predicts a known target. Undirected discovers structure — you let the data reveal its own organization. Both are needed: directed to predict, unsupervised to explore.",
    14: "Adaptivity lets CI learn without reprogramming. Robustness handles noisy incomplete data. Heuristics trade optimality for speed. Bio-inspiration leverages millions of years of evolution's solutions to hard problems.",
    20: "Classification and regression are supervised. Clustering and association are unsupervised. Sequence analysis handles time-ordered data. Optimization finds the best solution from a space of possibilities.",
    21: "Framing the problem wrong means solving the wrong thing efficiently. Undefined objectives can't be measured. Unstated constraints surprise you mid-project. Phases that skip steps create compounding errors expensive to fix later.",
    22: "Elements are only meaningful in context of the system they serve — a star quarterback means nothing in a chess team. Results measure whether the system achieves its goal, not whether individual parts are optimal.",
    23: "Parts make up components, components make up sub-systems, sub-systems make up the system. Changes at the part level can cascade upward through the hierarchy.",
    24: "EDP is iterative — you cycle back through stages as you learn. Skipping stages compounds errors: wrong problem definition makes everything downstream futile.",
    25: "Top-down design ensures all parts fit before building starts. Bottom-up realization enables parallel work and independent testing. Life cycle management prevents shipping before understanding support costs.",
    26: "Without stakeholder alignment upfront, requirements constantly change. Without translating to technical specs, designers can't verify they've met expectations. Without logical models, components won't interface correctly.",
    27: "Early phases (concept, development) are where changes are cheapest. Later phases (utilization, support) are where changes are most expensive. Retirement must be planned — data migration takes real effort.",
    28: "Good architecture makes integration easier because interfaces are defined upfront. It enables parallel work on subsystems. Architectural changes late are catastrophically expensive.",
    29: "ConOps translates stakeholder needs into operational language — who does what, when, where, how. It catches gaps between user expectations and technical capability before design begins.",
    30: "ICDs prevent integration failures by making every interface decision explicit. Missing ICDs cause 'it works on my machine' failures. Ambiguous ICDs cause integration failures during system integration testing.",
    34: "Quality garbage in means garbage out. Quantity must match model complexity. Relevance means training data must match deployment data. Bias in training data gets amplified by the model.",
    47: "Labels provide the supervised signal that lets models learn. Without labels, you're limited to unsupervised methods. Label quality directly determines the upper bound of model performance.",
    48: "Manual labeling is high-quality but slow and expensive. Crowdsourcing scales but introduces annotator variability. Programmatic is fast but propagates rules that don't generalize. Active learning optimizes the labeling budget.",
    56: "One-hot creates sparse high-dimensional space but ensures no ordinal assumption. Label encoding imposes false ordinality. Target encoding captures predictive power but risks leakage if not cross-validated.",
    57: "Linear models can't learn feature interactions without crossing — the model can't discover that 'young + urban' behaves differently from either feature alone. Feature crossing gives the model this interaction explicitly.",
    66: "Verification happens during development against technical specs. Validation happens at the end against user needs. Both are required — verification without validation means perfect spec wrong product.",
    67: "Verification is process-oriented — did you follow the right steps? Validation is outcome-oriented — did you achieve the right goal? Both catch different defect types and both are necessary.",
    68: "Controlled environments enable reproducible experiments and isolate specific variables. But results may not transfer to the real world — the lab can't capture all real-world complexity.",
    69: "Reviews catch design issues early. Inspections catch requirement gaps. Walkthroughs catch logical errors. Testing catches runtime failures. Each approach finds different defect types.",
    70: "Unit tests catch local bugs fast and cheaply. Integration catches interface bugs between modules. System tests catch emergent behavior. Acceptance tests validate user needs.",
    71: "ZeroR sets the absolute floor — if you can't beat always predicting the majority class, your model adds zero value. Random shows whether the model beats chance. Previous Best tracks genuine improvement over time.",
    74: "Models can perform well overall but fail dramatically on minority subgroups — a model with 90% accuracy might have 30% on women. Slice-based testing catches these hidden failures essential for fairness.",
    75: "Manual is fast but requires domain expertise. Decision trees automate slice discovery but find only what the tree can represent. Error analysis finds failures but not all failure modes.",
    80: "MaaS decouples model lifecycle from application lifecycle but network latency is unacceptable for real-time inference. The API becomes a single point of failure.",
    81: "Different library versions produce different model behavior. GPU vs CPU environments cause crashes or silent accuracy drops. Reproducibility means anyone can replicate the exact same model.",
    82: "Virtual env isolates Python packages but not system libraries or hardware. Docker packages everything together but images are large and slow to build.",
    95: "Spatial shift occurs when deployment environment differs geographically. Temporal shift occurs when real-world patterns evolve seasonally. Both are ubiquitous in production but often undetected until they cause significant harm.",


# ── L4 failure modes ───────────────────────────────────────────────────────

FAILURES = {
    3:  "Machines can pass the Turing Test by using vague language, manipulation, or following scripts rather than genuinely understanding — passing the test doesn't prove real intelligence.",
    4:  "CI needs less data but requires good problem framing. ML needs lots of data but can discover patterns humans wouldn't think to look for. Both can fail when the problem doesn't fit their assumption.",
    7:  "CBR fails when no past case is similar enough — the retrieval step is critical. If the case base is small or poorly indexed, revision dominates and accuracy suffers.",
    8:  "LLMs hallucinate — they generate fluent, confident-sounding text that's factually wrong. They also absorb biases present in their training data and can reveal private information.",
    31: "Hash collisions: two different categories map to the same bucket, creating noisy features. Hash functions can also be reversible if not using cryptographic hashing, leaking category information.",
    32: "Irreversible: you can never recover the original categories from the hash. Collisions corrupt feature representations. Fixed bucket count limits scalability — too few buckets means too many collisions.",
    33: "Embeddings require large amounts of training data to learn meaningful geometry. Out-of-vocabulary words at inference time have no representation. The geometry may not transfer across languages.",
    35: "Wrong baseline choice misleads development. Always predict majority class is a trivially beatable baseline. Previous Best requires careful version tracking to ensure fair comparison.",
    36: "JSON is human-readable but verbose and slow to parse for large data. XML is self-descriptive but verbose. CSV is simple but can't represent nested structures. Protobuf is fast and compact but requires schema. Pickle is Python-only and unsafe with untrusted data.",
    40: "Data lakes can become data swamps — raw data stored without organization, quality control, or clear governance. Data warehouses requires expensive preprocessing before analysis.",
    43: "Batch processing has high latency (wait for full batch). Stream processing has high infrastructure complexity (Kafka, Flink) and can't do batch analytics easily.",
    44: "If train/test split isn't random (e.g., time-based data split randomly), you'll train on future data and appear more accurate than you are. Always stratified split when classes are imbalanced.",
    50: "Naive models achieve high accuracy by always predicting the majority class. SMOTE can create synthetic samples in feature space that don't represent real cases. Class weights require careful tuning.",
    51: "Augmentation that changes the label (e.g., flipping '6' and '9' in digit recognition without relabeling) corrupts training. Too much augmentation can teach the model to rely on the augmentation artifacts.",
    53: "Treating MNAR as MCAR and dropping missing values introduces systematic bias — the missing values are systematically different and dropping them changes the learned distribution.",
    54: "Outliers compress most values into a tiny range in Min-Max scaling. Z-Score assumes normal distribution — skewed data misleads. Robust scaling uses median and IQR instead.",
    55: "Bins at the wrong boundaries split genuinely similar values into different categories. Too few bins lose information; too many overfit to noise.",
    58: "Most dangerous because it's invisible — validation metrics look great. Common sources: including test data in training, target encoding before splitting, using future information as features. Must build any joins on the full dataset before splitting.",
    63: "If ConOps doesn't reflect actual user needs, validation passes for the wrong system. Success criteria must be measurable and agreed upfront — vague criteria lead to arguments at the end.",
    65: "If base models are too similar (all Decision Trees), ensembling provides little benefit. Boosting can overfit noisy data by repeatedly correcting outliers. Stacking can overfit if the meta-learner is too complex.",
    67: "Verification without validation: all specs met but nobody wants the product. Validation without verification: works for users but crashes under load. Both are needed, and controlled testing environments may not reflect real production conditions.",
    68: "Controlled environments don't reflect the chaos of real-world data: edge cases, adversarial inputs, hardware failures, and unusual user behaviors all appear in production but not in testing.",
    72: "Perturbation thresholds are arbitrary — too sensitive and everything fails, too lenient and real problems are missed. Some perturbations are natural variation, not failures.",
    73: "High CTR can mean users are clicking on misleading content. Always pair CTR with engagement quality and satisfaction metrics — users might click out of curiosity but regret it.",
    76: "Missing dependency versions cause silent accuracy drops (different library versions produce slightly different model behavior). Environment must exactly match between training and serving.",
    77: "Can't scale model independently from the app. Updating the model requires redeploying the entire application. All serving infrastructure must match the main app's technology stack.",
    79: "Network latency between the API and the model service adds overhead. Requires robust API design, authentication, and rate limiting. More complex than in-service deployment.",
    83: "Docker containers share the host kernel — a kernel vulnerability affects all containers. VMs provide complete isolation at the cost of higher resource overhead and slower startup.",
    84: "Aggressive quantization causes significant accuracy drops for some model architectures. Pruning without careful validation destroys important weights. Compression must preserve the model's decision boundaries.",
    85: "Stateless serving is required for horizontal scaling — if each request needs session state, that state must be stored externally (Redis, database), adding complexity and latency.",
    86: "Edge devices have limited compute — large models can't run on IoT sensors. Harder to update models on thousands of distributed devices. Security at the device level is harder to manage.",
    87: "Optimizing ML metrics without tracking operational metrics means you can deploy an accurate model that's too slow or crashes constantly. Optimizing operational metrics without ML metrics means a fast system that makes terrible predictions.",
    88: "Missing library versions cause import errors. Deprecated API calls silently use fallback behavior. Deployment to wrong environment (e.g., GPU machine vs CPU) causes crashes.",
    89: "Single points of failure in infrastructure (database, load balancer). Hardware failures (disk full, RAM exhausted). Configuration errors (wrong environment variables).",
    90: "Production data differs from training in ways not seen in development. Edge cases in safety-critical systems (autonomous vehicles, medical AI). Feedback loops where model predictions influence future training data.",
    91: "Edge cases in safety-critical systems can cause catastrophic failures — always test with real-world conditions. Outliers may be data entry errors that should be corrected rather than modelled.",
    92: "Rich-get-richer loops: popular content gets recommended, gets clicked, gets more data, gets recommended more. Niche content never gets shown so never gets clicks so never gets recommended. Gradually destroys recommendation diversity.",
    93: "Covariate shift: model processes novel patterns it wasn't trained on. Label shift: model predicts outdated label distributions. Concept shift: the fundamental relationship between inputs and outputs changes — model is solving yesterday's problem.",
    94: "Statistical tests detect distributional differences but can't tell you whether those differences matter for your specific model's predictions. Thresholds for significance are arbitrary.",
    95: "Spatial shift can occur when deploying models across different regions, demographics, or device types. Temporal shift is ubiquitous in production — consumer behavior, language, and economic conditions evolve.",
    96: "Monitoring without observability can't diagnose novel failures. Observability without monitoring misses obvious known issues. Both operational and ML-specific metrics are needed.",
    97: "Logs without structure are hard to search. Dashboards without context are misleading. Alerts without clear thresholds cause alert fatigue. Each serves a different purpose.",
    98: "Biased training data produces biased models. Black-box models can't explain decisions. Lack of accountability makes it impossible to fix problems when they occur. Privacy breaches expose sensitive data.",
    99:  "Fairness has competing definitions — optimizing for one may hurt another. What's fair in one context may not be in another. Bias can enter at any stage: data, labels, features, or model architecture.",
    100: "Fairness metrics can conflict: demographic parity vs equalized odds vs calibration. Auditing only at deployment misses problems in data preparation and labeling stages.",
    102: "Encryption at rest only protects stored data — data in transit needs TLS. Anonymization can be reversed with auxiliary data. Compliance doesn't equal ethics.",
    103: "XAI tools like SHAP and LIME give post-hoc explanations that may not reflect the actual decision mechanism. Explanations can be gamed to appear fair while the model remains biased.",
    104: "Without accountability, harmful AI decisions can't be traced to their source. Models trained on third-party data may have no clear owner. Regulation (GDPR, AI Act) increasingly mandates it.",
}

    # ── fill in gaps ──────────────────────────────────────────────────────────
    1:  "A system becomes brittle when it over-optimizes for one capability at the expense of others. A robot that learns but can't perceive obstacles will fail catastrophically in new environments.",
    11: "Skipping preprocessing produces misleading patterns. Skipping interpretation means finding patterns you can't act on. Evaluation without ground truth is impossible for unsupervised mining.",
    12: "Symbolic systems can't learn from data — they need expert-encoded rules that are hard to maintain. Connectionist systems are black boxes. Evolutionary is computationally expensive.",
    13: "Directed mining overfits if features leak information. Undirected produces clusters that may not be actionable — discovering 47 customer segments is useless if you can't serve each differently.",
    14: "CI needs good problem framing by a human expert. Heuristics can get stuck in local optima. Bio-inspired doesn't always transfer from nature to digital implementation.",
    20: "Wrong problem type means the model solves the wrong task. Classification treated as regression produces meaningless continuous outputs. Recommendation without exploration leads to filter bubbles.",
    21: "Poor framing locks you into solving the wrong problem efficiently. Unmeasurable objectives create arguments at project end. Hidden constraints cause crises mid-project.",
    22: "Optimizing an element without understanding its role in the system can harm overall performance — a star player can disrupt team coordination.",
    23: "Confusion between hierarchy levels causes communication failures. Saying 'fix the component' is meaningless without specifying which level.",
    24: "Scope creep happens when deployment expectations aren't managed. Integration reveals gaps that requirements didn't catch. EDP is iterative — expect to revisit earlier stages.",
    25: "Top-down without bottom-up expertise creates unrealistic designs. Bottom-up without top-down coordination leads to incompatible components. Life cycle ignored means expensive late-stage changes.",
    26: "Skipping stakeholder alignment means building the wrong thing. Weak technical requirements let defects through. Poor logical models cause integration failures.",
    27: "Skipping retirement planning strands data and users. Systems accumulate technical debt during utilization. Support costs are consistently underestimated.",
    28: "Architectural debt is the hardest to pay back — changing the foundation of a system is much harder than changing the paint. Poor architecture causes late-stage integration failures.",
    29: "Without ConOps, developers build based on assumptions about users. Users discover problems at deployment, not design time. ConOps validated only with stakeholders still misses real-world problems.",
    30: "Missing ICDs cause 'it works on my machine' failures. Ambiguous ICDs cause integration failures during system integration testing — the worst possible time.",
    34: "Privacy violations expose the organization to legal risk. Label noise degrades model quality silently. Distribution mismatch between training and deployment makes even clean data useless.",
    47: "Label noise (wrong labels) causes models to learn incorrect patterns. Label inconsistency across annotators produces contradictory training signals. Missing labels waste data.",
    48: "Crowdsourcing without quality control produces garbage labels. Programmatic labels can propagate errors at scale. Active learning can introduce bias if the model is uncertain in systematically biased ways.",
    56: "High-cardinality one-hot causes curse of dimensionality. Target encoding without proper cross-validation leaks information. Ordinal encoding without real ordering teaches false ordinal relationships.",
    57: "Feature crossing explosion — combining many features creates exponentially many new features, causing overfitting without regularization.",
    66: "Both verification and validation can pass in a test environment but fail in production. Controlled environments can't fully replicate real-world conditions.",
    67: "Verification doesn't catch wrong requirements. Validation doesn't catch engineering defects. Without both, you're flying blind.",
    68: "Results from controlled environments may not transfer to the real world. The controlled environment can't capture all real-world complexity.",
    69: "Reviews without follow-through fix nothing. Inspections become political and fail to catch real issues. Walkthroughs where authors are defensive catch nothing.",
    70: "High unit test coverage gives false confidence if integration tests are skipped. Integration tests in production-like environments are most valuable but often skipped under time pressure.",
    71: "Wrong baseline comparison makes real improvement invisible. Comparing to a poor ZeroR is easy but meaningless.",
    74: "Small slices have high variance — a single bad prediction in a small slice looks like massive failure. You need enough samples per slice to draw statistical conclusions.",
    75: "Automatic slice discovery without domain guidance finds spurious correlations. Slices must be validated against real-world relevance, not just statistical patterns.",
    80: "Network latency makes MaaS unacceptable for real-time inference. The model API becomes a single point of failure. More components means more failure modes.",
    81: "Pinning versions too strictly prevents security updates. Pinning too loosely breaks reproducibility. Hardware changes require full retesting.",
    82: "Virtual env is lightweight but system-level dependencies can still conflict. Docker images are large and slow to build. GPU Docker requires nvidia-docker setup.",
    95: "Models degrade silently — performance looks fine because you're comparing against yesterday's model, not today's reality. Both shifts are ubiquitous but often undetected.",

# ── module topics for priority ordering ─────────────────────────────────────
MODULE_TOPICS = ['AI Foundations', 'ML Systems', 'System Engineering',
                  'Model Eval', 'Deployment', 'Responsible AI']

# ── load Q&A from notebook ────────────────────────────────────────────────────

with open('/Users/calvyn/Documents/school/ICT304 - AI System Design/ICT304_Exam_Revision_104Q.ipynb') as f:
    nb = json.load(f)
cells = nb['cells']

qa_pairs = {}
for i in range(1, 105):
    src = ''.join(cells[i]['source'])
    m = re.match(r'## \d+\. (.*)', src, re.DOTALL)
    if m:
        qa_pairs[i] = m.group(1).strip()[:2000]

# ── build concepts ─────────────────────────────────────────────────────────────

concepts = []
for qnum in range(1, 105):
    answer = qa_pairs.get(qnum, '')
    topic = TOPICS.get(qnum, f'Q{qnum}')
    mod = q_to_module(qnum)

    # L1: first sentence story — use the question as a concrete scenario opener
    q_short = TOPICS.get(qnum, f'Q{qnum}')
    l1 = f"You encounter {q_short} in a real project. Here's how to think about it: {first_sentence(answer, 180)}"

    # L2: analogy
    l2 = ANALOGIES.get(qnum, f"Think of {topic} like a well-established practice from everyday life — once you see the parallel, the concept clicks.")

    # L3: because chain
    l3 = BECAUSE.get(qnum, f"The core principle behind {topic} is that {first_sentence(answer, 160)}")

    # L4: failure modes
    l4 = FAILURES.get(qnum, f"The main pitfall with {topic} is when {first_sentence(answer[100:], 150) if len(answer) > 100 else 'the assumptions behind it no longer hold in practice.'}")

    # If the topic is calculation-heavy, add formula
    if qnum == 73:
        l3 += " Formula: CTR = (Clicks / Impressions) × 100."
    elif qnum == 54:
        l3 += " Min-Max: X_norm = (X - X_min) / (X_max - X_min). Z-Score: X_z = (X - mean) / std."
    elif qnum == 31:
        l3 += " Binary encoding bits: bits = ceil(log2 N) where N = number of categories."
    elif qnum == 63:
        l3 += " Six steps: Review Requirements → Define Test Scenarios → Establish Success Criteria → Conduct Tests → Analyze Results → Document."

    concepts.append({
        'id': f'Q{qnum}',
        'module': mod,
        'topic': topic,
        'layers': {
            'L1': l1,
            'L2': l2,
            'L3': l3,
            'L4': l4,
        }
    })

# ── write JSON for verification ──────────────────────────────────────────────
with open('kb_all.json', 'w') as f:
    json.dump({'concepts': concepts}, f, indent=2)
print(f"Wrote {len(concepts)} concepts to kb_all.json")

# Verify
with open('kb_all.json') as f:
    kb = json.load(f)
mods = {}
for c in kb['concepts']:
    mods.setdefault(c['module'], []).append(c['id'])
for m in sorted(mods):
    print(f"  Module {m}: {len(mods[m])} concepts — {mods[m][0]}..{mods[m][-1]}")
