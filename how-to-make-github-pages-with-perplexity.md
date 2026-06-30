# How to Make GitHub Pages with Perplexity

A practical guide for building and deploying a static website to GitHub Pages using Perplexity as your AI coding and content assistant.

---

## Overview

[GitHub Pages](https://pages.github.com/) is a free static site hosting service built into every GitHub repository. Combined with [Perplexity](https://www.perplexity.ai/), you can generate HTML, CSS, and JavaScript entirely through conversation — no local build tools required.

**What you need:**
- A GitHub account
- A public repository (or GitHub Pro/Team for private repos)
- A Perplexity account (free tier works)

---

## Step 1: Prepare Your Repository

If you don't have a repository yet, create one on GitHub. This repo (`uutisseuranta`) is already set up.

Decide which deployment source you want:

| Source | Use case |
|---|---|
| `main` branch root (`/`) | Simple sites — all files in repo root |
| `main` branch `/docs` folder | Keeps source and site files separate |
| `gh-pages` branch | CI/CD workflows, generated static builds |

For a quick start, the `main` branch root is the easiest.

---

## Step 2: Generate Your Site with Perplexity

Open Perplexity and describe what you want to build. Be specific — the more context you give, the better the output.

**Example prompts:**

```
Build a single-file HTML news tracker dashboard. Dark/light mode toggle,
cards for each news source, last-updated timestamps. Use Tailwind CDN.
No build tools — must work as a static file on GitHub Pages.
```

```
Write a responsive landing page for a Finnish news aggregator project.
Minimalist design, Finnish and English language toggle, no frameworks,
plain HTML/CSS/JS only. Include a <head> with correct meta tags.
```

**Key constraints to always mention to Perplexity:**
- "Single static HTML file" or "pure HTML/CSS/JS"
- "No server-side code"
- "Must work on GitHub Pages" (implies no Node.js backend)
- "CDN libraries only" if you want external dependencies
- Your preferred color scheme, language, or brand

---

## Step 3: Refine the Output

Perplexity generates code iteratively. After the first output:

1. **Test locally** — open the HTML file in your browser directly (`file://`)
2. **Identify issues** — broken layout, missing features, wrong colors
3. **Ask follow-up questions** — be specific:

```
The nav bar overlaps the hero section on mobile (375px width).
Fix the CSS so the nav stacks vertically below 768px.
```

```
Add a search/filter input above the news cards that filters
cards by title text in real-time using vanilla JavaScript.
```

Repeat until the result matches your vision. Perplexity maintains context within a conversation thread, so you can iterate without re-explaining the full project each time.

---

## Step 4: Commit Your Files

Once satisfied, add your files to the repository. You can do this via the GitHub web UI or git CLI.

### Via GitHub web UI

1. Go to your repository on GitHub
2. Click **Add file → Create new file** (or **Upload files**)
3. Name it `index.html` (GitHub Pages serves this as the root page)
4. Paste the generated code
5. Commit directly to `main`

### Via git CLI

```bash
git clone https://github.com/jaakkokorhonen/uutisseuranta.git
cd uutisseuranta

# Copy your generated file
cp ~/Downloads/generated-site.html index.html

git add index.html
git commit -m "feat: add GitHub Pages site"
git push origin main
```

### File naming

| File | Purpose |
|---|---|
| `index.html` | Root page — served at `https://username.github.io/repo/` |
| `404.html` | Custom not-found page |
| `style.css` | External stylesheet (optional) |
| `script.js` | External script (optional) |

For single-file sites (all CSS and JS inlined), only `index.html` is needed.

---

## Step 5: Enable GitHub Pages

> **GitHub Pages isn't enabled automatically — you need to turn it on in your repo settings.**

This is the one required manual step. Without it, your site will not be served even if `index.html` exists on the branch.

1. Go to [Settings → Pages](https://github.com/jaakkokorhonen/uutisseuranta/settings/pages) in your repo
2. Under **Source**, select **Deploy from a branch**
3. Choose branch: `main`, folder: `/ (root)`
4. Click **Save**

GitHub will build and deploy the site. The first deploy takes 1–3 minutes.

Your site URL will be:
```
https://jaakkokorhonen.github.io/uutisseuranta/
```

---

## Step 6: Verify the Deployment

- Go to **Settings → Pages** — a green banner shows the live URL when deployment succeeds
- Check **Actions** tab for deployment logs if something fails
- Hard-refresh your browser (`Ctrl+Shift+R` / `Cmd+Shift+R`) to bypass cache

**Common issues:**

| Symptom | Cause | Fix |
|---|---|---|
| 404 on root | No `index.html` in deploy folder | Rename entry file to `index.html` |
| CSS/JS not loading | Absolute paths (`/style.css`) | Use relative paths (`./style.css`) |
| Blank white page | JS error on load | Open DevTools Console, fix the error |
| Old version showing | Browser or CDN cache | Hard-refresh, wait 5 min |
| Pages tab missing | Repo is private (free plan) | Make repo public or upgrade |

---

## Step 7: Iterate with Perplexity

After the site is live, continue improving it through Perplexity conversations. Useful iteration patterns:

**Performance:**
```
The page has 3 external CDN scripts. Combine or lazy-load them
so the initial render is faster. No build tools.
```

**Accessibility:**
```
Audit this HTML for WCAG AA compliance. Check heading hierarchy,
alt text, color contrast, and keyboard navigation. Fix all issues.
```

**New features:**
```
Add a sticky header that hides on scroll down and reappears
on scroll up. Pure CSS/JS, no libraries.
```

**SEO:**
```
Add proper Open Graph meta tags, a <title>, and a <meta description>
for this news tracker site. Include Finnish-language og:locale.
```

---

## Tips for Better Perplexity Output

- **Paste your existing code** into the conversation when asking for changes — Perplexity has no memory of previous sessions by default
- **Specify the exact line or component** to change rather than asking for a full rewrite
- **Ask for explanations** alongside code: `"Explain the CSS Grid layout you used"` — this helps you maintain the code later
- **Version your files** in git before major changes so you can roll back
- **Use the file viewer** — paste generated HTML into [htmlpreview.github.io](https://htmlpreview.github.io/) for a quick preview before committing

---

## Example Workflow Summary

```
1. Describe project to Perplexity → get index.html
2. Open in browser → identify issues
3. Ask Perplexity to fix issues → update file
4. Repeat until satisfied
5. git add index.html && git commit -m "..." && git push
6. Enable GitHub Pages: Settings → Pages → Deploy from branch → main / (root) → Save
7. GitHub Pages auto-deploys in ~2 minutes
8. Visit https://jaakkokorhonen.github.io/uutisseuranta/
```

---

## Resources

- [GitHub Pages documentation](https://docs.github.com/en/pages)
- [GitHub Pages supported content](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- [Perplexity](https://www.perplexity.ai/)
- [HTML Preview for GitHub](https://htmlpreview.github.io/)

---

*Guide created with Perplexity AI — June 2026*
