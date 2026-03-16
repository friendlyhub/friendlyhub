# FriendlyHub App Submissions

Submit your Flatpak app to [FriendlyHub](https://friendlyhub.org) by opening a pull request to this repository.

## Quick Overview

1. Fork this repo
2. Add your app files in a directory named with your app ID
3. Open a pull request
4. Automated checks validate your submission
5. A maintainer merges the PR
6. Your app is built and enters the review queue

## Directory Structure

Create a directory using your app's reverse-DNS ID. Inside it, place your Flatpak manifest and AppStream metainfo file:

```
org.example.MyApp/
  org.example.MyApp.json            # or .yaml / .yml
  org.example.MyApp.metainfo.xml
```

If your build needs additional source files (e.g. `cargo-sources.json` for Rust apps, `node-sources.json` for Node apps), place them in the same directory and reference them in your manifest's `sources` array.

## File Requirements

### Flatpak Manifest

Your manifest (`.json`, `.yaml`, or `.yml`) must:

- Have an `app-id` field matching your directory name
- Specify a `runtime`, `sdk`, and `command`
- Reference your app's source code using `type: git` with a URL pointing to your upstream repository (not `type: dir`)
- Reference any companion source files by filename (e.g. `"cargo-sources.json"`)

### AppStream Metainfo

Your metainfo file (`{app-id}.metainfo.xml`) must:

- Have an `<id>` matching your app ID
- Include at least one `<release>` entry with a `version` attribute -- this is how FriendlyHub determines your app's version
- Include a `<name>`, `<summary>`, and `<description>`
- Include a `<project_license>` with a valid SPDX identifier

You do **not** need to include the metainfo file in your upstream source repository. FriendlyHub automatically injects it into your build so that `flatpak-builder` can find it. Your manifest's `build-commands` can install it normally:

```yaml
build-commands:
  - install -Dm644 org.example.MyApp.metainfo.xml /app/share/metainfo/org.example.MyApp.metainfo.xml
```

## What Happens When You Open a PR

Automated checks run immediately and post results as a comment on your PR:

- **Manifest validation** -- checks structure, required fields, and correct app ID
- **Metainfo validation** -- checks for required elements and at least one release entry
- **Domain verification** -- checks if your app ID's domain is verified (not required for merge, but verified apps get a badge)

If something fails, the comment will explain what to fix. Push a new commit to re-trigger checks, or comment `/recheck` to re-run without pushing.

### Domain Verification

If your app ID starts with a forge prefix (`io.github.*`, `io.gitlab.*`, etc.), FriendlyHub can verify ownership automatically by checking your GitHub account.

For custom domains, the PR comment will include instructions for placing a verification token at `https://yourdomain.org/.well-known/org.friendlyhub.VerifiedApps.txt`.

Verification is optional -- unverified apps can still be merged and published.

## What Happens After Merge

Once a maintainer merges your PR:

1. FriendlyHub creates a GitHub repository for your app at `friendlyhub/{app-id}`
2. Your manifest, metainfo, and companion files are pushed to that repo
3. A build is triggered via GitHub Actions
4. You receive a collaborator invite to the app repo (with triage access)

If the build succeeds, your app enters the review queue. A human reviewer will check it and either approve it or request changes. On approval, your app is published to the FriendlyHub Flatpak repository.

You'll be notified of build results and review decisions via GitHub issues on your app's repo.

## After Your App Is Published

- Users can install your app with `flatpak install friendlyhub org.example.MyApp`
- Your app appears on [friendlyhub.org](https://friendlyhub.org) and in software centres (GNOME Software, KDE Discover) for users who have the FriendlyHub remote
- Log in to [friendlyhub.org](https://friendlyhub.org) with your GitHub account to see your app in your dashboard

## Submitting Updates

Once your app has been accepted, you submit updates directly to your app's repo (`friendlyhub/{app-id}`), not to this submissions repo.

1. Fork `friendlyhub/{app-id}`
2. Update your manifest (e.g. bump the git tag) and add a new `<release>` entry to your metainfo
3. Open a PR to `main`
4. The same validation, build, and review process applies

You have triage access on your app's repo, so you can manage issues and labels, but changes to the manifest and metainfo go through PRs.

## Example

See the [FriendlyHub developer docs](https://friendlyhub.org/docs/submitting-via-pr) for a full walkthrough with examples.
