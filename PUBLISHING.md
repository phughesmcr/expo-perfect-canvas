# Publishing to npm

This guide explains how to publish the expo-perfect-canvas package to npm.

## Prerequisites

1. **npm account**: Create an account at [npmjs.com](https://www.npmjs.com/)
2. **Login to npm**: Run `npm login` and enter your credentials
3. **Verify login**: Run `npm whoami` to confirm you're logged in

## Pre-publish Checklist

- [ ] Update version in `package.json` following [semantic versioning](https://semver.org/)
- [ ] Update README.md with any new features or breaking changes
- [ ] Test the package locally in a React Native project
- [ ] Commit all changes to git
- [ ] Create a git tag for the version (optional but recommended)

## Publishing Steps

### 1. Test the Package Locally

Before publishing, test the package in your natural-canvas app:

```bash
# In expo-perfect-canvas directory
npm link

# In natural-canvas directory
npm link expo-perfect-canvas

# Test your app thoroughly
npm run android
# or
npm run ios
```

### 2. Check Package Contents

Verify what will be published:

```bash
npm pack --dry-run
```

This shows all files that will be included in the published package.

### 3. Update Version

```bash
# For patch releases (bug fixes)
npm version patch

# For minor releases (new features, backward compatible)
npm version minor

# For major releases (breaking changes)
npm version major
```

### 4. Publish to npm

```bash
# For first-time publishing
npm publish --access public

# For updates
npm publish
```

### 5. Verify Publication

Check that your package is live:
- Visit: https://www.npmjs.com/package/expo-perfect-canvas
- Or run: `npm view expo-perfect-canvas`

## Version Management

### Semantic Versioning

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

### Pre-release Versions

For beta or alpha releases:

```bash
# Beta version
npm version 1.0.0-beta.1

# Publish with beta tag
npm publish --tag beta
```

## Updating an Existing Package

1. Make your changes
2. Update version: `npm version patch/minor/major`
3. Publish: `npm publish`
4. Tag in git: `git tag v1.0.1 && git push --tags`

## Troubleshooting

### Permission Denied

If you get a permission error, ensure:
- You're logged in: `npm login`
- You own the package or are a collaborator
- The package name isn't taken (for first publish)

### Package Name Taken

If `expo-perfect-canvas` is taken, you can:
1. Use a scoped package: `@hokyjack/expo-perfect-canvas`
2. Choose a different name

To use a scoped package, update package.json:
```json
{
  "name": "@hokyjack/expo-perfect-canvas"
}
```

### Testing Before Publishing

Create a local tarball to test:

```bash
# Create package
npm pack

# In test project, install from tarball
npm install ../expo-perfect-canvas/expo-perfect-canvas-1.0.0.tgz
```

## After Publishing

1. **Create GitHub Release**: Tag the version in git
2. **Update Documentation**: Ensure README on GitHub matches npm
3. **Announce**: Share on social media, forums, etc.
4. **Monitor Issues**: Watch for bug reports and feedback

## Maintenance

### Deprecating Versions

If you need to deprecate a version:

```bash
npm deprecate expo-perfect-canvas@1.0.0 "Critical bug, please upgrade to 1.0.1"
```

### Unpublishing (within 72 hours)

```bash
npm unpublish expo-perfect-canvas@1.0.0
```

Note: Unpublishing is discouraged and only allowed within 72 hours of publishing.

## Security

- Never commit `.npmrc` with tokens
- Use 2FA on your npm account
- Regularly audit dependencies: `npm audit`
- Keep dependencies updated

## Support

For issues or questions about the package:
- GitHub Issues: https://github.com/Hokyjack/expo-perfect-canvas/issues
- npm Package Page: https://www.npmjs.com/package/expo-perfect-canvas