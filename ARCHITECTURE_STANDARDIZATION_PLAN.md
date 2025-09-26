# Deep-CLI Architecture Standardization Plan

## Current Problems

### 1. Project Structure Issues
- **Problem**: Confusing nested directory `/deep/deep-cli/packages/`
- **Impact**: Developer confusion, unclear project root
- **Solution**: Flatten to `/deep/packages/` directly

### 2. Build System Failures
- **Problem**: 50+ TypeScript errors, missing `tools` property in DeepConfig
- **Impact**: Cannot build or test the project
- **Solution**: Fix type definitions and test fixtures

### 3. Mixed Testing Architecture
- **Problem**: Tests in both individual packages AND separate `@deep-agent/tests` package
- **Impact**: Confusion, maintenance overhead, circular dependencies
- **Solution**: Choose unified strategy (recommended: embedded tests in each package)

### 4. Configuration Inconsistencies
- **Problem**: Different vitest configs, tsconfig variations
- **Impact**: Inconsistent build behavior, developer confusion
- **Solution**: Standardize all configurations with shared base configs

## Proposed Standardized Structure

```
deep/
├── packages/
│   ├── core/                 # @deep-agent/core
│   │   ├── src/
│   │   │   ├── __tests__/    # Unit tests co-located
│   │   │   └── *.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── cli/                  # @deep-agent/cli
│   │   ├── src/
│   │   │   ├── __tests__/    # Unit tests co-located
│   │   │   └── *.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── integration-tests/    # @deep-agent/integration-tests (optional)
│       ├── src/
│       ├── package.json
│       └── vitest.config.ts
├── docs/
├── .github/
├── package.json             # Root workspace config
├── tsconfig.json           # Base TypeScript config
├── vitest.workspace.ts     # Shared vitest workspace
└── README.md
```

## Implementation Steps

### Phase 1: Fix Build System (Critical)
1. Fix missing `tools` property in DeepConfig across all test files
2. Align DeepEvent type definitions with test objects
3. Resolve TypeScript strict mode violations
4. Ensure clean build across all packages

### Phase 2: Restructure Project Layout
1. Move `/deep/deep-cli/packages/` to `/deep/packages/`
2. Update all package.json workspace references
3. Update import paths and TypeScript project references
4. Update documentation and README files

### Phase 3: Standardize Testing Strategy
1. **Recommended**: Move tests from separate package into individual packages
2. Use `src/__tests__/` convention for co-located tests
3. Create shared test utilities in a common location
4. Remove circular dependencies

### Phase 4: Configuration Standardization
1. Create shared base configurations:
   - `tsconfig.base.json` - Shared TypeScript settings
   - `vitest.workspace.ts` - Workspace-level test configuration
   - `eslint.config.js` - Shared linting rules
2. Update individual package configs to extend base configs
3. Standardize package.json scripts across all packages

### Phase 5: Command Standardization
1. Create consistent npm scripts across all packages
2. Add root-level convenience scripts
3. Ensure `npm run build`, `npm run test`, `npm run lint` work from any level
4. Add development workflow documentation

## Detailed Configuration Standards

### Package.json Script Standards
```json
{
  "scripts": {
    "build": "tsc --build",
    "dev": "tsc --build --watch",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit"
  }
}
```

### TypeScript Configuration Standards
- All packages extend a shared `tsconfig.base.json`
- Consistent compiler options across packages
- Proper project references for monorepo builds
- Strict mode enabled everywhere

### Testing Configuration Standards
- Use vitest workspace configuration
- Consistent coverage thresholds (90%+ for core, 80%+ for CLI)
- Shared test utilities and setup files
- Parallel test execution where possible

## Success Criteria

### Build System
- [ ] `npm run build` completes without errors from root
- [ ] All TypeScript errors resolved
- [ ] Clean builds across all packages

### Testing
- [ ] All tests pass with `npm run test`
- [ ] Coverage thresholds met
- [ ] No flaky or intermittent failures

### Developer Experience
- [ ] Clear project structure that's easy to navigate
- [ ] Consistent commands work from any directory level
- [ ] Good documentation for development workflow

### Production Readiness
- [ ] Clean builds for production deployment
- [ ] All dependencies properly declared
- [ ] No circular dependencies
- [ ] Proper versioning and publishing setup

## Risk Mitigation

1. **Breaking Changes**: Create migration branch and test thoroughly
2. **File Conflicts**: Use git mv commands to preserve history
3. **Import Path Changes**: Update systematically with find/replace
4. **Test Coverage**: Ensure no tests are lost during restructure

## Timeline

- **Week 1**: Fix build system and critical TypeScript errors
- **Week 2**: Restructure project layout and update configurations
- **Week 3**: Standardize testing strategy and remove technical debt
- **Week 4**: Final testing, documentation, and validation

This plan will transform the project from its current broken state into a truly production-ready, maintainable monorepo architecture.