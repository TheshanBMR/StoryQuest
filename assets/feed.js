// ============================================================
//  StoryQuest — Feed logic (home + explore)
// ============================================================

const FeedModule = (() => {
  let _stories        = [];
  let _page           = 1;
  let _hasMore        = false;
  let _loading        = false;
  let _themeFilter    = "";
  let _tagFilter      = "";
  let _sort           = "trending";
  let _targetGrid     = null;
  let _loadMoreBtn    = null;
  let _errorBanner    = null;

  function init({ gridEl, loadMoreBtn, errorEl }) {
    _targetGrid  = gridEl;
    _loadMoreBtn = loadMoreBtn;
    _errorBanner = errorEl;
  }

  function setFilters({ theme = "", tag = "", sort = "trending" }) {
    _themeFilter = theme;
    _tagFilter   = tag;
    _sort        = sort;
    _page        = 1;
    _stories     = [];
  }

  function _sortStories(list) {
    if (_sort === "new") {
      return [...list].sort((a, b) =>
        new Date(b._updatedAt || b.updatedAt) - new Date(a._updatedAt || a.updatedAt)
      );
    }
    return [...list].sort((a, b) => trendingScore(b) - trendingScore(a));
  }

  async function load() {
    if (_loading) return;
    _loading = true;
    if (_loadMoreBtn) _loadMoreBtn.disabled = true;
    if (_page === 1 && _targetGrid) _targetGrid.innerHTML = spinnerHtml();

    try {
      const { stories, hasMore } = await fetchPublishedStories({
        page:        _page,
        perPage:     12,
        themeFilter: _themeFilter,
        tagFilter:   _tagFilter,
      });

      _hasMore = hasMore;
      _stories = _page === 1 ? stories : [..._stories, ...stories];

      const sorted = _sortStories(_stories);
      renderStories(sorted);
      if (_page === 1 && _errorBanner) _errorBanner.classList.add("hidden");

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

  function renderStories(list) {
    if (!_targetGrid) return;
    if (!list.length) {
      _targetGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">📖</div>
          <div class="empty-state__title">No stories found</div>
          <p>Be the first to publish one!</p>
        </div>`;
      return;
    }
    _targetGrid.innerHTML = list.map(s =>
      storyCardHtml(s, `s.html?id=${s._issueNumber}`)
    ).join("");
  }

  return { init, setFilters, load, loadMore };
})();
