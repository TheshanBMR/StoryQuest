# StoryQuest 📖

> Interactive life stories with chapters and choice moments — powered by GitHub Issues.

**Live Site:** <a href="https://theshanbmr.github.io/StoryQuest/" target="_blank">StoryQuest</a>

## What is this?

StoryQuest is a static website where users:
1. **Write** interactive life stories (chapters + choices with XP)
2. **Preview** stories locally in the browser
3. **Publish** by pasting a JSON template into a GitHub Issue
4. **Read** stories from the community feed, earning XP for choices

## Tech Stack

- Pure HTML, CSS, Vanilla JavaScript — no frameworks
- GitHub Issues as public read-only database
- LocalStorage for draft persistence
- GitHub REST API (unauthenticated) for fetching stories

## Publishing a Story

1. Write your story in the editor at `/editor.html`
2. Click **🚀 Publish** to generate the issue template
3. Open [Issues → New Issue](https://github.com/TheshanBMR/StoryQuest/issues/new)
4. Paste the template, set the title, add labels (`published`, `theme:XXX`, `tag:YYY`)
5. Submit — your story is live at `/s.html?id=ISSUE_NUMBER`

## Labels Schema

| Label                | Meaning                      |
|----------------------|------------------------------|
| `published`          | Required — marks story public |
| `theme:comeback`     | Theme tag                    |
| `theme:glowup`       | Theme tag                    |
| `theme:villain_arc`  | Theme tag                    |
| `theme:school_life`  | Theme tag                    |
| `theme:hustle`       | Theme tag                    |
| `theme:gaming_journey` | Theme tag                  |
| `theme:travel`       | Theme tag                    |
| `tag:ANYTHING`       | Custom searchable tag        |

## Story JSON Schema

```json
{
  "version": 1,
  "title": "string",
  "tagline": "string",
  "theme": "comeback|glowup|villain_arc|school_life|hustle|gaming_journey|travel",
  "coverStyle": "string",
  "isAnonymous": false,
  "author": { "handle": "@you", "displayName": "Your Name" },
  "tags": ["tag1", "tag2"],
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "chapters": [
    {
      "id": "unique-id",
      "title": "Chapter Title",
      "body": "Chapter content...",
      "choices": [
        {
          "id": "choice-id",
          "prompt": "What do you do?",
          "options": [
            { "id": "a", "text": "Option A", "xp": 10, "outcome": "You chose wisely." },
            { "id": "b", "text": "Option B", "xp": 5,  "outcome": "A safer path." }
          ]
        }
      ]
    }
  ]
}
```

## Configuration

Edit `assets/config.js` to point to your own fork:

```js
const GITHUB_OWNER = "TheshanBMR";
const GITHUB_REPO  = "StoryQuest";
```

## Pages

| File          | Purpose                      |
|---------------|------------------------------|
| `index.html`  | Home: trending + new feed    |
| `explore.html`| Filter feed by theme/tag     |
| `editor.html` | Story editor with autosave   |
| `s.html`      | Interactive story viewer     |
| `me.html`     | My local drafts              |
