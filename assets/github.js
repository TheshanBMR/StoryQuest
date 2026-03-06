// ============================================================
//  StoryQuest — GitHub API (read-only, unauthenticated)
// ============================================================

var CACHE_PREFIX = "sq_gh_";

function _cacheKey(url) {
  return CACHE_PREFIX + btoa(unescape(encodeURIComponent(url))).slice(0, 60);
}
function _getCached(url) {
  try {
    var raw = sessionStorage.getItem(_cacheKey(url));
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) { sessionStorage.removeItem(_cacheKey(url)); return null; }
    return obj.data;
  } catch (e) { return null; }
}
function _setCache(url, data) {
  try { sessionStorage.setItem(_cacheKey(url), JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
}
function clearAllCache() {
  try {
    Object.keys(sessionStorage).filter(function(k) { return k.startsWith(CACHE_PREFIX); })
      .forEach(function(k) { sessionStorage.removeItem(k); });
  } catch (e) {}
}

async function ghFetch(url) {
  var cached = _getCached(url);
  if (cached) return cached;
  var res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 403 || res.status === 429) {
    var reset = res.headers.get("X-RateLimit-Reset");
    throw new Error(reset
      ? "GitHub rate limit exceeded. Resets at " + new Date(reset * 1000).toLocaleTimeString() + "."
      : "GitHub rate limit exceeded. Please try again later.");
  }
  if (!res.ok) throw new Error("GitHub API error: " + res.status + " " + res.statusText);
  var data = await res.json();
  _setCache(url, data);
  return data;
}

// ── Sanitise text for JSON parsing ─────────────────────────
function _clean(str) {
  return str
    // Smart / curly quotes → straight ASCII quotes
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    // Em/en dashes
    .replace(/\u2013/g, "-").replace(/\u2014/g, "--")
    // Non-breaking & zero-width spaces
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
    // Windows line endings
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    // Strip any HTML tags GitHub might inject
    .replace(/<[^>]+>/g, "");
}

function _tryParse(str) {
  if (!str) return null;
  try {
    var r = JSON.parse(str.trim());
    return (r && typeof r === "object" && !Array.isArray(r)) ? r : null;
  } catch (e) { return null; }
}

// ── Try every possible extraction strategy ─────────────────
function _extractJson(body) {
  if (!body) return null;

  // Strategy 1: raw body before any cleaning (works when body IS pure JSON)
  var r0 = _tryParse(body);
  if (r0 && r0.title) return r0;

  var text = _clean(body);

  // Strategy 2: ```json ... ``` fenced block
  var m1 = text.match(/```json\s*([\s\S]*?)```/i);
  if (m1) { var r1 = _tryParse(m1[1]); if (r1) return r1; }

  // Strategy 3: ``` ... ``` fenced block (no lang tag)
  var m2 = text.match(/```\s*([\s\S]*?)```/);
  if (m2) { var r2 = _tryParse(m2[1]); if (r2) return r2; }

  // Strategy 4: cleaned body starts with {
  var trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    var r3 = _tryParse(trimmed);
    if (r3) return r3;
  }

  // Strategy 5: extract outermost { ... } block
  var first = trimmed.indexOf("{");
  var last  = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    var r4 = _tryParse(trimmed.slice(first, last + 1));
    if (r4) return r4;
  }

  // Strategy 6: GitHub sometimes escapes backslashes in issue bodies.
  // Unescape \" → " and retry
  var unescaped = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  var first2 = unescaped.indexOf("{");
  var last2  = unescaped.lastIndexOf("}");
  if (first2 !== -1 && last2 > first2) {
    var r5 = _tryParse(unescaped.slice(first2, last2 + 1));
    if (r5) return r5;
  }

  // Strategy 7: strip all markdown formatting chars and retry
  var stripped = trimmed.replace(/[*_~#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  var first3 = stripped.indexOf("{");
  var last3  = stripped.lastIndexOf("}");
  if (first3 !== -1 && last3 > first3) {
    var r6 = _tryParse(stripped.slice(first3, last3 + 1));
    if (r6) return r6;
  }

  return null;
}

// ── Normalise raw parsed object → valid story ───────────────
function _normaliseStory(raw, issue) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.title && !Array.isArray(raw.chapters)) return null;

  var labels = (issue.labels || []).map(function(l) { return l.name; });

  // Theme
  var theme = (raw.theme || "").trim();
  if (!theme) {
    var tl = labels.find(function(l) { return l.startsWith(THEME_LABEL_PREFIX); });
    if (tl) theme = tl.replace(THEME_LABEL_PREFIX, "");
  }
  if (!THEMES.find(function(t) { return t.id === theme; })) theme = THEMES[0].id;

  // Tags
  var tags = Array.isArray(raw.tags) && raw.tags.length ? raw.tags
    : labels.filter(function(l) { return l.startsWith(TAG_LABEL_PREFIX); })
             .map(function(l)   { return l.replace(TAG_LABEL_PREFIX, ""); });

  // CoverStyle — graceful fallback to aurora
  var coverStyle = (raw.coverStyle || "").trim();
  if (!COVER_STYLES.find(function(c) { return c.id === coverStyle; })) {
    coverStyle = COVER_STYLES[0].id;
  }

  // Chapters
  var chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map(function(ch, i) {
        return {
          id:      ch.id    || ("c" + i),
          title:   ch.title || ("Chapter " + (i + 1)),
          body:    ch.body  || "",
          choices: Array.isArray(ch.choices)
            ? ch.choices.map(function(choice, ci) {
                return {
                  id:      choice.id     || ("ch" + ci),
                  prompt:  choice.prompt || "",
                  options: Array.isArray(choice.options)
                    ? choice.options.map(function(o, oi) {
                        return {
                          id:      o.id      || (["a","b","c"][oi] || String(oi)),
                          text:    o.text    || "",
                          xp:      Number(o.xp) || 0,
                          outcome: o.outcome || "",
                        };
                      })
                    : [],
                };
              })
            : [],
        };
      })
    : [];

  return {
    version:      raw.version     || 1,
    title:        raw.title       || "Untitled Story",
    tagline:      raw.tagline     || "",
    theme:        theme,
    coverStyle:   coverStyle,
    isAnonymous:  !!raw.isAnonymous,
    author:       raw.author      || { handle: "", displayName: "" },
    tags:         tags,
    createdAt:    raw.createdAt   || issue.created_at,
    updatedAt:    raw.updatedAt   || issue.updated_at,
    chapters:     chapters,
    _issueNumber: issue.number,
    _issueUrl:    issue.html_url,
    _reactions:   issue.reactions || {},
    _comments:    issue.comments  || 0,
    _updatedAt:   issue.updated_at,
    _labels:      labels,
  };
}

