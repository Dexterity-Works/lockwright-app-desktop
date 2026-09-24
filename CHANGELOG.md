# Changelog

All notable changes to Lockwright desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Headings are App versions (`package.json` / AppxManifest), not superproject Release tags.

Starts at 0.0.17, after the Lockwright package rename. Earlier history is git.

## [Unreleased]

### Fixed

- Generator history shows vault entries whose password matches, including ones saved before labels were stamped.
- Generator history shows as soon as the Generator opens.

## [0.0.29] - 2026-10-02

`3f74ad1fbe59a134cb788eee71ed0990b6e5ee69`

### Added

- A GitHub Actions workflow builds macOS DMGs for arm64 and x64 on dispatch. Without signing secrets it ad-hoc signs them and names them `-unsigned`.

### Fixed

- macOS builds null the upgrade link like Windows and Linux. They no longer follow PearPass's Pear update link or keep the vault in a storage folder keyed by it.

### Removed

- The `pear:build:darwin:*` and `pear:build:linux:*` scripts and the `pear-build` dev dependency. Every build nulls the upgrade link, so no build ships a Pear OTA drive.

## [0.0.28] - 2026-09-30

`6faed0f9154115f2722e735db9e5f0f0d56402ac`

### Security

- KeePass import parses with a supported xmldom (0.8.15) instead of the deprecated 0.7.13.

### Changed

- Generate and Copy sit above the generated password. The Generator page drops its bottom Copy Password button.
- The browser-extension native host is built from `native-host/` in this repo and names the Lockwright socket itself, instead of rewriting the PearPass bridge bundle.

### Removed

- The unused `lockwright-utils-pattern-search` dependency.
- The Electron Forge MSIX build and the Windows Pear staging scripts. Windows ships as the electron-builder NSIS installer.
- The `tether-dev-docs` dev dependency. The ESLint config lives in the repo.

## [0.0.27] - 2026-09-27

`8d75d4629859d202f7d4e42f97821e57ed71e639`

### Security

- The renderer runs isolated and sandboxed with no Node access. Everything it needs comes through a contextBridge API, and the bundle carries no Node builtins.
- The native-messaging server runs in the main process next to the vault client. The extension protocol is unchanged, and existing pairings carry over.
- Electron 44. Only web and mail links open outside the app, and the renderer has a content security policy.
- One running Lockwright per profile. A second launch focuses the first, and a live socket is never deleted.

### Changed

- Renderer errors reach the Diagnostics log. Vault-file imports no longer depend on Node crypto.

## [0.0.26] - 2026-09-26

`8d12b446874c983511c486751d05ac9f0631932f`

### Security

- Auto-lock controls need a paired session, and only a verified request resets the inactivity timer.
- Vault calls from the renderer are checked against an allowlist in the main process.
- The desktop proves it owns the Windows pipe, with an HMAC over a per-start secret, before the extension host sends anything. Update the extension with it.
- Command ids match the bridge again, so a kick from the extension reaches the vault.

### Changed

- 28 unused dependencies removed. The disabled 2FA import/export feature, modules nothing imported, and unreferenced assets are deleted.
- The renderer ships minified without its source map (11 MB to 1.6 MB). The fixed three-second loader is gone.
- Renderer errors reach the Diagnostics log.
- Pin native-messaging-bridge `8ad5022`, lib-data-import `6a872f3`, and the utils libraries to commits without install hooks.

### Fixed

- The test suite runs green.

## [0.0.25] - 2026-09-26

`9f57e1d733e098e6c2ab5061574735a62b000a4e`

### Security

- The Windows native-messaging pipe is private to the user and gets a new random name on every start. Update the extension too.
- Copied secrets reach the clipboard helper over stdin, never a temp file.
- Five wrong extension pairing codes rotate the code. The compare is constant-time.
- Secure requests are checked for replay after decrypting, and a reused nonce is rejected.

### Changed

- The revoke dialog says the device keeps reading until the vault is moved.
- Pin native-messaging-bridge `db6158a` and lib-data-import `5178ac2` (KDBX size cap, linear CSV split).

## [0.0.24] - 2026-09-24

