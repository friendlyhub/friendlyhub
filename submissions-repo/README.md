# FriendlyHub App Submissions

Submit your Flatpak app to [FriendlyHub](https://friendlyhub.org) by opening a pull request.

## How to submit

1. Fork this repository
2. Create a directory named with your app ID (reverse-DNS format):
   ```
   org.example.MyApp/
     org.example.MyApp.json            # Flatpak manifest (or .yaml/.yml)
     org.example.MyApp.metainfo.xml    # AppStream metainfo
   ```
3. Open a pull request targeting `main`
4. Automated checks will validate your manifest and metainfo
5. Once merged, your app will be built and submitted for review

## Requirements

- **App ID**: Must be in reverse-DNS format (e.g., `io.github.username.AppName`)
- **Manifest**: A valid Flatpak manifest with `app-id` matching the directory name
- **Metainfo**: A valid [AppStream metainfo](https://www.freedesktop.org/software/appstream/docs/) file with at least one `<release>` entry (the version is extracted from here)

### Optional companion files

If your build needs additional source files (e.g., `cargo-sources.json`, `node-sources.json`), place them in the same directory.

## After your app is accepted

Once your PR is merged and the build succeeds:

- Your app enters the review queue
- A reviewer will check it and either approve or request changes
- On approval, your app is published to the FriendlyHub repository
- You'll be added as a collaborator on your app's build repo (`friendlyhub/<app-id>`) for future updates
- If you log into [friendlyhub.org](https://friendlyhub.org) with your GitHub account, you'll see your app in your dashboard

## Updating your app

After your first submission, you can submit updates by opening PRs directly on your app's build repo (`friendlyhub/<app-id>`). You'll have triage access and can submit PRs from a fork.
