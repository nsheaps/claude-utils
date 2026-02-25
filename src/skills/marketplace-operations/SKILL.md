# Marketplace Operations Guide

Convert and maintain entire plugin marketplaces between Claude Code and OpenCode.

## What is a Plugin Marketplace?

A marketplace is a git repository containing multiple plugins. Each platform has its own format:

### Claude Code Marketplace

```
marketplace/
├── .claude-plugin/
│   └── marketplace.json       # Marketplace manifest
├── plugins/
│   ├── plugin-a/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   └── skills/
│   ├── plugin-b/
│   │   └── ...
│   └── plugin-c/
│       └── ...
└── README.md
```

### OpenCode Marketplace (Fork)

```
marketplace-opencode/
├── opencode-marketplace.json  # Marketplace manifest
├── plugins/
│   ├── plugin-a/
│   │   ├── opencode.json
│   │   └── instructions/
│   ├── plugin-b/
│   │   └── ...
│   └── plugin-c/
│       └── ...
├── .github/
│   └── workflows/
│       ├── sync.yaml          # Auto-sync from source
│       ├── validate.yaml      # Validate all plugins
│       └── test.yaml          # Run tests
├── conversion-report.json     # Last conversion report
└── README.md                  # Auto-generated docs
```

## Operations

### Full Marketplace Conversion

```bash
plugin-convert marketplace convert \
  --source /path/to/claude-marketplace \
  --target /path/to/opencode-marketplace \
  --direction claude-to-opencode \
  --parallel 4 \
  --generate-docs \
  --run-validation
```

### Incremental Sync

```bash
plugin-convert marketplace sync \
  --source /path/to/claude-marketplace \
  --target /path/to/opencode-marketplace \
  --direction claude-to-opencode
```

### Validate Marketplace

```bash
plugin-convert marketplace validate \
  --dir /path/to/marketplace \
  --direction claude-to-opencode
```

### Generate CI Workflows

```bash
plugin-convert marketplace init-ci \
  --dir /path/to/marketplace \
  --direction claude-to-opencode
```

## CI Integration

The generated sync workflow:
1. Clones the source marketplace
2. Runs incremental sync
3. Validates all converted plugins
4. Creates a PR with changes
5. Runs on a schedule (every 6 hours by default)

## Best Practices

1. **Keep the source canonical** — Always develop in one format and convert to the other
2. **Review conversion notes** — Check CONVERSION_NOTES.md for each plugin
3. **Test both versions** — Validation catches structural issues but not semantic ones
4. **Pin source versions** — Use git tags or refs when referencing the source marketplace
5. **Monitor CI** — Set up notifications for sync failures
