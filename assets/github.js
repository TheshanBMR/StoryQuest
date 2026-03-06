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
    // Expire stale entries
    if (Date.now() - obj.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(_cacheKey(url));
      return null;
    }
    // CRITICAL: reject single-issue cache entries where body is missing
    // (can happen if the API returned a partial response on a previous load)
    var d = obj.data;
    if (d && !Array.isArray(d) && d.number && d.body === undefined) {
      sessionStorage.removeItem(_cacheKey(url));
      return null;
    }
    return d;
  } catch (e) {
    return null;
  }
}

function _setCache(url, data) {
  try {
    sessionStorage.setItem(_cacheKey(url), JSON.stringify({ ts: Date.now(), data: data }));
  } catch (e) {}
}

// Wipe ALL StoryQuest cache entries (call from console if things break)
window.sqClearCache = function () {
  try {
    Object.keys(sessionStorage)
      .filter(function (k) { return k.startsWith(CACHE_PREFIX); })
      .forEach(function (k) { sessionStorage.removeItem(k); });
    // also reset in-memory
    _allStoriesCache     = null;
    _allStoriesCacheTime = 0;
    console.log("StoryQuest cache cleared.");
  } catch (e) {}
};

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

// ── Text cleaner ─────────────────────────────────────────────
function _clean(str) {
  return str
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/\u2013/g, "-").replace(/\u2014/g, "--")
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/<[^>]+>/g, "");
}

function _tryParse(str) {
  if (!str) return null;
  try {
    var r = JSON.parse(str.trim());
    return (r && typeof r === "object" && !Array.isArray(r)) ? r : null;
  } catch (e) { return null; }
}

