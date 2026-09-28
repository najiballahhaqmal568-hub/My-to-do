# 1. Sign release APKs with a key committed to the repository

## Status

Accepted

## Context

Android only installs an update over an existing app when both are signed with the same key. The usual practice keeps the key in a CI secret, but setting a secret requires the repository owner to act, and the owner asked for a finished app with no setup steps. Losing or changing the key later means the app must be uninstalled (after exporting a backup) and reinstalled.

## Decision

The release build uses `android/app/public-release.keystore`, committed to this public repository, unless the GitHub secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` are set, in which case CI signs with that key instead.

## Consequences

- Every CI build is signed consistently, so updates install over each other without any setup.
- Anyone can sign an APK with this key. Only install APKs from this repository's Releases page.
- Switching to a private key later is possible through the secrets above, but the first build signed with it will not install over the old app: export a backup, uninstall, install, import.
