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

// All possible cover styles — includes common names people might type manually
const COVER_STYLES = [
  { id: "aurora",       label: "Aurora",       css: "linear-gradient(135deg,#667eea,#764ba2)" },
  { id: "ember",        label: "Ember",        css: "linear-gradient(135deg,#f97316,#ef4444)" },
  { id: "midnight",     label: "Midnight",     css: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
  { id: "ocean",        label: "Ocean",        css: "linear-gradient(135deg,#0575e6,#021b79)" },
  { id: "forest",       label: "Forest",       css: "linear-gradient(135deg,#134e5e,#71b280)" },
  { id: "rose",         label: "Rose",         css: "linear-gradient(135deg,#f953c6,#b91d73)" },
  { id: "gold",         label: "Gold",         css: "linear-gradient(135deg,#f7971e,#ffd200)" },
  { id: "void",         label: "Void",         css: "linear-gradient(135deg,#000000,#434343)" },
  // Extended — handles manually typed cover styles from older issues
  { id: "neon_rain",    label: "Neon Rain",    css: "linear-gradient(135deg,#00f2fe,#4facfe)" },
  { id: "monsoon_map",  label: "Monsoon Map",  css: "linear-gradient(135deg,#4facfe,#00f2fe)" },
  { id: "neon",         label: "Neon",         css: "linear-gradient(135deg,#00f2fe,#4facfe)" },
  { id: "sunset",       label: "Sunset",       css: "linear-gradient(135deg,#fa709a,#fee140)" },
  { id: "storm",        label: "Storm",        css: "linear-gradient(135deg,#373b44,#4286f4)" },
  { id: "cherry",       label: "Cherry",       css: "linear-gradient(135deg,#eb3349,#f45c43)" },
  { id: "mint",         label: "Mint",         css: "linear-gradient(135deg,#0ba360,#3cba92)" },
  { id: "cosmic",       label: "Cosmic",       css: "linear-gradient(135deg,#d9a7c7,#fffcdc)" },
  { id: "fire",         label: "Fire",         css: "linear-gradient(135deg,#f83600,#f9d423)" },
  { id: "ice",          label: "Ice",          css: "linear-gradient(135deg,#74ebd5,#acb6e5)" },
  { id: "purple",       label: "Purple",       css: "linear-gradient(135deg,#a18cd1,#fbc2eb)" },
  { id: "dark",         label: "Dark",         css: "linear-gradient(135deg,#0f0c29,#302b63)" },
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
function coverCss(id) {
  return coverById(id).css;
}