`812fba79e2e17c7939426ccad01f840e5e72ef64`

### Fixed

- Clipboard replacement can be turned off.
- Generator history shows each site and entry a generated password was used for.

## [0.0.23] - 2026-09-22

`69c6e3c8c45f18beebfd59f0940da53876320166`

### Fixed

- Linux packaging finds the vault worklet under `lockwright-lib-vault-core`.

## [0.0.22] - 2026-09-10

`7e308a0605a3b1a708fc700d82b01901211a545d`

### Fixed

- Handshake accepts a browser still in PENDING pairing so the first pair can log in. A correct master password is no longer shown as wrong.

## [0.0.21] - 2026-09-05

`1959b3878630a34cad609a88e4a27568895c4acb`

### Fixed

- Login URIs store as typed. Edit unwraps glued `https://androidapp://` so Save writes the app URI.

## [0.0.20] - 2026-09-05

`44f1bbb00605b20c5301a7f3e5110a2c78eca7c9`

### Changed

- Unlock does not wait on Autobase catching up other writers.

### Fixed

- Authenticator asks for OTP codes so digits and the 1s timer show after Home skipped them.
- Native-messaging vault list no longer probes encryption and vault status before the list.
- Native-messaging skips extra status probes unless debug logging is on.

## [0.0.19] - 2026-09-04

`eb6d08ec8b068eb517c80d1d2bddd1857ecc0521`

### Added

- Settings lists paired browsers. Unpair one without wiping the rest.

## [0.0.18] - 2026-09-02

`b9dea4cc24cbcc34a7dca6354897f9d86b6d1e18`

### Added

- Pairing uses the Chrome Web Store Chromium extension id `mjkngfebbgbofnimnppidjfbifpbimgp`.

### Fixed

- Stale AppImage native-messaging hosts are killed so a new AppImage can bind.
- Splash does not redraw on an unchanged resize.
- AppImage taskbar `.desktop` Exec stays on this install.
- `linux.desktop` nested under `entry` for electron-builder 26.
- Native-host IPC and CORESTORE restamped to Lockwright after a PearPass copy.

## [0.0.17] - 2026-08-31

`ca6d8c856cff54c3fdccabf9a0c6d8272a63f1fd`

### Fixed

- A PearPass vault copied onto disk is treated as a vault, not empty.

[unreleased]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/8d75d4629859d202f7d4e42f97821e57ed71e639...HEAD
[0.0.27]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/8d12b446874c983511c486751d05ac9f0631932f...8d75d4629859d202f7d4e42f97821e57ed71e639
[0.0.26]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/9f57e1d733e098e6c2ab5061574735a62b000a4e...8d12b446874c983511c486751d05ac9f0631932f
[0.0.25]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/812fba79e2e17c7939426ccad01f840e5e72ef64...9f57e1d733e098e6c2ab5061574735a62b000a4e
[0.0.24]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/69c6e3c8c45f18beebfd59f0940da53876320166...812fba79e2e17c7939426ccad01f840e5e72ef64
[0.0.23]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/7e308a0605a3b1a708fc700d82b01901211a545d...69c6e3c8c45f18beebfd59f0940da53876320166
[0.0.22]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/1959b3878630a34cad609a88e4a27568895c4acb...7e308a0605a3b1a708fc700d82b01901211a545d
[0.0.21]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/44f1bbb00605b20c5301a7f3e5110a2c78eca7c9...1959b3878630a34cad609a88e4a27568895c4acb
[0.0.20]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/eb6d08ec8b068eb517c80d1d2bddd1857ecc0521...44f1bbb00605b20c5301a7f3e5110a2c78eca7c9
[0.0.19]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/b9dea4cc24cbcc34a7dca6354897f9d86b6d1e18...eb6d08ec8b068eb517c80d1d2bddd1857ecc0521
[0.0.18]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/ca6d8c856cff54c3fdccabf9a0c6d8272a63f1fd...b9dea4cc24cbcc34a7dca6354897f9d86b6d1e18
[0.0.17]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/21b9f29828856acad42fda07d65da0e2e75c1944...ca6d8c856cff54c3fdccabf9a0c6d8272a63f1fd