function parseStoryFromIssue(issue) {
  var raw = _extractJson(issue.body);
  return _normaliseStory(raw, issue);
}

// ── In-memory cache of all published stories ────────────────
var _allStoriesCache     = null;
var _allStoriesCacheTime = 0;

async function _fetchAllPublished() {
  if (_allStoriesCache && (Date.now() - _allStoriesCacheTime) < CACHE_TTL_MS) {
    return _allStoriesCache;
  }
  var url = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO
    + "/issues?labels=" + encodeURIComponent(PUBLISHED_LABEL)
    + "&state=open&per_page=100&page=1";
  var issues = await ghFetch(url);
  _allStoriesCache     = issues.map(parseStoryFromIssue).filter(Boolean);
  _allStoriesCacheTime = Date.now();
  return _allStoriesCache;
}

async function fetchPublishedStories(opts) {
  opts = opts || {};
  var page        = opts.page        || 1;
  var perPage     = opts.perPage     || 12;
  var themeFilter = (opts.themeFilter || "").trim();
  var tagFilter   = (opts.tagFilter   || "").trim().toLowerCase();

  var all = await _fetchAllPublished();

  var stories = themeFilter
    ? all.filter(function(s) { return s.theme === themeFilter; })
    : all;

  if (tagFilter) {
    stories = stories.filter(function(s) {
      return (s.tags || []).some(function(t) { return t.toLowerCase().includes(tagFilter); })
          || (s._labels || []).some(function(l) { return l.toLowerCase().includes(tagFilter); });
    });
  }

  var start   = (page - 1) * perPage;
  var paged   = stories.slice(start, start + perPage);
  return { stories: paged, hasMore: stories.length > (start + perPage), total: stories.length };
}

async function fetchStoryByIssue(issueNumber) {
  var url   = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/issues/" + issueNumber;
  var issue = await ghFetch(url);

  // Debug helper — paste in browser console: sqDebug(5)
  window._lastIssueBody = issue.body;

  var story = parseStoryFromIssue(issue);
  if (!story) {
    console.error("StoryQuest: failed to parse issue #" + issueNumber);
    console.error("Raw body repr:", JSON.stringify(issue.body));
    throw new Error(
      "Could not parse story from issue #" + issueNumber + ". " +
      "Open the browser console (F12) and run: sqDebug(" + issueNumber + ")"
    );
  }
  return story;
}

// ── Browser console debug helper ────────────────────────────
window.sqDebug = async function(issueNumber) {
  var url   = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/issues/" + issueNumber;
  var issue = await fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function(r){ return r.json(); });
  console.log("=== RAW BODY ===");
  console.log(issue.body);
  console.log("=== REPR ===");
  console.log(JSON.stringify(issue.body));
  console.log("=== PARSE ATTEMPT ===");
  var raw = _extractJson(issue.body);
  console.log("Extracted:", raw);
  return raw;
};

function trendingScore(story) {
  var r        = story._reactions || {};
  var positive = (r["+1"] || 0) + (r.heart || 0) + (r.hooray || 0) + (r.rocket || 0);
  var comments = story._comments || 0;
  var ms       = Date.now() - new Date(story._updatedAt || story.updatedAt || Date.now()).getTime();
  return (positive * 3 + comments * 2) / Math.max(1, ms / (1000 * 60 * 60 * 24));
}
