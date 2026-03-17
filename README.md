# FriendlyHub

> [!NOTE]
> This project voluntarily adheres to The Friendly Manifesto. Read more [here](https://friendlymanifesto.org)

## What is it?
FriendlyHub is an alternative Flatpak repository at [friendlyhub.org](https://friendlyhub.org). Developers submit their apps through the website or via pull request, builds run automatically for x86_64 and aarch64, and after review the app is published to the repository.

## Adding the FriendlyHub repo

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

Then install apps as usual:

```bash
flatpak install friendlyhub org.example.MyApp
```

## Why?

Existing Flatpak repositories have a painful developer experience: opaque submission processes, gatekeeping on non-safety concerns like icon aesthetics and naming conventions, and aging build infrastructure. FriendlyHub takes a different approach:

- **Clear review criteria** -- reviews focus on safety, accuracy, and whether the app works. No rejections over icon quality, toolkit choice, or coding style.
- **Automated builds** -- modern CI/CD with GitHub Actions, not legacy build systems. Multi-arch support (x86_64 + aarch64) out of the box.
- **Developer-friendly workflow** -- submit through the web UI or open a pull request. Automated checks tell you what to fix before a human ever looks at it.
- **Fully open source** -- front-end, back-end, and build pipeline. Don't like FriendlyHub? Fork it and run your own.

Read more about the policies that make FriendlyHub different by reading [how we adhere to The Friendly Manifesto](https://friendlyhub.org/manifesto).

## Links

- [friendlyhub.org](https://friendlyhub.org) -- browse apps, submit versions, track builds
- [Documentation](https://friendlyhub.org/docs) -- guides for developers, reviewers, and admins
- [Architecture](dev/ARCHITECTURE.md) -- system design and infrastructure overview
