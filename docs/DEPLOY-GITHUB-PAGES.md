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

## Day-to-day version control

```bash
cd ~/projects/apps/game-scorer

# See what changed
git status
git diff

# Save a snapshot
git add .
git commit -m "Describe what you changed"
git push
```

After `git push`, wait ~1–2 minutes for Actions to deploy; refresh the site on your phone.

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

| Problem | Fix |
|---------|-----|
| Actions workflow fails | **Actions** tab → open the failed run → read the error log. |
| Blank page at Pages URL | Confirm the URL includes the repo name (`/game-scorer/`). Open browser dev tools → Console for 404s. |
| Old version on phone | Hard refresh or clear site data; wait for deploy to finish. |
| `git push` rejected | `git pull --rebase origin main` then push again. |

---

## Optional: custom domain

**Settings → Pages → Custom domain** (e.g. `games.yourfamily.com`). Requires DNS at your domain registrar. HTTPS is automatic on GitHub Pages.
