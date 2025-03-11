# Contributing to Shortest

Thanks for your interest in contributing! This document will help you get started.

## Quick start

1. Set up the repository
```bash
git clone https://github.com/antiwork/shortest.git
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

## Feature implementation process

We prioritize issues from the current milestone. Check the [roadmap](https://github.com/orgs/antiwork/projects/5/views/3?query=sort%3Aupdated-desc+is%3Aopen) to see which issues we're focusing on right now.

### Issue states

- **Scoping needed**: The issue requires an implementation plan before development can start. If you want to work on this issue, first create an implementation plan outlining the approach.
- **Building needed**: The issue has been scoped and is ready for development. You can start implementing it immediately. If you have any clarifying questions, post a comment on the issue.

### Implementation plan

To have an issue moved from _Scoping needed_ to _Building needed_, create an implementation plan that outlines:
  - technical approach
  - key components and interfaces
  - potential challenges
  - testing strategy

[Create a discussion](https://github.com/antiwork/shortest/discussions/new?category=general) to get feedback on the implementation plan from maintainers before beginning development.

> [!IMPORTANT]
> We recommend waiting until an issue has moved to _Building needed_ before submitting a PR. PRs for issues in the _Scoping needed_ state might need significant rework or may be put on hold until proper scoping is complete.

## Development

1. Create your feature branch
```bash
git checkout -b feature/your-feature
```

2. Run the test suite
```bash
pnpm test:unit
```

3. Build the CLI package
```bash
pnpm build
```

4. Test your changes
```bash
pnpm shortest --help
```

5. To test in another project:
```bash
pnpm pack

# In your test project
npm install /path/to/antiwork-shortest-{version}.tgz
npx shortest -h
```

## Pull requests

1. Update documentation as needed
2. Add or update tests for your changes
3. Make sure all tests pass
4. Request a review from maintainers
5. After reviews begin, avoid force-pushing to your branch
   - Force-pushing rewrites history and makes review threads hard to follow
   - Don't worry about messy commits - we squash everything when merging to `main`

## Style guide

- Follow the existing code patterns
- Use clear, descriptive variable names
- Don't add inline comments unless necessary (code should document itself)

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

- Check existing [discussions](https://github.com/antiwork/shortest/discussions)/[issues](https://github.com/antiwork/shortest/issues)/[PRs](https://github.com/antiwork/shortest/pulls) before creating new ones
- Start a discussion for questions or ideas
- [Open an issue](https://github.com/antiwork/shortest/issues/new/choose) for bugs or problems
