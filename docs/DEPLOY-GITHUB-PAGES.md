# Deploy with Git & GitHub Pages

Host **Game Scorer** for free at a stable URL (e.g. `https://<username>.github.io/game-scorer/`) so phones and family devices can use it without your Mac running a server.

---

## One-time setup

### 1. Install Git (if needed)

Mac usually has Git. Check:

```bash
git --version
```

### 2. Create a GitHub repository

1. Log in at [github.com](https://github.com).
2. **New repository** → name it `game-scorer` (or any name).
3. **Public** repo (required for free GitHub Pages on personal accounts).
4. Do **not** add a README, `.gitignore`, or license (this project already has them).
5. Copy the repo URL, e.g. `https://github.com/YOUR_USERNAME/game-scorer.git`.

### 3. Initialize Git and push from your Mac

```bash
cd ~/projects/apps/game-scorer

git init
git branch -M main
git add .
git commit -m "Initial commit: Game Scorer web app"
git remote add origin https://github.com/YOUR_USERNAME/game-scorer.git
git push -u origin main
```

Replace `YOUR_USERNAME` and the repo name if yours differ.

GitHub may ask you to sign in (browser or personal access token).

### 4. Turn on GitHub Pages (GitHub Actions)

1. Open your repo on GitHub.
2. **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment** → **Source**, choose **GitHub Actions**.
4. After the first push, open the **Actions** tab. The workflow **Deploy to GitHub Pages** should run and finish green.
5. Back on **Settings → Pages**, note the **live URL** (often `https://YOUR_USERNAME.github.io/game-scorer/`).

The workflow file is `.github/workflows/deploy-pages.yml` — it redeploys automatically on every push to `main`.

---

## Publish changes from Cursor (your normal workflow)

You do **not** need anyone else to update the live site. GitHub Pages updates when **you push** to `main`.

### Every time you want the website to match your Mac

1. **Save your files** in Cursor (`Cmd+S` on open files).
2. Open **Terminal** in Cursor (**Terminal → New Terminal**) or use Mac Terminal.
3. Run these four steps:

```bash
cd ~/projects/apps/game-scorer

git status
```

Read the list — red = changed, green = new. If it says `nothing to commit`, you have nothing to publish yet.

```bash
git add .
git commit -m "Short note: what you changed"
git push
```

Example messages: `Fix Rook bid stepper`, `Add mobile styles for profiles`.

4. **Wait ~1–2 minutes.** Open **https://github.com/tpuls16/game-scorer/actions** — wait for **Deploy to GitHub Pages** to show a **green checkmark**.
5. On your phone, open **https://tpuls16.github.io/game-scorer/** and **refresh** (or close the tab and open again).

That’s the full loop. Edit in Cursor → `add` → `commit` → `push` → wait → refresh phone.

### Test before you publish (optional)

Use the local server while building; only `git push` when you want family to see it:

```bash
cd ~/projects/apps/game-scorer
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) on your Mac. Stop the server with **Ctrl+C** when done.

### Cursor Source Control panel (optional)

Instead of terminal commands, you can use the **branch icon** in the left sidebar:

1. See changed files under **Changes**
2. Type a message in the box
3. Click **Commit**
4. Click **Sync Changes** or **Push** (upload to GitHub)

Same result as `git add` / `commit` / `push`.

### What you do *not* need to do

- Re-run Pages setup in Settings each time  
- Upload files manually on github.com  
- Keep `python3 -m http.server` running for the public site  
- Ask the AI to push for you (unless you want help writing the commit message)

### If push works but the phone still shows the old app

- Hard refresh Safari (or clear site data for that URL)  
- Confirm Actions finished green  
- Confirm you’re opening **https://tpuls16.github.io/game-scorer/** (with `/game-scorer/`)

---

## Share with family

Send the Pages URL. Each person should **bookmark** it or **Add to Home Screen** (Safari → Share).

**Reminder:** Scores and household players are stored **in that device’s browser**, not on GitHub. Phones do not sync with each other unless you add cloud sync later.

---

## “Turn off” the live site

| Goal | How |
|------|-----|
| Stop updating the public site | Stop pushing to `main`, or disable the workflow under **Actions**. |
| Remove the site entirely | **Settings → Pages** → set Source to **None**, or delete the GitHub repo. |

Local development still works with:

```bash
python3 -m http.server 8080
```

---

## Troubleshooting

### Failed run titled “Initial creation of Game Scorer” (or similar)

That is usually your **commit message** on the run list. The workflow is still **Deploy to GitHub Pages** (file: `.github/workflows/deploy-pages.yml`).

Click the run → expand the **deploy** job:

| Step that failed | What it means | Fix |
|------------------|---------------|-----|
| **Deploy to GitHub Pages** (Upload succeeded) | Pages not enabled for the repo yet | **Settings → Pages** → set **Source** to **GitHub Actions** → **Re-run all jobs** on the failed run |
| **Upload site** | Rare path/permission issue | Confirm workflow file matches this repo; check Actions permissions (below) |
| **Checkout** | Repo/branch issue | Confirm you pushed to `main` |

Direct link for this project: **https://github.com/tpuls16/game-scorer/settings/pages**

Expected live URL after success: **https://tpuls16.github.io/game-scorer/**

### Actions permissions

**Settings → Actions → General → Workflow permissions** → select **Read and write permissions** → **Save**.

### Other issues

| Problem | Fix |
|---------|-----|
| No green run after push | Wait 2 min; refresh **Actions** tab |
| Blank page at Pages URL | URL must include repo name: `/game-scorer/` not just `github.io` |
| Old version on phone | Hard refresh; wait for deploy to finish |
| `git push` rejected | `git pull --rebase origin main` then push again |

### Fallback: deploy without Actions

1. **Settings → Pages**
2. **Source:** **Deploy from a branch**
3. **Branch:** `main` · **Folder:** `/ (root)`
4. Save — GitHub shows the site URL in ~1 minute

You do not need a green Actions run for this path.

---

## Optional: custom domain

**Settings → Pages → Custom domain** (e.g. `games.yourfamily.com`). Requires DNS at your domain registrar. HTTPS is automatic on GitHub Pages.
