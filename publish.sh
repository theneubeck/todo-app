#!/usr/bin/env bash
set -euo pipefail

ARG=${1:-}

current_version() {
  node -p "require('./package.json').version"
}

bump_version() {
  local current=$1 part=$2
  local major minor patch
  IFS='.' read -r major minor patch <<< "$current"
  case "$part" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

case "$ARG" in
  --major) VERSION=$(bump_version "$(current_version)" major) ;;
  --minor) VERSION=$(bump_version "$(current_version)" minor) ;;
  --patch) VERSION=$(bump_version "$(current_version)" patch) ;;
  "")
    echo "Usage: ./publish.sh --major | --minor | --patch | <version>"
    exit 1
    ;;
  *)  VERSION="$ARG" ;;
esac

TAG="v$VERSION"

# Ensure working tree is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: uncommitted changes — commit or stash before publishing"
  exit 1
fi

# Tests must be green
echo "==> Running tests..."
npm test

# Bump version in package.json / package-lock.json without creating a git tag
npm version "$VERSION" --no-git-tag-version

# Build the app and package the DMG
echo "==> Building..."
npm run build
npm run package

# Commit the version bump and tag it
git add package.json package-lock.json
git commit -m "Release $TAG"
git tag "$TAG"
git push origin main "$TAG"

# Find the DMG and publish to GitHub
DMG=$(ls release/todoz-"$VERSION"-*.dmg 2>/dev/null | head -1)
if [[ -z "$DMG" ]]; then
  echo "error: could not find release/todoz-$VERSION-*.dmg"
  exit 1
fi

echo "==> Creating GitHub release $TAG..."
gh release create "$TAG" "$DMG" \
  --title "$TAG" \
  --notes "Download the DMG, open it, and drag todoz to Applications.

> **Note:** the app is unsigned. On first launch, macOS may block it.
> If that happens: System Settings → Privacy & Security → Open Anyway."

echo "==> Done: https://github.com/theneubeck/todo-app/releases/tag/$TAG"
