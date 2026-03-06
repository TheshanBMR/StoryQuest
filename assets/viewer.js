// ============================================================
//  StoryQuest — Viewer / Player Logic
// ============================================================

const Viewer = (() => {
  let _story         = null;
  let _storyKey      = "";
  let _currentChIdx  = 0;
  let _progress      = null;

  async function init() {
    const issueId = qp("id");
    const draftId = qp("draft");

    if (!issueId && !draftId) {
      renderError("No story specified. Add ?id=ISSUE_NUMBER or ?draft=DRAFT_ID to the URL.");
      return;
    }

    renderLoadingState();

    try {
      if (draftId) {
        _story    = getDraft(draftId);
        _storyKey = "draft_" + draftId;
        if (!_story) throw new Error("Draft not found in this browser.");
      } else {
        _story    = await fetchStoryByIssue(issueId);
        _storyKey = "issue_" + issueId;
      }
    } catch (err) {
      renderError(err.message || "Failed to load story.");
      return;
    }

    _progress    = getProgress(_storyKey);
    _currentChIdx = _progress.currentChapter || 0;

    if (_currentChIdx >= _story.chapters.length) {
      _currentChIdx = 0;
      _progress.currentChapter = 0;
    }

    renderCover();
    renderXPBar();
    renderCurrentChapter();

  }

  function renderLoadingState() {
    const wrap = document.getElementById("viewer-content");
    if (wrap) wrap.innerHTML = spinnerHtml();
  }

  function renderError(msg) {
    const wrap = document.getElementById("viewer-content");
    if (wrap) wrap.innerHTML = `
      <div class="error-banner">${escHtml(msg)}</div>
      <div class="empty-state">
        <div class="empty-state__icon">😕</div>
        <div class="empty-state__title">Story unavailable</div>
        <p><a href="index.html" class="text-accent">← Back to home</a></p>
      </div>`;
  }

  function renderCover() {
    const el = document.getElementById("viewer-cover");
    if (!el || !_story) return;

    const cover  = coverCss(_story.coverStyle);
    const theme  = themeById(_story.theme);
    const author = _story.isAnonymous
      ? "Anonymous"
      : (_story.author?.displayName || _story.author?.handle || "Unknown");

    el.style.background = cover;
    el.innerHTML = `
      <div class="viewer-cover__content">
        <div class="theme-badge">${escHtml(theme.emoji)} ${escHtml(theme.label)}</div>
        <div class="viewer-cover__title">${escHtml(_story.title || "Untitled")}</div>
        <div class="viewer-cover__meta">✍️ ${escHtml(author)} · ${(_story.chapters || []).length} chapters</div>
      </div>`;

  }


  function renderXPBar() {
    const el = document.getElementById("xp-bar");
    if (!el) return;
    const totalPossible = _maxXP();
    const current       = _progress.xp || 0;
    const pct           = totalPossible > 0 ? Math.min(100, (current / totalPossible) * 100) : 0;
    el.innerHTML = `
      <span class="xp-bar__label">XP</span>
      <span class="xp-bar__val">${current}</span>
      <div class="xp-bar__track">
        <div class="xp-bar__fill" style="width:${pct}%"></div>
      </div>
      <span class="text-muted" style="font-size:0.78rem">/ ${totalPossible}</span>`;
  }

  function _maxXP() {
    let max = 0;
    (_story.chapters || []).forEach(ch => {
      (ch.choices || []).forEach(choice => {
        const best = Math.max(0, ...(choice.options || []).map(o => o.xp || 0));
        max += best;
      });
    });
    return max;
  }

  function renderCurrentChapter() {
    const wrap = document.getElementById("viewer-content");
    if (!wrap || !_story) return;

    const chapters = _story.chapters || [];

    if (!chapters.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📖</div><div class="empty-state__title">This story has no chapters yet.</div></div>`;
      return;
    }

    if (_currentChIdx >= chapters.length) {
      renderEndScreen();
      return;
    }

    const ch = chapters[_currentChIdx];
    const choicesMade = _progress.choicesMade || {};

    const choiceHtml = (ch.choices || []).map(choice => {
      const madeId = choicesMade[choice.id];
      return `
        <div class="choices-block">
          <h3>🔀 ${escHtml(choice.prompt || "What do you do?")}</h3>
          ${(choice.options || []).map(opt => {
            const isMade   = madeId === opt.id;
            const isSkipped = madeId && !isMade;
            return `
              <button class="choice-option-btn ${isMade ? "chosen" : ""} ${isSkipped ? "skipped" : ""}"
                      ${madeId ? "disabled" : ""}
                      onclick="Viewer._pickOption('${escHtml(choice.id)}','${escHtml(opt.id)}')">
                <span class="choice-opt-letter">${escHtml(opt.id.toUpperCase())}</span>
                <span class="choice-opt-text">${escHtml(opt.text || "Option " + opt.id.toUpperCase())}</span>
                ${isMade ? `<span class="choice-opt-xp choice-opt-xp--reveal">+${opt.xp} XP ✨</span>` : ""}
              </button>
              ${isMade && opt.outcome ? `<div class="outcome-text">💬 ${escHtml(opt.outcome)}</div>` : ""}
            `;
          }).join("")}
        </div>`;
    }).join("");

    const isLast    = _currentChIdx >= chapters.length - 1;
    const canGoNext = !(ch.choices && ch.choices.length && !choicesMade[ch.choices[0]?.id]);

    wrap.innerHTML = `
      <div class="chapter-card--viewer">
        <h2>${escHtml(ch.title || "Chapter " + (_currentChIdx + 1))}</h2>
        <div class="chapter-body">${renderBody(ch.body || "")}</div>
        ${choiceHtml}
        <div class="nav-btns">
          ${_currentChIdx > 0 ? `<button class="btn btn--ghost" onclick="Viewer._back()">← Back</button>` : ""}
          <button class="btn btn--primary" onclick="Viewer._next()" ${!canGoNext ? "disabled title='Make a choice first'" : ""}>
            ${isLast ? "Finish Story 🎉" : "Next Chapter →"}
          </button>
        </div>
      </div>`;
  }

  function _pickOption(choiceId, optionId) {
    if (!_story) return;
    for (const ch of _story.chapters) {
      const choice = (ch.choices || []).find(c => c.id === choiceId);
      if (choice) {
        if (_progress.choicesMade[choiceId]) return; // already chosen
        const opt = choice.options.find(o => o.id === optionId);
        if (opt) {
          _progress.choicesMade[choiceId] = optionId;
          _progress.xp = (_progress.xp || 0) + (opt.xp || 0);
          saveProgress(_storyKey, _progress);
          renderXPBar();
          renderCurrentChapter();
        }
        return;
      }
    }
  }

  function _next() {
    const chapters = _story?.chapters || [];
    _currentChIdx++;
    _progress.currentChapter = _currentChIdx;
    saveProgress(_storyKey, _progress);
    if (_currentChIdx >= chapters.length) {
      renderEndScreen();
    } else {
      renderCurrentChapter();
      document.getElementById("viewer-content")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function _back() {
    if (_currentChIdx <= 0) return;
    _currentChIdx--;
    _progress.currentChapter = _currentChIdx;
    saveProgress(_storyKey, _progress);
    renderCurrentChapter();
    document.getElementById("viewer-content")?.scrollIntoView({ behavior: "smooth" });
  }

  function renderEndScreen() {
    const wrap = document.getElementById("viewer-content");
    if (!wrap) return;

    const xp    = _progress.xp || 0;
    const issueId = qp("id");
    const shareUrl = issueId
      ? `${location.origin}/StoryQuest/s.html?id=${issueId}`
      : "";

    wrap.innerHTML = `
      <div class="end-screen">
        <div class="end-screen__xp">${xp} XP</div>
        <div class="end-screen__title">Story Complete! 🎉</div>
        <div class="end-screen__sub">You finished <em>${escHtml(_story?.title || "")}</em></div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn--secondary" onclick="Viewer._restart()">↩ Read Again</button>
          <a class="btn btn--primary" href="explore.html">Explore More Stories →</a>
        </div>
        ${issueId ? `
        <div class="share-box">
          <h3>Share this story</h3>
          <p class="text-muted" style="font-size:0.85rem;margin-bottom:10px">Copy this link to share with friends:</p>
          <div class="share-url">
            <input id="share-link-input" value="${escHtml(shareUrl)}" readonly />
            <button class="btn btn--secondary" onclick="copyShareLink()">Copy</button>
          </div>
        </div>` : ""}
      </div>`;
  }

  function _restart() {
    clearProgress(_storyKey);
    _progress    = getProgress(_storyKey);
    _currentChIdx = 0;
    renderXPBar();
    renderCurrentChapter();
  }

  return { init, _pickOption, _next, _back, _restart };
})();

function copyShareLink() {
  const el = document.getElementById("share-link-input");
  if (el) {
    copyToClipboard(el.value).then(() => showToast("Link copied!", "success"));
  }
}
