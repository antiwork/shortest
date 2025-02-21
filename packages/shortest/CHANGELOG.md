# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2025-02-20

### Changed
- Updated license.md from MIT to match the iffy antiwork license by @ylapscher

### Removed
- Removed another license file unnder packages/shortest by @ylapscher

## [0.4.1] - 2025-01-07

### Added
- Update readme with CLI example by @Harry Roper
- Update README with non-engineer introduction and example tests by @devin-ai-integration[bot]
- Add token usage details in summary by @khalatevarun
- Add baseURL configuration to BrowserManager context by @PedroAVJ
- Update test command example with directory path by @devin-ai-integration[bot]
- Move AI processing logic to more appropriate location by @PedroAVJ

### Fixed
- Improve AI handling of newly opened tabs by @rmarescu

## [0.4.0] - 2025-01-02

### Added
- Chained testing by @crabest
- 'before' function support by @slavingia
- Bash tool by @gladyshcodes

### Changed
- Adjusted the prompt to expect successful test execution by @crabest
- Updated Copyright year from 2024 to 2025 by @crabest
- Refactored config to detect test.ts files instead of files under test directory by @khalatevarun
- Improved index.d.ts generation by @amk-dev
- Updated shortest.config.ts by @slavingia
- Updated npm readme by @m2rads

### Removed
- Removed yarn support by @m2rads

**Full Changelog**: https://github.com/anti-work/shortest/compare/v0.3.0...v0.4.0

## [0.3.0] - 2024-12-30

### Changes
- Added Caching

## [0.2.1] - 2024-12-27

## Added
- Mailosaur integration with error handling for email validation
- Browser-based email preview functionality
- Test execution delay utility (sleep_milliseconds)

## [0.1.1] - 2024-12-24

### Fixed
- Fixed installation of playwright browser in setup script
- Add more robust error handling for playwright browser installation

## [0.1.0] - 2024-12-19

### Added
- Added mouse tracking and click animations for better user experience

## [0.0.9] - 2024-12-17

### Fixed
- Fixed page down and page up browser action

## [0.0.8] - 2024-12-16

### Added
- Added support for playwright's browser and playwright object model
- Rename test namespace to shortest
- Added new lifecycle method called .after() that will only run after the specific test case
- Improve system prompt to be more robust and structured
- Added Windows support for playwright install command

## [0.0.7] - 2024-12-12

### Fixed
- Fixed hooks context not being reset between tests

### Added
- Fixed Cli installation issues
- Updated README with more detailed instructions

## [0.0.5] - 2024-12-09

### Fixed
- Fixed FS build error
- Fixed CLI --headless flag to override config file

### Changed
- Improved Config file loading

⚠️ **Known Issues**
- Using this version with React 18 in Next.js 14+ projects may cause type conflicts with Server Actions and `useFormStatus`
- If you encounter type errors with form actions or React hooks, ensure you're using React 19

## [0.0.4] - 2024-12-06

### Added
- Improved browser navigation performance
- Enhanced AI prompt generation
- Added more robus test reporting
- Add support for playwright's page object model

### Changed
- Simplified test writing with a more intuitive API
- Moved screenshots to `.shortest/screenshots` directory with auto-cleanup
- Removed browser session persistence

## [0.0.3] - 2024-12-01

### Fixed
- Fixed execution order of lifecycle hooks
- Fixed CLI help command requiring GitHub TOTP secret
- Improved browser navigation performance using 'load' instead of 'networkidle'
- Fixed GitHub tool initialization to be lazy-loaded
- Improved error handling in browser navigation

### Changed
- Reduced navigation timeouts for better performance
- Made GitHub TOTP validation more flexible
- Improved browser cleanup on process termination

## [0.0.2] - 2024-11-28

### Fixed
- Fixed type declarations for global functions (define, expect)
- Fixed UITestBuilder type exports
- Improved TypeScript integration in consuming projects

## [0.0.1] - 2024-11-28

### Added
- Initial release (contained type declaration bugs)
- AI-powered test execution using Claude 3.5 Sonnet
- Natural language test writing support
- GitHub integration with 2FA support
- Automatic retry and error handling
- Browser automation using Playwright
- CLI tool for running tests
- Support for ESM and CommonJS

### PeeDependencies
- Playwright ^1.42.1
- Anthropic AI SDK 0.32.0
- esbuild ^0.20.1
- expect ^29.7.0
- dotenv ^16.4.5
