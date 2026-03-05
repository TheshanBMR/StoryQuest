// ============================================================
//  StoryQuest — Editor Logic
// ============================================================

let _currentStory = null;
let _autosaveTimer = null;
let _autosaveInterval = null;
const AUTOSAVE_DEBOUNCE = 1500;
const AUTOSAVE_INTERVAL = 10000;

// ── Bootstrap ────────────────────────────────────────────────
function editorInit() {
  const draftId = qp("draft");

  if (draftId) {
    _currentStory = getDraft(draftId);
    if (!_currentStory) {
      showToast("Draft not found. Starting new story.", "error");
      _currentStory = newBlankStory();
    }
  } else {
    _currentStory = newBlankStory();
  }

  renderEditorForm();
  renderChapters();
  updateAutosaveBadge("idle");
  startAutosaveInterval();

  // Initial save so we get an ID stored
  saveDraft(_currentStory);
}

function newBlankStory() {
  return {
    id:          generateId(),
    version:     1,
    title:       "",
    tagline:     "",
    theme:       THEMES[0].id,
    coverStyle:  COVER_STYLES[0].id,
    isAnonymous: false,
    author:      { handle: "", displayName: "" },
    tags:        [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    chapters:    [],
  };
}

// ── Autosave ─────────────────────────────────────────────────
function triggerAutosave() {
  clearTimeout(_autosaveTimer);
  updateAutosaveBadge("saving");
  _autosaveTimer = setTimeout(() => {
    collectFormData();
    saveDraft(_currentStory);
    updateAutosaveBadge("saved");
    setTimeout(() => updateAutosaveBadge("idle"), 3000);
  }, AUTOSAVE_DEBOUNCE);
}

function startAutosaveInterval() {
  clearInterval(_autosaveInterval);
  _autosaveInterval = setInterval(() => {
    collectFormData();
    saveDraft(_currentStory);
    updateAutosaveBadge("saved");
    setTimeout(() => updateAutosaveBadge("idle"), 2000);
  }, AUTOSAVE_INTERVAL);
}

function updateAutosaveBadge(state) {
  const el = document.getElementById("autosave-badge");
  if (!el) return;
  const MAP = { idle: "💾 Autosave on", saving: "⏳ Saving…", saved: "✓ Saved" };
  el.textContent = MAP[state] || "";
  el.className = "autosave-badge" + (state === "saved" ? " autosave-badge--saved" : "");
}

// ── Collect all form values into _currentStory ───────────────
function collectFormData() {
  if (!_currentStory) return;
  _currentStory.title       = val("ed-title");
  _currentStory.tagline     = val("ed-tagline");
  _currentStory.theme       = val("ed-theme");
  _currentStory.coverStyle  = val("ed-coverstyle");
  _currentStory.isAnonymous = document.getElementById("ed-anon")?.checked || false;
  _currentStory.author      = {
    handle:      val("ed-handle"),
    displayName: val("ed-displayname"),
  };
  const rawTags = val("ed-tags");
  _currentStory.tags = rawTags ? rawTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  // Chapters are kept in sync by chapter-level handlers
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

// ── Render main form ─────────────────────────────────────────
function renderEditorForm() {
  const s = _currentStory;

  document.getElementById("ed-title").value       = s.title       || "";
  document.getElementById("ed-tagline").value     = s.tagline     || "";
  document.getElementById("ed-theme").value       = s.theme       || THEMES[0].id;
  document.getElementById("ed-handle").value      = s.author?.handle      || "";
  document.getElementById("ed-displayname").value = s.author?.displayName || "";
  document.getElementById("ed-anon").checked      = s.isAnonymous || false;
  document.getElementById("ed-tags").value        = (s.tags || []).join(", ");

  // Cover style swatches
  renderCoverSwatches();

  // Listen for changes
  ["ed-title","ed-tagline","ed-theme","ed-handle","ed-displayname","ed-tags"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", triggerAutosave);
  });
  const anonEl = document.getElementById("ed-anon");
  if (anonEl) anonEl.addEventListener("change", triggerAutosave);
}

function renderCoverSwatches() {
  const wrap = document.getElementById("cover-swatches");
  if (!wrap) return;
  wrap.innerHTML = COVER_STYLES.map(cs => `
    <div class="cover-swatch ${_currentStory.coverStyle === cs.id ? "cover-swatch--active" : ""}"
         style="background:${cs.css}"
         title="${escHtml(cs.label)}"
         data-cover="${escHtml(cs.id)}"></div>
  `).join("");
  wrap.querySelectorAll(".cover-swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      _currentStory.coverStyle = sw.dataset.cover;
      wrap.querySelectorAll(".cover-swatch").forEach(s => s.classList.remove("cover-swatch--active"));
      sw.classList.add("cover-swatch--active");
      triggerAutosave();
    });
  });
}

