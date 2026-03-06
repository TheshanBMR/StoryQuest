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
    Object.keys(sessionStorage).filter(function(k){ return k.startsWith(CACHE_PREFIX); })
      .forEach(function(k){ sessionStorage.removeItem(k); });
  } catch(e){}
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

// ── Clean all unicode/smart-quote variants ──────────────────
function _clean(str) {
  return str
    // Smart quotes → straight
    .replace(/[\u201C\u201D\u00AB\u00BB\u2033]/g, '"')
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    // Dashes
    .replace(/\u2013/g, "-").replace(/\u2014/g, "--")
    // Non-breaking / zero-width spaces
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
    // Windows line endings
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    // GitHub sometimes wraps bare JSON in a <pre> block in the raw body — strip HTML tags
    .replace(/<[^>]+>/g, "");
}

function _tryParse(str) {
  if (!str) return null;
  try {
    var cleaned = str.trim();
    var result  = JSON.parse(cleaned);
    return (result && typeof result === "object") ? result : null;
  } catch (e) { return null; }
}

// ── Try every strategy to extract a JSON object ─────────────
function _extractJson(body) {
  if (!body) return null;
  var text = _clean(body);

  // Strategy 1: ```json ... ``` fenced block
  var m1 = text.match(/```json\s*([\s\S]*?)```/i);
  if (m1) { var r1 = _tryParse(m1[1]); if (r1) return r1; }

  // Strategy 2: ``` ... ``` fenced block (no language)
  var m2 = text.match(/```\s*([\s\S]*?)```/);
  if (m2) { var r2 = _tryParse(m2[1]); if (r2) return r2; }

  // Strategy 3: Entire body IS the JSON
  var trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    var r3 = _tryParse(trimmed);
    if (r3) return r3;
  }

  // Strategy 4: Find outermost { ... } in body
  var first = trimmed.indexOf("{");
  var last  = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    var r4 = _tryParse(trimmed.slice(first, last + 1));
    if (r4) return r4;
  }

  // Strategy 5: body might have markdown formatting — strip * _ # etc and retry
  var stripped = trimmed
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // strip markdown links
  var first2 = stripped.indexOf("{");
  var last2  = stripped.lastIndexOf("}");
  if (first2 !== -1 && last2 > first2) {
    var r5 = _tryParse(stripped.slice(first2, last2 + 1));
    if (r5) return r5;
  }

  return null;
}

// ── Normalise any raw object into a valid StoryQuest story ──
function _normaliseStory(raw, issue) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.title && !Array.isArray(raw.chapters)) return null;

  var labels = (issue.labels || []).map(function(l) { return l.name; });

  // Theme: from story JSON, else from label, else default
  var theme = (raw.theme || "").trim();
  if (!theme) {
    var tl = labels.find(function(l) { return l.startsWith(THEME_LABEL_PREFIX); });
    if (tl) theme = tl.replace(THEME_LABEL_PREFIX, "");
  }
  if (!THEMES.find(function(t) { return t.id === theme; })) theme = THEMES[0].id;

  // Tags
  var tags = raw.tags;
  if (!Array.isArray(tags) || !tags.length) {
    tags = labels
      .filter(function(l) { return l.startsWith(TAG_LABEL_PREFIX); })
      .map(function(l)    { return l.replace(TAG_LABEL_PREFIX, ""); });
  }

  // CoverStyle: accept any known id OR fall back gracefully to aurora
  var coverStyle = (raw.coverStyle || "").trim();
  if (!COVER_STYLES.find(function(c) { return c.id === coverStyle; })) {
    coverStyle = COVER_STYLES[0].id; // "aurora"
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
    version:      raw.version      || 1,
    title:        raw.title        || "Untitled Story",
    tagline:      raw.tagline      || "",
    theme:        theme,
    coverStyle:   coverStyle,
    isAnonymous:  !!raw.isAnonymous,
    author:       raw.author       || { handle: "", displayName: "" },
    tags:         tags,
    createdAt:    raw.createdAt    || issue.created_at,
    updatedAt:    raw.updatedAt    || issue.updated_at,
    chapters:     chapters,
    _issueNumber: issue.number,
    _issueUrl:    issue.html_url,
    _reactions:   issue.reactions  || {},
    _comments:    issue.comments   || 0,
    _updatedAt:   issue.updated_at,
    _labels:      labels,
  };
}

function parseStoryFromIssue(issue) {
  var raw = _extractJson(issue.body);
  return _normaliseStory(raw, issue);
}

// ── In-memory store of all published stories ────────────────
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

// ── Public: paginated + filtered list ──────────────────────
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
  var hasMore = stories.length > (start + perPage);
  return { stories: paged, hasMore: hasMore, total: stories.length };
}

// ── Public: single story by issue number ───────────────────
async function fetchStoryByIssue(issueNumber) {
  var url   = GITHUB_API_BASE + "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/issues/" + issueNumber;
  var issue = await ghFetch(url);
  var story = parseStoryFromIssue(issue);
  if (!story) {
    throw new Error(
      "Could not parse story from issue #" + issueNumber + ". " +
      "Please wrap the JSON in a ```json code fence in the issue body."
    );
  }
  return story;
}

// ── Trending score ──────────────────────────────────────────
function trendingScore(story) {
  var r        = story._reactions || {};
  var positive = (r["+1"] || 0) + (r.heart || 0) + (r.hooray || 0) + (r.rocket || 0);
  var comments = story._comments || 0;
  var ms       = Date.now() - new Date(story._updatedAt || story.updatedAt || Date.now()).getTime();
  var ageDays  = Math.max(1, ms / (1000 * 60 * 60 * 24));
  return (positive * 3 + comments * 2) / ageDays;
}
