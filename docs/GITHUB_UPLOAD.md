# Uploading to GitHub and publishing the page

Two ways to upload: through the GitHub website (no tools needed) or with git on the command line. Then turn on **GitHub Pages** to get a free public link anyone can open, with no Claude or GitHub account.

> **Before uploading:** make sure there are no real student files in the folder. Only `assets/ImportCandidate_template.xlsx` and `tests/samples/*.xlsx` (fake data) should be `.xlsx` files.

---

## Step 1: Create the repository

1. Sign in at <https://github.com> (create a free account if needed).
2. Click **+** (top right) → **New repository**.
3. Repository name: `ibn-alhaytham-etesting-converter`
4. Choose **Public** (GitHub Pages is free for public repositories).
5. Leave "Add a README" **unchecked** (the project already has one).
6. Click **Create repository**.

## Step 2, option A: Upload through the website

1. Unzip `ibn-alhaytham-etesting-converter.zip` on your computer.
2. In the new repository page, click **uploading an existing file**.
3. Open the unzipped folder, select **everything inside it** (not the folder itself) and drag it into the browser.
4. Commit message: `First version of the converter`, then click **Commit changes**.

The `.gitignore` file starts with a dot and may be hidden. On Windows: File Explorer → View → Show → Hidden items. On macOS: press `Cmd + Shift + .` in Finder.

## Step 2, option B: Upload with git

Install git from <https://git-scm.com> if needed, then in a terminal:

```bash
cd ibn-alhaytham-etesting-converter

git init -b main
git config user.name  "Your Name"            # first time only
git config user.email "you@example.com"      # first time only
git add .
git status                                    # check: no real student .xlsx files listed
git commit -m "First version of the converter"

git remote add origin https://github.com/YOUR-USERNAME/ibn-alhaytham-etesting-converter.git
git push -u origin main
```

When asked for a password, use a **personal access token**, not your GitHub password: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token → give it *Contents: Read and write* on this repository.

## Step 3: Turn on GitHub Pages

1. In the repository, go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait 1 to 2 minutes and refresh. The link appears at the top:

```
https://YOUR-USERNAME.github.io/ibn-alhaytham-etesting-converter/
```

Direct links to each direction:

```
https://YOUR-USERNAME.github.io/ibn-alhaytham-etesting-converter/#roster
https://YOUR-USERNAME.github.io/ibn-alhaytham-etesting-converter/#grades
```

Share this link with colleagues. Files they upload are processed in their own browser and are never sent to GitHub.

## Updating later

After changing anything in `src/`:

```bash
python3 build.py
node tests/unit.test.js
git add .
git commit -m "Describe the change"
git push
```

With the website route, upload the new `index.html` (and any changed files) the same way; GitHub replaces them. Pages updates within a couple of minutes.
