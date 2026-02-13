# Changelog

## [0.7.1](https://github.com/nsheaps/claude-utils/compare/v0.7.0...v0.7.1) (2026-02-13)

### Refactoring

* use stdlib.sh in cli-test.sh and add agent teams tests ([07ac4f0](https://github.com/nsheaps/claude-utils/commit/07ac4f0a3079439d57842c8e76ed67456b6f3035))

## [0.7.0](https://github.com/nsheaps/claude-utils/compare/v0.6.2...v0.7.0) (2026-02-12)

### Features

* add stdlib.sh and use it for formatted output in claude.lib.sh ([d474603](https://github.com/nsheaps/claude-utils/commit/d4746031a39e5e2761ee91a451931e2bb0a893c9))

## [0.6.2](https://github.com/nsheaps/claude-utils/compare/v0.6.1...v0.6.2) (2026-02-12)

### Refactoring

* use exec for run-claude delegation in helper scripts ([3a1103a](https://github.com/nsheaps/claude-utils/commit/3a1103a739c5049be06353b25d3bdda362372dcb))

## [0.6.1](https://github.com/nsheaps/claude-utils/compare/v0.6.0...v0.6.1) (2026-02-12)

### Refactoring

* route all helper scripts through run-claude ([45ec1b4](https://github.com/nsheaps/claude-utils/commit/45ec1b4bb62117a1bf170de45545ad1cbab2f71f))

## [0.6.0](https://github.com/nsheaps/claude-utils/compare/v0.5.1...v0.6.0) (2026-02-12)

### Features

* add settings.json backup check on claude entry and exit ([42a2f8f](https://github.com/nsheaps/claude-utils/commit/42a2f8fc24a3b2b978bd562a4e022c5694ab8dfd))

## [0.5.1](https://github.com/nsheaps/claude-utils/compare/v0.5.0...v0.5.1) (2026-02-11)

## [0.5.0](https://github.com/nsheaps/claude-utils/compare/v0.4.0...v0.5.0) (2026-01-27)

### Features

* add gum dependency and enhance run-claude help output with claude's help info ([9381e50](https://github.com/nsheaps/claude-utils/commit/9381e502a0872c79c315206664aae180bc795dd7))

## [0.4.0](https://github.com/nsheaps/claude-utils/compare/v0.3.0...v0.4.0) (2026-01-21)

### Features

* add claude-utils meta script with --help and --version ([4cb011a](https://github.com/nsheaps/claude-utils/commit/4cb011a588f8ceb79460305abab923e7c6d3934b))

## [0.3.0](https://github.com/nsheaps/claude-utils/compare/v0.2.5...v0.3.0) (2026-01-21)

### Features

* add run-claude bin script for unified claude invocation ([5234835](https://github.com/nsheaps/claude-utils/commit/5234835fc8d6522dbb3cb2aedd0eb30ce06dea89))

## [0.2.5](https://github.com/nsheaps/claude-utils/compare/v0.2.4...v0.2.5) (2026-01-21)

### Refactoring

* remove visual feedback from ccc and ccr scripts ([d771d90](https://github.com/nsheaps/claude-utils/commit/d771d909358349c9e363986be267a3226435d111))

## [0.2.4](https://github.com/nsheaps/claude-utils/compare/v0.2.3...v0.2.4) (2026-01-21)

### Bug Fixes

* use readlink -f to resolve symlinks in scripts ([b5a5dbc](https://github.com/nsheaps/claude-utils/commit/b5a5dbcb595d18a5e24053a999b5a1222e3fbe9d))

## [0.2.3](https://github.com/nsheaps/claude-utils/compare/v0.2.2...v0.2.3) (2026-01-21)

### Bug Fixes

* use cross-platform sed syntax in release hook ([05ef9bd](https://github.com/nsheaps/claude-utils/commit/05ef9bd6f858778d292c111d67c5b3cb0d7f3de5))

## [0.2.2](https://github.com/nsheaps/claude-utils/compare/v0.2.1...v0.2.2) (2026-01-21)

## [0.2.1](https://github.com/nsheaps/claude-utils/compare/v0.2.0...v0.2.1) (2026-01-21)

## [0.2.0](https://github.com/nsheaps/claude-utils/compare/v0.1.4...v0.2.0) (2026-01-21)

### Features

* add additional CLI utilities from AI repo ([a5cd7c5](https://github.com/nsheaps/claude-utils/commit/a5cd7c53ee5c89d6d453626c35d31beeba543e6e))

## [0.1.4](https://github.com/nsheaps/claude-utils/compare/v0.1.3...v0.1.4) (2026-01-21)

### Maintenance

* add renovate config ([4b1f38d](https://github.com/nsheaps/claude-utils/commit/4b1f38d4de895f77740840647de67aad72317ff6))

## [0.1.3](https://github.com/nsheaps/claude-utils/compare/v0.1.2...v0.1.3) (2026-01-21)

### Bug Fixes

* copy github-app-auth action exactly from git-wt ([8b3bcb3](https://github.com/nsheaps/claude-utils/commit/8b3bcb352db3f1811bdd3af65f761d3fd20a2e40))

## [0.1.2](https://github.com/nsheaps/claude-utils/compare/v0.1.1...v0.1.2) (2026-01-21)

### Refactoring

* use gomplate for formula templating instead of sed ([1236853](https://github.com/nsheaps/claude-utils/commit/1236853c428571d7d18fed382b6ed64bcd7d33ab))

## [0.1.1](https://github.com/nsheaps/claude-utils/compare/v0.1.0...v0.1.1) (2026-01-21)

### Bug Fixes

* export GH_TOKEN to GITHUB_ENV for subsequent steps ([10c7fd6](https://github.com/nsheaps/claude-utils/commit/10c7fd6326475eba81bc9c68aa4efe312e3c8ba8))

## 0.1.0 (2026-01-21)

### Features

* add Claude Code CLI utilities ([df660ad](https://github.com/nsheaps/claude-utils/commit/df660ad37687f00215a96b54bbed8004b6cc35b8))

### Bug Fixes

* use Linux-compatible sed syntax in release hook ([c8bdce2](https://github.com/nsheaps/claude-utils/commit/c8bdce235a046f69572157e9657b75333e98ba2c))

### Maintenance

* add yarn.lock for CI ([e9f6eab](https://github.com/nsheaps/claude-utils/commit/e9f6eab4528cf2369e82f63cf3b88caba39e41fe))
* trigger CI ([eb5f800](https://github.com/nsheaps/claude-utils/commit/eb5f800f883b84fb9af023c53b7995c26694b807))