// ── 7-strategy JSON extractor ────────────────────────────────
function _extractJson(body) {
  if (!body) return null;

  // S1: body is pure JSON already (no cleaning needed)
  var r0 = _tryParse(body);
  if (r0 && r0.title) return r0;

  var text = _clean(body);

  // S2: ```json ... ``` fenced block
  var m1 = text.match(/```json\s*([\s\S]*?)```/i);
  if (m1) { var r1 = _tryParse(m1[1]); if (r1) return r1; }

  // S3: ``` ... ``` fenced block (no lang)
  var m2 = text.match(/```\s*([\s\S]*?)```/);
  if (m2) { var r2 = _tryParse(m2[1]); if (r2) return r2; }

  // S4: whole cleaned body starts with {
  var trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    var r3 = _tryParse(trimmed);
    if (r3) return r3;
  }

  // S5: outermost { ... } in cleaned body
  var first = trimmed.indexOf("{");
  var last  = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    var r4 = _tryParse(trimmed.slice(first, last + 1));
    if (r4) return r4;
  }

  // S6: unescape \" and retry
  var unesc  = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  var first2 = unesc.indexOf("{");
  var last2  = unesc.lastIndexOf("}");
  if (first2 !== -1 && last2 > first2) {
    var r5 = _tryParse(unesc.slice(first2, last2 + 1));
    if (r5) return r5;
  }

  // S7: strip markdown chars then find { ... }
  var stripped = trimmed.replace(/[*_~#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  var first3   = stripped.indexOf("{");
  var last3    = stripped.lastIndexOf("}");
  if (first3 !== -1 && last3 > first3) {
    var r6 = _tryParse(stripped.slice(first3, last3 + 1));
    if (r6) return r6;
  }

  return null;
}

// ── Normalise raw object → valid StoryQuest story ────────────
function _normaliseStory(raw, issue) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.title && !Array.isArray(raw.chapters)) return null;

  var labels = (issue.labels || []).map(function (l) { return l.name; });

  // Theme
  var theme = (raw.theme || "").trim();
  if (!theme) {
    var tl = labels.find(function (l) { return l.startsWith(THEME_LABEL_PREFIX); });
    if (tl) theme = tl.replace(THEME_LABEL_PREFIX, "");
  }
  if (!THEMES.find(function (t) { return t.id === theme; })) theme = THEMES[0].id;

  // Tags
  var tags = Array.isArray(raw.tags) && raw.tags.length
    ? raw.tags
    : labels.filter(function (l) { return l.startsWith(TAG_LABEL_PREFIX); })
             .map(function (l)    { return l.replace(TAG_LABEL_PREFIX, ""); });

  // CoverStyle — always falls back to aurora if unknown
  var coverStyle = (raw.coverStyle || "").trim();
  if (!COVER_STYLES.find(function (c) { return c.id === coverStyle; })) {
    coverStyle = COVER_STYLES[0].id; // "aurora"
  }

  // Chapters
  var chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map(function (ch, i) {
        return {
          id:      ch.id    || ("c" + i),
          title:   ch.title || ("Chapter " + (i + 1)),
          body:    ch.body  || "",
          choices: Array.isArray(ch.choices)
            ? ch.choices.map(function (choice, ci) {
                return {
                  id:      choice.id     || ("ch" + ci),
                  prompt:  choice.prompt || "",
                  options: Array.isArray(choice.options)
                    ? choice.options.map(function (o, oi) {
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
  if (!issue || issue.body === undefined) return null;
  var raw = _extractJson(issue.body);
  return _normaliseStory(raw, issue);
}

// ── In-memory published story cache ──────────────────────────
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

// ── Public: paginated + filtered list ────────────────────────
async function fetchPublishedStories(opts) {
  opts = opts || {};
  var page        = opts.page        || 1;
  var perPage     = opts.perPage     || 12;
  var themeFilter = (opts.themeFilter || "").trim();
  var tagFilter   = (opts.tagFilter   || "").trim().toLowerCase();

  var all = await _fetchAllPublished();

  var stories = themeFilter
    ? all.filter(function (s) { return s.theme === themeFilter; })
    : all;

  if (tagFilter) {
    stories = stories.filter(function (s) {
      return (s.tags || []).some(function (t) { return t.toLowerCase().includes(tagFilter); })
          || (s._labels || []).some(function (l) { return l.toLowerCase().includes(tagFilter); });
    });
  }

  var start = (page - 1) * perPage;
  return {
    stories: stories.slice(start, start + perPage),
    hasMore: stories.length > (start + perPage),
    total:   stories.length,
  };
}

// ── Public: single story by issue number ─────────────────────
async function fetchStoryByIssue(issueNumber) {
  // Always bypass cache for single-issue fetches to avoid stale body=undefined
  var url   = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/issues/" + issueNumber;
  // Remove any cached version first so we always get fresh body
  try { sessionStorage.removeItem(_cacheKey(url)); } catch (e) {}

  var issue = await ghFetch(url);

  if (!issue || issue.body === undefined || issue.body === null) {
    throw new Error("Issue #" + issueNumber + " has no body. It may be empty or private.");
  }

  var story = parseStoryFromIssue(issue);
  if (!story) {
    console.error("StoryQuest parse failure on issue #" + issueNumber);
    console.error("Body repr:", JSON.stringify(issue.body));
    throw new Error(
      "Could not parse story from issue #" + issueNumber + ". " +
      "Open F12 console and run: sqDebug(" + issueNumber + ")"
    );
  }
  return story;
}

// ── Browser debug helper ──────────────────────────────────────
window.sqDebug = async function (issueNumber) {
  var url   = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/issues/" + issueNumber;
  var issue = await fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function (r) { return r.json(); });
  console.log("=== BODY (raw) ===");   console.log(issue.body);
  console.log("=== BODY (repr) ===");  console.log(JSON.stringify(issue.body));
  console.log("=== EXTRACTED ===");
  var raw = _extractJson(issue.body);
  console.log(raw);
  return raw;
};

// ── Trending score ────────────────────────────────────────────
function trendingScore(story) {
  var r        = story._reactions || {};
  var positive = (r["+1"] || 0) + (r.heart || 0) + (r.hooray || 0) + (r.rocket || 0);
  var comments = story._comments || 0;
  var ms       = Date.now() - new Date(story._updatedAt || story.updatedAt || Date.now()).getTime();
  return (positive * 3 + comments * 2) / Math.max(1, ms / 86400000);
}
