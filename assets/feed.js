// ============================================================
//  StoryQuest — Feed logic (home + explore)
// ============================================================

var FeedModule = (function () {
  var _page        = 1;
  var _hasMore     = false;
  var _loading     = false;
  var _themeFilter = "";
  var _tagFilter   = "";
  var _sort        = "trending";
  var _targetGrid  = null;
  var _loadMoreBtn = null;
  var _errorBanner = null;

  function init(opts) {
    _targetGrid  = opts.gridEl;
    _loadMoreBtn = opts.loadMoreBtn;
    _errorBanner = opts.errorEl;
  }

  function setFilters(opts) {
    opts         = opts || {};
    _themeFilter = opts.theme || "";
    _tagFilter   = opts.tag   || "";
    _sort        = opts.sort  || "trending";
    _page        = 1;
    // Reset in-memory story cache so filtering always starts fresh
    if (typeof _allStoriesCache !== "undefined") {
      _allStoriesCache     = null;
      _allStoriesCacheTime = 0;
    }
  }

  function _sortList(list) {
    if (_sort === "new") {
      return list.slice().sort(function(a, b) {
        return new Date(b._updatedAt || b.updatedAt) - new Date(a._updatedAt || a.updatedAt);
      });
    }
    return list.slice().sort(function(a, b) {
      return trendingScore(b) - trendingScore(a);
    });
  }

  async function load() {
    if (_loading) return;
    _loading = true;
    if (_loadMoreBtn) _loadMoreBtn.disabled = true;
    if (_page === 1 && _targetGrid) _targetGrid.innerHTML = spinnerHtml();

    try {
      var result = await fetchPublishedStories({
        page:        _page,
        perPage:     12,
        themeFilter: _themeFilter,
        tagFilter:   _tagFilter,
      });

      _hasMore = result.hasMore;
      var sorted = _sortList(result.stories);
      _renderStories(sorted, _page > 1);

      if (_errorBanner) _errorBanner.classList.add("hidden");

    } catch (err) {
      if (_errorBanner) {
        _errorBanner.textContent = err.message || "Failed to load stories.";
        _errorBanner.classList.remove("hidden");
      }
      if (_page === 1 && _targetGrid) _targetGrid.innerHTML = "";
    } finally {
      _loading = false;
      if (_loadMoreBtn) {
        _loadMoreBtn.disabled = !_hasMore;
        _loadMoreBtn.classList.toggle("hidden", !_hasMore);
      }
    }
  }

  async function loadMore() {
    _page++;
    await load();
  }

  function _renderStories(list, append) {
    if (!_targetGrid) return;
    if (!list.length && !append) {
      _targetGrid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' +
        '<div class="empty-state__icon">📖</div>' +
        '<div class="empty-state__title">No stories found</div>' +
        '<p>Try a different filter, or <a href="editor.html" style="color:var(--accent)">write one!</a></p>' +
        '</div>';
      return;
    }
    var html = list.map(function(s) {
      return storyCardHtml(s, "s.html?id=" + s._issueNumber);
    }).join("");
    if (append) {
      _targetGrid.insertAdjacentHTML("beforeend", html);
    } else {
      _targetGrid.innerHTML = html;
    }
  }

  return { init: init, setFilters: setFilters, load: load, loadMore: loadMore };
})();
