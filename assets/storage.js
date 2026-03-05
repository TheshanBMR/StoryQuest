// ============================================================
//  StoryQuest — LocalStorage CRUD
// ============================================================

const DRAFTS_KEY   = "sq_drafts";
const PROGRESS_KEY = "sq_progress"; // viewer XP/chapter per story

// ── Drafts ──────────────────────────────────────────────────

function getAllDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function getDraft(id) {
  return getAllDrafts()[id] || null;
}

function saveDraft(story) {
  if (!story || !story.id) return;
  const all = getAllDrafts();
  story.updatedAt = new Date().toISOString();
  all[story.id] = story;
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(all, null, 2));
}

function deleteDraft(id) {
  const all = getAllDrafts();
  delete all[id];
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(all, null, 2));
}

function listDrafts() {
  const all = getAllDrafts();
  return Object.values(all).sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}

// ── Viewer Progress ─────────────────────────────────────────

function getProgress(storyKey) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return all[storyKey] || { xp: 0, choicesMade: {}, currentChapter: 0 };
  } catch {
    return { xp: 0, choicesMade: {}, currentChapter: 0 };
  }
}

function saveProgress(storyKey, progress) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    all[storyKey] = progress;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all, null, 2));
  } catch {}
}

function clearProgress(storyKey) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    delete all[storyKey];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all, null, 2));
  } catch {}
}

// ── Import / Export ──────────────────────────────────────────

function exportDraftJSON(story) {
  const blob = new Blob([JSON.stringify(story, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = (story.title || "story").replace(/\s+/g, "_") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importDraftJSON(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const story = JSON.parse(e.target.result);
      if (!story.title || !story.chapters) throw new Error("Invalid story JSON");
      if (!story.id) story.id = generateId();
      story.updatedAt = new Date().toISOString();
      saveDraft(story);
      callback(null, story);
    } catch (err) {
      callback(err, null);
    }
  };
  reader.readAsText(file);
}

// ── Utilities ────────────────────────────────────────────────

function generateId() {
  return "sq_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function generateChoiceId() {
  return "ch_" + Math.random().toString(36).slice(2, 9);
}

function generateOptionId() {
  return "op_" + Math.random().toString(36).slice(2, 9);
}
