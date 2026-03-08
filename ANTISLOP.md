# Anti-Slop Rules

## 1. Use existing project utilities — never reinvent

Before writing any helper logic, search the codebase for existing utils that do the same thing. If the project already has a function for it, use it. Always search before writing.

## 2. Respect the project's localization/translation pipeline

Never add translations directly if the project uses a translation platform (Weblate, Crowdin, Transifex, etc.). Only add strings in the source language. Never generate translations for languages the user doesn't personally know.

## 3. Prefer platform-standard APIs over third-party-specific integrations

Before tying a feature to a specific third-party service or app, research whether the platform (Android, iOS, web, OS) provides a standard API that achieves the same thing and works with any compatible app/service. Don't create hard dependencies on a single external package when a generic approach exists.

## 4. Put precondition checks where they prevent wasted work

If a feature requires an external dependency (app installed, service available, API key present), check for it at the earliest point — during availability/eligibility checks, not deep in the execution path. Don't let the user invoke something that was never going to work.

## 5. Use features you already built

If the branch introduces new framework capabilities, the code on that same branch must use them. Don't build infrastructure and then ignore it in the consuming code.

## 6. Use distinct types/classes for distinct outcomes

When modelling outputs, errors, or results as a type hierarchy, each meaningfully different outcome should have its own type. Don't overload a "success" type to also represent "no input" or "not found."

## 7. Link to the right ecosystem

Match links and references to the project's ecosystem. Open-source projects get F-Droid/source links, not proprietary store links. Corporate projects get internal links, not public ones. Know where the project lives.

## 8. Write PR descriptions yourself

Some maintainers explicitly don't want AI-generated PR descriptions. Write them with genuine understanding of the changes. When in doubt, ask the user whether to draft the PR body or let them write it.

## 9. Match the project's style — don't impose your own

Before writing code, read surrounding files. Match naming conventions (camelCase vs snake_case), indentation, brace style, comment style, import ordering, file organization. Don't add docstrings to a codebase that doesn't use them. Don't add type annotations to a codebase that omits them. Blend in.

## 10. Don't add dependencies the project doesn't already use

If the project doesn't use a library, don't pull it in just because it's convenient. Solve the problem with what's already in the dependency tree, or ask first.

## 11. Don't over-comment

Don't add comments that restate what the code does. Don't add section dividers, banners, or "--- Helper functions ---" markers. If the surrounding code doesn't have comments, yours shouldn't either. The only acceptable comment explains *why*, never *what*.

## 12. Don't wrap everything in try-catch

Don't add defensive error handling around code that can't realistically fail, or where the framework already handles errors. Match the project's error handling strategy. If the rest of the codebase lets exceptions propagate, do the same.

## 13. Don't add configuration for things that should be hardcoded

Not everything needs to be a setting, flag, or parameter. If a value is used once and is unlikely to change, hardcode it. Don't build an options system for a one-line feature.

## 14. Read the whole file before editing it

Never edit a file based on assumptions about what's in it. Read it first. Understand the structure, the patterns, the imports, and what already exists before making changes.

## 15. Don't generate filler

Don't pad output with phrases like "Here's the implementation", "This should work", "Let me know if you need changes." Don't pad code with placeholder TODOs, "example" values, or stub implementations that do nothing. Either do the work or say what's missing.

## 16. Don't add unused imports or dead code

Every import must be used. Every function must be called. Every variable must be read. Don't leave scaffolding behind.

## 17. Check what the project's CI/linter/formatter expects

Before submitting code, check if the project has lint configs, formatters, or CI checks. Don't write code that will immediately fail the project's own quality gates.

## 18. Don't create files that weren't asked for

Don't create README files, documentation, config files, or helper modules unless explicitly requested or clearly necessary. One well-placed edit beats a new file every time.

## 19. Understand the architecture before adding to it

Before adding a new module/skill/plugin/feature, understand how existing ones are structured. Follow the same registration pattern, directory layout, and naming scheme. Don't invent a new pattern when one exists.

## 20. Don't hallucinate APIs

Never call a method, use a class, or reference a constant without verifying it exists in the codebase or the actual library version the project uses. Search first. Guess never.

## 21. Verify the latest version before adding any dependency

Never add a library or dependency using a version from memory — it is probably outdated or wrong. Always look up the actual latest version (check the project's registry, repository, or release page) before adding it. Pinning a stale version creates immediate tech debt and may pull in known vulnerabilities.

## 22. Don't silently swallow errors

Empty catch blocks hide bugs. If you catch an exception, do something meaningful — log it, convert it, rethrow it. A catch block with just a comment is not handling an error.

## 23. Check git history before changing code you don't understand

If code looks wrong or unnecessary, check `git log` or `git blame` before removing or rewriting it. It may exist for a reason that isn't obvious from the code alone.

## 24. Don't use regex when a simple string operation will do

`string.endsWith(".json")` beats a regex. `split(":")` beats a regex. Only use regex when the pattern actually requires it.

## 25. Don't hardcode paths, URLs, or identifiers that vary by environment

Paths like `/home/user/...`, localhost URLs, hardcoded ports — these break on any machine that isn't yours. Use the project's config mechanism or platform APIs to resolve them.

## 26. Run the build after making changes

Don't assume your changes compile or pass. If the project has a build command, run it. If it has tests, run them. Don't hand back code that doesn't build.

## 27. Don't rename things without updating all references

Renaming a function, class, variable, or file means finding and updating every usage. A rename that misses call sites is worse than no rename at all.

## 28. Don't add layers of indirection for no reason

If a function just calls another function, delete it. If a class just wraps another class with no added behavior, delete it. Indirection must earn its existence.

## 29. Don't assume UTF-8 / English / LTR

If the project supports multiple locales or encodings, respect that. Don't hardcode string comparisons, sorting, or formatting that only works in English.

## 30. Don't mix unrelated changes in one commit or PR

Each change should do one thing. A bug fix doesn't include a refactor. A new feature doesn't include unrelated cleanup. Keep changes reviewable.

## 31. Don't generate tests that test mocks instead of behavior

A test that mocks everything and asserts the mock was called proves nothing. Tests should verify actual behavior. Only mock what you must — external services, I/O, time.

## 32. Use the project's existing error/result types

If the project has an error type, result wrapper, or response pattern, use it. Don't invent a parallel error handling mechanism.

## 33. Don't copy-paste code — find the abstraction or leave it

If you're about to paste the same block a third time, extract it. But if it's only twice and the duplication is trivial, leave it. Don't create a premature abstraction, and don't create hidden duplication.

## 34. Respect .gitignore and don't commit generated files

Check what the project ignores. Don't commit build artifacts, IDE configs, OS files, or generated code unless the project explicitly tracks them.

## 35. Don't add async/concurrency when the task is synchronous

Don't make something async, threaded, or concurrent unless there's an actual reason (I/O, parallelism, UI responsiveness). Unnecessary concurrency adds complexity and bugs for zero benefit.

## 36. Consider what happens on partial failure

If a function does three things and the second one fails, what state is the system in? Don't write multi-step operations that leave things half-done without cleanup or rollback.

## 37. Don't use deprecated APIs

If something is deprecated in the version the project uses, use the replacement. Check the docs. Training data is stale — what was current then may be deprecated now.
