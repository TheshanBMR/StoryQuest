// ============================================================
//  StoryQuest — GitHub API (read-only, unauthenticated)
// ============================================================

const CACHE_PREFIX = "sq_gh_";

function _cacheKey(url) {
  return CACHE_PREFIX + btoa(unescape(encodeURIComponent(url))).slice(0, 60);
}

function _getCached(url) {
  try {
    const raw  = sessionStorage.getItem(_cacheKey(url));
    if (!raw) return null;
    const obj  = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(_cacheKey(url));
      return null;
    }
    return obj.data;
  } catch {
    return null;
  }
}

function _setCache(url, data) {
  try {
    sessionStorage.setItem(_cacheKey(url), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

async function ghFetch(url) {
  const cached = _getCached(url);
  if (cached) return cached;

  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" }
  });

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("X-RateLimit-Reset");
    const msg   = reset
      ? `GitHub API rate limit exceeded. Resets at ${new Date(reset * 1000).toLocaleTimeString()}.`
      : "GitHub API rate limit exceeded. Please try again later.";
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  _setCache(url, data);
  return data;
}

// ── Parse story JSON from issue body ───────────────────────

function parseStoryFromIssue(issue) {
  const body = issue.body || "";

  // Try fenced block first
  const fence = body.match(/```json\s*([\s\S]*?)```/i);
  let raw = fence ? fence[1].trim() : body.trim();

  try {
    const story = JSON.parse(raw);
    story._issueNumber = issue.number;
    story._issueUrl    = issue.html_url;
    story._reactions   = issue.reactions || {};
    story._comments    = issue.comments  || 0;
    story._updatedAt   = issue.updated_at;
    return story;
  } catch {
    return null;
  }
}

// ── Fetch list of published stories ────────────────────────

async function fetchPublishedStories({ page = 1, perPage = 12, themeFilter = "", tagFilter = "" } = {}) {
  let labels = [PUBLISHED_LABEL];
  if (themeFilter) labels.push(THEME_LABEL_PREFIX + themeFilter);
  if (tagFilter)   labels.push(TAG_LABEL_PREFIX   + tagFilter.trim().toLowerCase());

  const labelsParam = labels.map(encodeURIComponent).join(",");
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?labels=${labelsParam}&state=open&per_page=${perPage}&page=${page}`;

  const issues = await ghFetch(url);
  const stories = issues
    .map(parseStoryFromIssue)
    .filter(Boolean);

  return { stories, hasMore: issues.length === perPage };
}

// ── Fetch single story by issue number ─────────────────────

async function fetchStoryByIssue(issueNumber) {
  const url   = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`;
  const issue = await ghFetch(url);
  const story = parseStoryFromIssue(issue);
  if (!story) throw new Error("Could not parse story from this issue. The JSON may be malformed.");
  return story;
}

// ── Trending sort helper ────────────────────────────────────

function trendingScore(story) {
  const r  = story._reactions || {};
  const positives = (r["+1"] || 0) + (r.heart || 0) + (r.hooray || 0) + (r.rocket || 0);
  const comments  = story._comments || 0;
  const age       = Date.now() - new Date(story._updatedAt || story.updatedAt).getTime();
  const ageDays   = age / (1000 * 60 * 60 * 24) + 1;
  return (positives * 3 + comments * 2) / ageDays;
}
