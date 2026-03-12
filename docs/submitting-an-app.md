# Submitting an App

This guide covers the web-based submission flow for publishing a Flatpak app on FriendlyHub.

## Prerequisites

Before you begin, you'll need:

- A **GitHub account** (used for authentication and to host your app's build repository)
- A **Flatpak manifest** (JSON or YAML) that builds your app
- An **AppStream metainfo file** (`.metainfo.xml`) with your app's metadata, screenshots, and release notes

If you're new to Flatpak packaging, the [Flatpak documentation](https://docs.flatpak.org/) is a good starting point.

## Step 1: Register Your App

Sign in to [friendlyhub.org](https://friendlyhub.org) with your GitHub account, then navigate to **Dashboard > My Apps > Register New App**.

### Choose Your Developer Type

- **Original Developer** -- You are the author or official maintainer of the software. You'll need to verify ownership of the domain in your app's ID.
- **Community Packager** -- You're packaging someone else's software for Flatpak. No domain verification is needed, but you must specify the original app's upstream ID.

### Choose Your App ID

Your app ID must be in reverse-DNS format with at least three components, e.g. `org.example.MyApp`.

**For forge-hosted projects** (IDs starting with `io.github.*`, `io.gitlab.*`, etc.), FriendlyHub can automatically verify ownership by checking your GitHub organisation or user account.

**For custom domains**, you'll need to place a verification token at `https://yourdomain.org/.well-known/org.friendlyhub.VerifiedApps.txt`. The token is generated during registration and is shared across all apps under the same domain.

## Step 2: Submit a Version

Once your app is registered and verified (if applicable), go to your app's page in the dashboard and click **Submit Version**.

The submission page has two sections:

### Flatpak Manifest

You can write your manifest using either:

- **Form view** -- A guided form that helps you fill in common fields
- **Editor view** -- A full code editor with JSON/YAML syntax highlighting

The manifest must include the standard Flatpak manifest fields (`id`, `runtime`, `sdk`, `command`, `modules`). You can switch between JSON and YAML formats at any time.

If your build requires additional source files (patches, data files, etc.), you can upload them as part of the submission.

### AppStream Metainfo

Similarly, the metainfo section has both a form view and a code editor. Your metainfo file should include:

- App name and summary
- A description
- At least one screenshot
- At least one release entry
- Project licence (SPDX identifier)

## Step 3: Automated Checks

When you submit, the following automated checks run immediately:

| Check | What it does |
|---|---|
| **Manifest lint** | Validates that your manifest has all required fields and correct structure |
| **Permissions audit** | Flags potentially dangerous sandbox permissions (e.g. full host filesystem access) |
| **Metadata completeness** | Checks for a `.desktop` file and AppStream metainfo reference |

Warnings don't block your submission, but failures do. You'll see detailed feedback on what to fix.

## Step 4: Build

After automated checks pass, FriendlyHub creates a GitHub repository for your app under the `friendlyhub` organisation and triggers a build via GitHub Actions. The build process:

1. Runs `flatpak-builder` with your manifest inside a container
2. Uploads the built Flatpak to flat-manager
3. Notifies the FriendlyHub API that the build is complete

You can follow the build progress in real-time from your submission's detail page. Builds typically take around 10-15 minutes depending on your app's dependencies.

## Step 5: Review

Once the build succeeds, your submission enters the review queue. A human reviewer will check for:

- **Safety** -- No malware, no deceptive behaviour
- **Accurate metadata** -- The app description and screenshots match what the app actually does
- **Working app** -- The built Flatpak runs and does what it claims

### What We Don't Gatekeep On

FriendlyHub follows the [Friendly Manifesto](https://friendlyhub.org/manifesto). We do **not** reject apps based on:

- Icon quality or design choices
- Naming conventions or desktop environment guidelines
- Toolkit or framework choice
- Code quality or architecture
- App complexity, size, or scope
- Whether the code was written with AI assistance

The reviewer will either **approve** your submission or request **changes** with specific, actionable feedback. There is no "rejected" status.

## After Approval

Once approved, your app is published to the FriendlyHub repository. Users can install it immediately:

```bash
flatpak install friendlyhub org.example.MyApp
```

Your app will also appear on the [FriendlyHub website](https://friendlyhub.org/apps), in GNOME Software, and in KDE Discover for users who have the FriendlyHub remote configured.

## Submitting Updates

To submit a new version, go to your app's page in the dashboard and click **Submit Version** again. The process is the same: update your manifest and/or metainfo, submit, automated checks, build, review. Verified developers may be fast-tracked on updates.
