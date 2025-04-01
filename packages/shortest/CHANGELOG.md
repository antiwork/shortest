# Changelog

> [!NOTE]
> Releases for version v0.2.1 and newer are maintained on the [GitHub Releases page](https://github.com/antiwork/shortest/releases).
> Older versions are kept here for historical purposes.

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
