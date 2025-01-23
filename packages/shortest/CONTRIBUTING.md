# Contributing to Shortest

Thanks for your interest in contributing! This document will help you get started.

## Quick start

1. Set up the repository
```bash
git clone https://github.com/anti-work/shortest.git
cd shortest
pnpm install
```

2. Link CLI for local development
```bash
cd packages/shortest && pnpm link --global
cd ../.. && pnpm link --global shortest
```

3. Configure environment
```bash
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
```

## Development

1. Create your feature branch
```bash
git checkout -b feature/your-feature
```

2. Run the test suite
```bash
pnpm test:ai
pnpm test:browser
pnpm test:github
pnpm test:assertion
```

3. Build the CLI package
```bash
pnpm cli:build
```

## Pull requests

1. Update documentation if you're changing behavior
2. Add or update tests for your changes
3. Update CHANGELOG.md with your changes
4. Make sure all tests pass
5. Request a review from maintainers
6. After reviews begin, avoid force-pushing to your branch
   - Force-pushing rewrites history and makes review threads hard to follow
   - Don't worry about messy commits - we squash everything when merging to `main`

## Style guide

- Write in TypeScript
- Follow the existing code patterns
- Use clear, descriptive variable names

## Writing commit messages

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

A commit message should be structured as follows:

```bash
type(scope): title

description
```

Where type can be:
* `feat`: new feature or enhancement
* `fix`: bug fixes
* `docs`: documentation-only changes
* `test`: test-only changes
* `refactor`: code improvements without behaviour changes
* `chore`: maintenance/anything else

Example:
```
feat(cli): Add mobile testing support
```

## Help

- Check existing discussions/issues/PRs before creating new ones
- Start a discussion for questions or ideas
- Open an issue for bugs or problems
