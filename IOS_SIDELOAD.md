# iOS / SideStore build

This repository now contains a Capacitor 8 wrapper for the existing Health Training web app.

## App identity
- App name: Health Training
- Bundle ID: `com.hong26sj.healthtraining`
- Native runtime: Capacitor 8
- Web source: existing repository root, staged into `www/` during CI

## Automatic unsigned IPA build
GitHub Actions workflow: `.github/workflows/build-ios-ipa.yml`

The workflow runs on macOS and:
1. installs Capacitor,
2. stages the current PWA assets into `www/`,
3. generates a fresh iOS project,
4. builds the Release app with code signing disabled,
5. packages `Payload/App.app` as `HealthTraining-unsigned.ipa`,
6. uploads it as a GitHub Actions artifact.

The unsigned IPA is intended to be re-signed by SideStore/AltStore-style tooling during installation.

## SideStore installation
1. Open the successful `Build unsigned iOS IPA` workflow run.
2. Download the `HealthTraining-unsigned-ipa` artifact.
3. Extract the artifact ZIP to obtain `HealthTraining-unsigned.ipa`.
4. Send/open the IPA on the iPhone and install it through SideStore.
5. SideStore performs the Apple ID signing/provisioning step.

## Important limitations
- With a free Apple account, SideStore still needs to refresh the app before the personal provisioning period expires.
- This build does not embed signing certificates, Apple IDs, provisioning profiles, tokens, or other secrets.
- HealthKit is not enabled yet. That requires adding the HealthKit capability plus a native Capacitor plugin/bridge and appropriate iOS entitlements.
- Existing `workout-logger` is not part of this repository and is not modified by this wrapper.

## Local macOS development
```bash
npm install
npm run ios:add
npx cap open ios
```

After changing web files:
```bash
npm run ios:sync
```

## Architecture
`PWA source -> scripts/prepare-web.mjs -> www -> Capacitor -> iOS App -> unsigned IPA -> SideStore signing/install`