// ── Chapter management ───────────────────────────────────────
function renderChapters() {
  const container = document.getElementById("chapters-container");
  if (!container) return;

  if (!_currentStory.chapters.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📝</div>
        <div class="empty-state__title">No chapters yet</div>
        <p>Add your first chapter to get started.</p>
      </div>`;
    return;
  }

  container.innerHTML = _currentStory.chapters.map((ch, idx) =>
    chapterCardHtml(ch, idx)
  ).join("");

  // Wire events for all chapters
  _currentStory.chapters.forEach((ch, idx) => {
    wireChapterEvents(ch, idx);
  });
}

function chapterCardHtml(ch, idx) {
  const total = _currentStory.chapters.length;
  return `
<div class="chapter-card" data-chapter-id="${escHtml(ch.id)}">
  <div class="chapter-card__head" data-toggle="ch-body-${escHtml(ch.id)}">
    <span class="chapter-drag">⠿</span>
    <span class="chapter-num">${idx + 1}</span>
    <span class="chapter-title-preview">${escHtml(ch.title || "Chapter " + (idx+1))}</span>
    <div style="display:flex;gap:6px;margin-left:auto" onclick="event.stopPropagation()">
      <button class="btn btn--ghost btn--sm btn--icon" onclick="moveChapter('${escHtml(ch.id)}', -1)" ${idx === 0 ? "disabled" : ""} title="Move up">↑</button>
      <button class="btn btn--ghost btn--sm btn--icon" onclick="moveChapter('${escHtml(ch.id)}', 1)" ${idx === total-1 ? "disabled" : ""} title="Move down">↓</button>
      <button class="btn btn--danger btn--sm" onclick="deleteChapter('${escHtml(ch.id)}')">✕</button>
    </div>
  </div>
  <div class="chapter-card__body" id="ch-body-${escHtml(ch.id)}">
    <div class="form-group">
      <label class="form-label">Chapter Title</label>
      <input class="form-input" id="cht-${escHtml(ch.id)}" value="${escHtml(ch.title || "")}" placeholder="Give this chapter a title…" />
    </div>
    <div class="form-group">
      <label class="form-label">Body</label>
      <textarea class="form-textarea" id="chb-${escHtml(ch.id)}" rows="6" placeholder="Write your chapter here… (supports **bold**, *italic*)">${escHtml(ch.body || "")}</textarea>
    </div>
    ${choiceBuilderHtml(ch)}
    <div class="mt-4" style="display:flex;gap:10px;align-items:center">
      <button class="btn btn--ghost btn--sm" onclick="addChoice('${escHtml(ch.id)}')">＋ Add Choice</button>
      ${ch.choices.length ? `<button class="btn btn--danger btn--sm" onclick="removeChoice('${escHtml(ch.id)}')">✕ Remove Choice</button>` : ""}
    </div>
  </div>
</div>`;
}

function choiceBuilderHtml(ch) {
  if (!ch.choices || !ch.choices.length) return "";
  return ch.choices.map(choice => `
<div class="choice-block" id="choice-${escHtml(choice.id)}">
  <h4>🔀 Choice Moment</h4>
  <div class="form-group">
    <label class="form-label">Prompt</label>
    <input class="form-input" id="cp-${escHtml(choice.id)}" value="${escHtml(choice.prompt || "")}" placeholder="What happens next…" />
  </div>
  <div id="opts-${escHtml(choice.id)}">
    ${choice.options.map(opt => optionRowHtml(choice.id, opt)).join("")}
  </div>
  ${choice.options.length < 3 ? `<button class="btn btn--ghost btn--sm mt-4" onclick="addOption('${escHtml(choice.id)}')">＋ Option</button>` : ""}
</div>`).join("");
}

function optionRowHtml(choiceId, opt) {
  const letters = { a: "A", b: "B", c: "C" };
  return `
<div class="option-row" id="opt-row-${escHtml(opt.id)}">
  <div class="option-letter">${letters[opt.id] || opt.id.toUpperCase()}</div>
  <input class="form-input" id="opt-txt-${escHtml(opt.id)}" value="${escHtml(opt.text || "")}" placeholder="Option text…" />
  <input class="form-input option-xp" id="opt-xp-${escHtml(opt.id)}" type="number" min="0" max="999" value="${opt.xp || 0}" title="XP" />
  <button class="btn btn--ghost btn--sm btn--icon" onclick="removeOption('${escHtml(choiceId)}','${escHtml(opt.id)}')" title="Remove">✕</button>
</div>
<div class="form-group" style="padding-left:36px">
  <input class="form-input" id="opt-out-${escHtml(opt.id)}" value="${escHtml(opt.outcome || "")}" placeholder="Outcome description (shown after picking)…" />
</div>`;
}

function wireChapterEvents(ch, idx) {
  // Title
  const titleEl = document.getElementById("cht-" + ch.id);
  if (titleEl) titleEl.addEventListener("input", () => {
    ch.title = titleEl.value;
    const preview = document.querySelector(`[data-chapter-id="${ch.id}"] .chapter-title-preview`);
    if (preview) preview.textContent = ch.title || "Chapter " + (idx + 1);
    triggerAutosave();
  });

  // Body
  const bodyEl = document.getElementById("chb-" + ch.id);
  if (bodyEl) bodyEl.addEventListener("input", () => { ch.body = bodyEl.value; triggerAutosave(); });

  // Choices / options
  ch.choices.forEach(choice => {
    wireChoiceEvents(ch, choice);
  });

  // Collapse toggle
  const head = document.querySelector(`[data-chapter-id="${ch.id}"] .chapter-card__head`);
  if (head) head.addEventListener("click", () => {
    const bodyDiv = document.getElementById("ch-body-" + ch.id);
    if (bodyDiv) bodyDiv.classList.toggle("hidden");
  });
}

function wireChoiceEvents(ch, choice) {
  const promptEl = document.getElementById("cp-" + choice.id);
  if (promptEl) promptEl.addEventListener("input", () => { choice.prompt = promptEl.value; triggerAutosave(); });

  choice.options.forEach(opt => {
    const txtEl = document.getElementById("opt-txt-" + opt.id);
    const xpEl  = document.getElementById("opt-xp-"  + opt.id);
    const outEl = document.getElementById("opt-out-" + opt.id);
    if (txtEl) txtEl.addEventListener("input", () => { opt.text    = txtEl.value; triggerAutosave(); });
    if (xpEl)  xpEl .addEventListener("input", () => { opt.xp     = Number(xpEl.value) || 0; triggerAutosave(); });
    if (outEl) outEl.addEventListener("input", () => { opt.outcome = outEl.value; triggerAutosave(); });
  });
}

// ── Chapter CRUD ─────────────────────────────────────────────
function addChapter() {
  collectFormData();
  const ch = {
    id:      generateId(),
    title:   "",
    body:    "",
    choices: [],
  };
  _currentStory.chapters.push(ch);
  saveDraft(_currentStory);
  renderChapters();
  showToast("Chapter added", "success");
}

function deleteChapter(id) {
  if (!confirm("Delete this chapter?")) return;
  collectFormData();
  _currentStory.chapters = _currentStory.chapters.filter(c => c.id !== id);
  saveDraft(_currentStory);
  renderChapters();
  showToast("Chapter deleted");
}

function moveChapter(id, dir) {
  collectFormData();
  const idx = _currentStory.chapters.findIndex(c => c.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _currentStory.chapters.length) return;
  const arr = _currentStory.chapters;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  saveDraft(_currentStory);
  renderChapters();
}

// ── Choice CRUD ──────────────────────────────────────────────
function addChoice(chapterId) {
  collectFormData();
  const ch = _currentStory.chapters.find(c => c.id === chapterId);
  if (!ch) return;
  if (ch.choices.length >= 1) { showToast("Each chapter supports one choice moment."); return; }
  ch.choices.push({
    id:      generateChoiceId(),
    prompt:  "",
    options: [
      { id: "a", text: "", xp: 10, outcome: "" },
      { id: "b", text: "", xp: 5,  outcome: "" },
    ],
  });
  saveDraft(_currentStory);
  renderChapters();
}

function removeChoice(chapterId) {
  collectFormData();
  const ch = _currentStory.chapters.find(c => c.id === chapterId);
  if (!ch) return;
  ch.choices = [];
  saveDraft(_currentStory);
  renderChapters();
}

function addOption(choiceId) {
  collectFormData();
  for (const ch of _currentStory.chapters) {
    const choice = ch.choices.find(c => c.id === choiceId);
    if (choice) {
      if (choice.options.length >= 3) { showToast("Max 3 options (A/B/C)."); return; }
      const ids = ["a","b","c"];
      const nextId = ids[choice.options.length];
      choice.options.push({ id: nextId, text: "", xp: 5, outcome: "" });
      saveDraft(_currentStory);
      renderChapters();
      return;
    }
  }
}

function removeOption(choiceId, optionId) {
  collectFormData();
  for (const ch of _currentStory.chapters) {
    const choice = ch.choices.find(c => c.id === choiceId);
    if (choice) {
      if (choice.options.length <= 1) { showToast("At least 1 option required."); return; }
      choice.options = choice.options.filter(o => o.id !== optionId);
      // Re-assign ids to keep a/b/c sequence
      const ids = ["a","b","c"];
      choice.options.forEach((o, i) => { o.id = ids[i]; });
      saveDraft(_currentStory);
      renderChapters();
      return;
    }
  }
}

// ── Preview ───────────────────────────────────────────────────
function previewStory() {
  collectFormData();
  saveDraft(_currentStory);
  window.open(`s.html?draft=${_currentStory.id}`, "_blank");
}

// ── Export ────────────────────────────────────────────────────
function exportStory() {
  collectFormData();
  saveDraft(_currentStory);
  exportDraftJSON(_currentStory);
  showToast("Story exported!", "success");
}

// ── Publish panel ─────────────────────────────────────────────
function showPublishPanel() {
  collectFormData();
  saveDraft(_currentStory);

  const panel = document.getElementById("publish-panel");
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  // Validate
  if (!_currentStory.title) { showToast("Add a title before publishing.", "error"); return; }
  if (!_currentStory.chapters.length) { showToast("Add at least one chapter.", "error"); return; }

  buildIssueTemplate();
}

function buildIssueTemplate() {
  const s = _currentStory;
  const labels = [
    PUBLISHED_LABEL,
    THEME_LABEL_PREFIX + s.theme,
    ...(s.tags || []).map(t => TAG_LABEL_PREFIX + t)
  ];

  const labelsText = labels.join(", ");
  const jsonBody   = JSON.stringify(s, null, 2);

  const template = `## StoryQuest — ${s.title}

**Suggested Labels:** ${labelsText}

---

\`\`\`json
${jsonBody}
\`\`\`
`;

  const el = document.getElementById("issue-template-code");
  if (el) el.textContent = template;

  // Title suggestion
  const titleSug = document.getElementById("issue-title-sug");
  if (titleSug) titleSug.textContent = `[StoryQuest] ${s.title}`;

  return template;
}

function copyIssueTemplate() {
  const el = document.getElementById("issue-template-code");
  if (!el) return;
  copyToClipboard(el.textContent).then(() => showToast("Copied to clipboard!", "success"));
}
