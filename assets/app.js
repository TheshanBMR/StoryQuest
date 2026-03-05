// ============================================================
//  StoryQuest — Shared App Helpers
// ============================================================

// ── HTML sanitiser ──────────────────────────────────────────
function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

// ── Simple markdown-ish → HTML (bold, italic, linebreaks) ───
function renderBody(str) {
  if (!str) return "";
  let s = escHtml(str);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g,   "<em>$1</em>");
  s = s.replace(/\n/g, "<br>");
  return s;
}

// ── Date formatting ─────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h  = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d  = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ── URL / query-string helpers ──────────────────────────────
function qp(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function buildUrl(base, params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) u.set(k, v);
  return base + "?" + u.toString();
}

// ── Cover gradient ───────────────────────────────────────────
function coverCss(style) {
  const found = COVER_STYLES.find(c => c.id === style);
  return found ? found.css : COVER_STYLES[0].css;
}

// ── Story card HTML ──────────────────────────────────────────
function storyCardHtml(story, linkHref) {
  const theme   = themeById(story.theme);
  const cover   = coverCss(story.coverStyle);
  const author  = story.isAnonymous
    ? "Anonymous"
    : (story.author?.displayName || story.author?.handle || "Unknown");
  const updated = story._updatedAt || story.updatedAt;
  const reactions = story._reactions || {};
  const positives = (reactions["+1"] || 0) + (reactions.heart || 0) + (reactions.rocket || 0) + (reactions.hooray || 0);
  const chapters  = (story.chapters || []).length;

  return `
<a class="story-card" href="${escHtml(linkHref)}" style="text-decoration:none">
  <div class="story-card__cover" style="background:${cover}">
    <span class="theme-badge">${escHtml(theme.emoji)} ${escHtml(theme.label)}</span>
  </div>
  <div class="story-card__body">
    <h3 class="story-card__title">${escHtml(story.title || "Untitled")}</h3>
    <p class="story-card__tagline">${escHtml(story.tagline || "")}</p>
    <div class="story-card__meta">
      <span class="meta-author">✍️ ${escHtml(author)}</span>
      <span class="meta-time">${updated ? timeAgo(updated) : ""}</span>
    </div>
    <div class="story-card__stats">
      <span>📖 ${chapters} ch</span>
      ${story._comments ? `<span>💬 ${story._comments}</span>` : ""}
      ${positives       ? `<span>❤️ ${positives}</span>`      : ""}
    </div>
  </div>
</a>`;
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  let container = document.getElementById("sq-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "sq-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `sq-toast sq-toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("sq-toast--show"));
  setTimeout(() => {
    toast.classList.remove("sq-toast--show");
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

// ── Spinner ──────────────────────────────────────────────────
function spinnerHtml() {
  return `<div class="sq-spinner"><div></div><div></div><div></div></div>`;
}

// ── Clipboard ────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity  = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Active nav link ──────────────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__link").forEach(a => {
    const href = a.getAttribute("href").split("/").pop();
    a.classList.toggle("nav__link--active", href === page || (page === "" && href === "index.html"));
  });
}
