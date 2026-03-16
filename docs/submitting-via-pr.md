# Submitting via Pull Request

This guide covers the PR-based submission flow. If you prefer a web interface, see [Submitting via the Web](/submitting-an-app).

## Prerequisites

- A **GitHub account**
- A **Flatpak manifest** (JSON or YAML) that builds your app from a git source
- An **AppStream metainfo file** (`.metainfo.xml`) with at least one `<release>` entry

## Step 1: Prepare Your Files

You need two files (and optionally more):

### Flatpak Manifest

A standard Flatpak manifest in JSON or YAML. The key requirement is that your source must use `type: git` pointing to your upstream repository -- not `type: dir`.

```yaml
app-id: org.example.MyApp
runtime: org.gnome.Platform
runtime-version: '49'
sdk: org.gnome.Sdk
command: myapp

modules:
  - name: myapp
    buildsystem: simple
    build-commands:
      - make install PREFIX=/app
      - install -Dm644 org.example.MyApp.metainfo.xml /app/share/metainfo/org.example.MyApp.metainfo.xml
    sources:
      - type: git
        url: https://github.com/yourname/myapp.git
        tag: v1.0.0
```

If your build needs extra source files (e.g. `cargo-sources.json` for Rust, `node-sources.json` for Node.js), include them alongside the manifest and reference them in the `sources` array.

### AppStream Metainfo

An AppStream metainfo XML file. FriendlyHub extracts your app's version from the latest `<release>` entry, so make sure it's present.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>org.example.MyApp</id>
  <name>My App</name>
  <summary>A short description of what your app does</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>GPL-3.0-or-later</project_license>

  <description>
    <p>A longer description of your app.</p>
  </description>

  <releases>
    <release version="1.0.0" date="2026-01-15">
      <description>
        <p>Initial release.</p>
      </description>
    </release>
  </releases>
</component>
```

You do **not** need to include the metainfo file in your upstream source repository. FriendlyHub automatically injects it into the build directory so `flatpak-builder` can find it. Just make sure your manifest installs it:

```yaml
- install -Dm644 org.example.MyApp.metainfo.xml /app/share/metainfo/org.example.MyApp.metainfo.xml
```

## Step 2: Fork and Create Your PR

1. Fork the [friendlyhub/submissions](https://github.com/friendlyhub/submissions) repository
2. Create a directory named with your app ID (reverse-DNS format)
3. Add your manifest, metainfo, and any companion files:

```
org.example.MyApp/
  org.example.MyApp.yaml
  org.example.MyApp.metainfo.xml
  cargo-sources.json          # optional
```

4. Open a pull request targeting `main`

## Step 3: Automated Checks

When you open your PR, automated checks run and post a comment with the results:

- **Manifest validation** -- structure, required fields, correct app ID
- **Metainfo validation** -- required elements, release entries
- **Domain verification** -- whether your app ID's domain can be verified

If something fails, the comment explains what to fix. Push a new commit to re-trigger checks, or comment `/recheck` on the PR.

### Domain Verification

Forge-based app IDs (`io.github.*`, `io.gitlab.*`, etc.) are verified automatically by checking your GitHub account.

For custom domains, the check comment includes instructions for placing a verification token at a well-known URL. Verification is optional -- unverified apps can still be published; verified apps get a badge.

## Step 4: Merge and Build

Once the checks pass and a maintainer merges your PR:

1. FriendlyHub creates a repository at `github.com/friendlyhub/{app-id}`
2. Your manifest, metainfo, and companion files are pushed there
3. A build starts automatically via GitHub Actions
4. You receive a collaborator invite to the repository

You'll be notified of the build result via a GitHub issue on your app's repo.

## Step 5: Review

If the build succeeds, your app enters the review queue. A human reviewer checks for:

- **Safety** -- no malware, no deceptive behaviour
- **Accurate metadata** -- description and screenshots match the app
- **Working app** -- the built Flatpak runs and does what it claims

FriendlyHub follows the [Friendly Manifesto](https://friendlyhub.org/manifesto). We do **not** reject apps based on icon quality, toolkit choice, code quality, or whether the code was written with AI assistance.

The reviewer will either **approve** your app or request **changes** with specific feedback. You'll be notified via a GitHub issue on your app's repo.

## After Approval

Once approved, your app is published to the FriendlyHub repository:

```bash
flatpak install friendlyhub org.example.MyApp
```

Your app also appears on [friendlyhub.org](https://friendlyhub.org), in GNOME Software, and in KDE Discover for users who have the FriendlyHub remote.

Log in to [friendlyhub.org](https://friendlyhub.org) with your GitHub account to manage your app from the dashboard.

## Submitting Updates

After your first submission, updates go through your app's own repository -- not the submissions repo.

1. Fork `friendlyhub/{app-id}` (you already have triage access)
2. Update your manifest (e.g. bump the git tag to a new release)
3. Add a new `<release>` entry to your metainfo
4. Open a PR to `main`

The same validation, build, and review process applies. Verified developers may be fast-tracked on updates.
