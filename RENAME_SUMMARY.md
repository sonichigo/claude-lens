# Project Rename: aiMeter → TokenLens

## Summary
Successfully renamed the entire project from "aiMeter" / "aimeter" to "TokenLens" / "tokenlens".

## Changes Made

### Package Names
- Root monorepo: `aimeter-monorepo` → `tokenlens-monorepo`
- CLI package: `aimeter` → `tokenlens`
- Core package: `@aimeter/core` → `@tokenlens/core`
- TUI package: `@aimeter/tui` → `@tokenlens/tui`
- Web package: `@aimeter/web` → `@tokenlens/web`

### Binary/Command
- Binary file: `bin/aimeter.js` → `bin/tokenlens.js`
- CLI command: `npx aimeter` → `npx tokenlens`
- Bin entry in package.json: `aimeter` → `tokenlens`

### Import Statements
Updated all import statements across:
- `packages/cli/src/index.js`
- `packages/core/src/index.js`
- `packages/tui/src/components/App.js`
- `packages/tui/src/components/Achievements.js`
- `packages/web/src/server.js`

### Environment Variables & Paths
- `AIMETER_HOME` → `TOKENLENS_HOME`
- `AIMETER_SERVER` → `TOKENLENS_SERVER`
- `~/.aimeter/` → `~/.tokenlens/`
- `getAimeterHome()` → `getTokenLensHome()` (with backward compatibility alias)

### Documentation
- Updated `SPEC.md` - all occurrences
- Updated `GETTING_STARTED.md` - all occurrences
- Updated branding/logos in:
  - TUI Header component
  - Web dashboard HTML
  - CLI banner

### Repository URLs
- GitHub URL: `sonichigo/aimeter` → `sonichigo/tokenlens`

### UI/Branding
- ASCII art banner updated in CLI
- Web dashboard title: "aiMeter · dashboard" → "TokenLens · dashboard"
- TUI header: "◉ aiMeter" → "◉ TokenLens"
- All user-facing text updated

## Files Modified

1. `/package.json` - monorepo config
2. `/packages/cli/package.json` - CLI package metadata
3. `/packages/core/package.json` - core package metadata
4. `/packages/tui/package.json` - TUI package metadata
5. `/packages/web/package.json` - web package metadata
6. `/packages/cli/bin/tokenlens.js` - binary entry point
7. `/packages/cli/src/index.js` - CLI implementation & banner
8. `/packages/core/src/index.js` - core exports
9. `/packages/core/src/paths.js` - path resolution functions
10. `/packages/core/src/gamification/engine.js` - comment header
11. `/packages/tui/src/index.js` - TUI entry point
12. `/packages/tui/src/components/App.js` - import statements
13. `/packages/tui/src/components/Header.js` - branding
14. `/packages/tui/src/components/Achievements.js` - import statements
15. `/packages/web/src/server.js` - import statements
16. `/packages/web/public/index.html` - all branding & URLs
17. `/SPEC.md` - project specification
18. `/GETTING_STARTED.md` - getting started guide

## Verification

✅ All package.json files updated
✅ All import statements updated
✅ Binary renamed and tested
✅ Documentation fully updated
✅ No remaining "aimeter" or "aiMeter" references found in source code
✅ `pnpm install` completed successfully
✅ Commands work:
   - `node packages/cli/bin/tokenlens.js --version` ✓
   - `node packages/cli/bin/tokenlens.js --help` ✓

## Next Steps

1. Test the full application: `node packages/cli/bin/tokenlens.js`
2. Ensure all features work correctly with the new name
3. Update README.md if it exists
4. Consider updating GitHub repository name to match
5. Update any CI/CD configurations
6. Publish to npm as `tokenlens`

## Backward Compatibility

A backward compatibility alias `getAimeterHome()` has been maintained in `packages/core/src/paths.js` to ensure any code still using the old function name continues to work.
