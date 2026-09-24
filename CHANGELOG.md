# Changelog

All notable changes to Lockwright desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Headings are App versions (`package.json` / AppxManifest), not superproject Release tags.

Starts at 0.0.17, after the Lockwright package rename. Earlier history is git.

## [Unreleased]

### Fixed

- Generator history shows vault entries whose password matches, including ones saved before labels were stamped.
- Generator history shows as soon as the Generator opens.

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

[unreleased]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/812fba79e2e17c7939426ccad01f840e5e72ef64...HEAD
[0.0.24]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/69c6e3c8c45f18beebfd59f0940da53876320166...812fba79e2e17c7939426ccad01f840e5e72ef64
[0.0.23]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/7e308a0605a3b1a708fc700d82b01901211a545d...69c6e3c8c45f18beebfd59f0940da53876320166
[0.0.22]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/1959b3878630a34cad609a88e4a27568895c4acb...7e308a0605a3b1a708fc700d82b01901211a545d
[0.0.21]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/44f1bbb00605b20c5301a7f3e5110a2c78eca7c9...1959b3878630a34cad609a88e4a27568895c4acb
[0.0.20]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/eb6d08ec8b068eb517c80d1d2bddd1857ecc0521...44f1bbb00605b20c5301a7f3e5110a2c78eca7c9
[0.0.19]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/b9dea4cc24cbcc34a7dca6354897f9d86b6d1e18...eb6d08ec8b068eb517c80d1d2bddd1857ecc0521
[0.0.18]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/ca6d8c856cff54c3fdccabf9a0c6d8272a63f1fd...b9dea4cc24cbcc34a7dca6354897f9d86b6d1e18
[0.0.17]: https://github.com/Dexterity-Works/lockwright-app-desktop/compare/21b9f29828856acad42fda07d65da0e2e75c1944...ca6d8c856cff54c3fdccabf9a0c6d8272a63f1fd
