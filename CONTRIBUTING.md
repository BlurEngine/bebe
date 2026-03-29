# Contributing

Thanks for helping improve `@blurengine/bebe`.

## Local Setup

Requirements:

- Node.js 22 or newer
- npm 10 or newer

Setup:

```bash
npm install
npm run check
```

`npm run check` is the main ownership gate for `bebe`. It covers package formatting, build, unit tests, and pack validation.

`npm install` also installs the local `pre-commit` hook for fast format and lint checks before each commit.

Useful commands:

- `npm run build`
- `npm run format`
- `npm run lint`
- `npm run test`
- `npm run check`
- `npm run changeset`

## Change Expectations

- Keep changes focused and documented.
- Add or update tests when user-facing framework behavior changes.
- Update package docs when exports or usage patterns change.
- For publishable `@blurengine/bebe` changes, run `npm run changeset` and commit the generated `.changeset/*.md` file.

## Release Flow

- Release intent is tracked with Changesets.
- The release workflow is defined in `.github/workflows/publish.yml`.
- GitHub Actions will open or update a release PR from committed changeset files without requiring release-environment approval.
- The workflow only requests `release` environment approval when the local package version is ahead of the version already published on npm.
- Merging the release PR will publish `@blurengine/bebe` through the configured npm trusted publisher workflow after that approval is granted.

## Contributions and Licensing

Unless explicitly stated otherwise, contributions submitted to this project are accepted under the Apache License, Version 2.0.
