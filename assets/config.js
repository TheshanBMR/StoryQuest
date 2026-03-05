// ============================================================
//  StoryQuest — Configuration
//  Edit GITHUB_OWNER / GITHUB_REPO to point to your fork.
// ============================================================

const GITHUB_OWNER        = "TheshanBMR";
const GITHUB_REPO         = "StoryQuest";
const PUBLISHED_LABEL     = "published";
const THEME_LABEL_PREFIX  = "theme:";
const TAG_LABEL_PREFIX    = "tag:";

const THEMES = [
  { id: "comeback",        label: "Comeback Arc",     emoji: "🔥", color: "#FF6B35" },
  { id: "glowup",          label: "Glow Up",          emoji: "✨", color: "#A855F7" },
  { id: "villain_arc",     label: "Villain Arc",      emoji: "🖤", color: "#1E1B4B" },
  { id: "school_life",     label: "School Life",      emoji: "📚", color: "#0EA5E9" },
  { id: "hustle",          label: "Hustle",           emoji: "💪", color: "#10B981" },
  { id: "gaming_journey",  label: "Gaming Journey",   emoji: "🎮", color: "#6366F1" },
  { id: "travel",          label: "Travel",           emoji: "🌍", color: "#F59E0B" },
];

const COVER_STYLES = [
  { id: "aurora",    label: "Aurora",    css: "linear-gradient(135deg,#667eea,#764ba2)" },
  { id: "ember",     label: "Ember",     css: "linear-gradient(135deg,#f97316,#ef4444)" },
  { id: "midnight",  label: "Midnight",  css: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
  { id: "ocean",     label: "Ocean",     css: "linear-gradient(135deg,#0575e6,#021b79)" },
  { id: "forest",    label: "Forest",    css: "linear-gradient(135deg,#134e5e,#71b280)" },
  { id: "rose",      label: "Rose",      css: "linear-gradient(135deg,#f953c6,#b91d73)" },
  { id: "gold",      label: "Gold",      css: "linear-gradient(135deg,#f7971e,#ffd200)" },
  { id: "void",      label: "Void",      css: "linear-gradient(135deg,#000000,#434343)" },
];

const REACTION_MAP = {
  "+1":        "👍",
  "-1":        "👎",
  "laugh":     "😂",
  "hooray":    "🎉",
  "confused":  "😕",
  "heart":     "❤️",
  "rocket":    "🚀",
  "eyes":      "👀",
};

const GITHUB_API_BASE = "https://api.github.com";
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5 minutes

// Helpers
function themeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}
function coverById(id) {
  return COVER_STYLES.find(c => c.id === id) || COVER_STYLES[0];
}
