<p align="center">
  <img src="docs/logo.svg" alt="Lockwright" width="128"/>
</p>

# Lockwright Desktop

> Desktop app for Lockwright. Local vaults, peer-to-peer sync.

Site: [lockwright.dexterity.works](https://lockwright.dexterity.works)

Community fork of PearPass (Apache 2.0). Not affiliated with or endorsed by Tether Data or the Pears project.

---

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Changelog](CHANGELOG.md)
- [Usage Examples](#usage-examples)
- [Logging](#logging)
- [Testing](#testing)
- [Staging to Dev](#staging-to-dev)
- [Workspace Dependencies](#workspace-dependencies)
- [Dependencies](#dependencies)
- [Related Projects](#related-projects)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

Lockwright encrypts the vault on this device. Devices sync with each other. There is no cloud account.

The on-disk vault at the fork point is PearPass's. Vault work in this tree aims to open those vaults in place. Test that on a copy.

---

## Features

- **Encrypted-at-rest storage.** Lockwright encrypts passwords, credit cards, secure notes, and custom fields before writing them to disk.
- **Cross-device sync.** Credentials sync directly between your devices. No central server.
- **Offline access.** Access your vault anytime, even without a network connection.
- **Password health.** Analyse password strength and identify weak passwords.
- **Random password generator.** Generate strong, unique passwords.
- **Multi-platform.** Runs on macOS, Linux, and Windows. Lockwright is also available on [mobile](https://github.com/Dexterity-Works/lockwright-app-mobile) and as a [browser extension](https://github.com/Dexterity-Works/lockwright-app-browser-extension).

---

## Installation

### Prerequisites

- **Node.js.** Check the required version in `.nvmrc` and verify with:

```bash
node --version
```

- **pnpm** `11.10.0` (`packageManager` in `package.json`)

### Steps

```bash
# 1. Clone the repository
git clone git@github.com:Thaoh/lockwright-app-desktop.git

# 2. Go to the cloned directory
cd lockwright-app-desktop

# 3. Install dependencies
pnpm install

# 4. Generate translation keys
pnpm run build

# 5. Start the development app
pnpm run dev
```

In the Lockwright superproject, run `./scripts/fetch-packages.sh --layout` so `file:../pearpass-lib-vault` resolves.

---

## Usage Examples

[lockwright.dexterity.works](https://lockwright.dexterity.works) is the Lockwright site.

PearPass docs at [docs.pass.pears.com](https://docs.pass.pears.com) still describe setup, vault management, syncing, browser extension usage, and the rest of the product at the fork point. They are not Lockwright docs.

Intel-based Mac builds are deprecated and provided without official support or active testing. They stay available for now. Use them at your own risk. Open a ticket if you hit issues. A fix is not guaranteed, but it helps to know whether these builds are still in use.

---

## Logging

Off by default. When enabled, logs are written under `<userData>/logs/`: `main.log` from the host process and `core.log` from the vault worker. The worker's sink redacts known sensitive fields (passwords, keys, tokens, etc.) before writing to `core.log`. The host process logger does not redact, so treat anything passed to `logger.*` in `main.cjs` as on-disk-visible in `main.log`.

Three ways to enable:

- **In-app toggle** (Settings → Diagnostics → **Enable logs**). Persists across launches; toggling **on** clears any previous log files to start a clean session. Toggling **off** stops writing but preserves the existing files so you can share them.
- **Launch flag:** pass `--enable-logging` at startup. Forces logging on regardless of the toggle.
- **Nightly builds** (`PearPass-nightly`): logging is on automatically and the in-app toggle is locked.

When logging is on, **Open logs folder** in the same screen reveals the directory.

---

## Testing

### Unit Testing

Run unit tests with Jest:

```bash
pnpm test
```

---

## Staging to Dev

Ensure the app runs correctly using `pnpm run dev`.

If successful, stage it, for example: `pear stage dev`.

Then run the app: `pear run pear://GENERATED_URL`.

Pear serves files from the `dist/` folder:

```html
<!-- index.html -->
<script type="module" src="./dist/app.js"></script>
```

The `src/` folder is for development and it's ignored in `package.json`:

```json
"ignore": [".github", "appling", ".git", ".gitignore", "packages", "src"]
```

---

## Workspace Dependencies

The following sibling modules must be present in the workspace (they are not declared as npm dependencies). npm names are still `@tetherto/pearpass-*`. Git clones for vault, vault-core, and constants are the Lockwright repos.

- [`@tetherto/tether-dev-docs`](https://github.com/Dexterity-Works/tether-dev-docs)
- [`@tetherto/pear-apps-lib-feedback`](https://github.com/Dexterity-Works/lockwright-lib-feedback)
- [`@tetherto/pear-apps-lib-ui-react-hooks`](https://github.com/Dexterity-Works/lockwright-lib-ui-react-hooks)
- [`@tetherto/pear-apps-utils-avatar-initials`](https://github.com/Dexterity-Works/lockwright-utils-avatar-initials)
- [`@tetherto/pear-apps-utils-date`](https://github.com/Dexterity-Works/lockwright-utils-date)
- [`@tetherto/pear-apps-utils-generate-unique-id`](https://github.com/Dexterity-Works/lockwright-utils-generate-unique-id)
- [`@tetherto/pear-apps-utils-pattern-search`](https://github.com/Dexterity-Works/lockwright-utils-pattern-search)
- [`@tetherto/pear-apps-utils-qr`](https://github.com/Dexterity-Works/lockwright-utils-qr)
- [`@tetherto/pear-apps-utils-validator`](https://github.com/Dexterity-Works/lockwright-utils-validator)
- [`@tetherto/pearpass-lib-constants`](https://github.com/Dexterity-Works/lockwright-lib-constants)
- [`@tetherto/pearpass-lib-data-export`](https://github.com/Dexterity-Works/lockwright-lib-data-export)
- [`@tetherto/pearpass-lib-data-import`](https://github.com/Dexterity-Works/lockwright-lib-data-import)
- [`@tetherto/pearpass-lib-ui-theme-provider`](https://github.com/Dexterity-Works/lockwright-lib-ui-theme-provider)
- [`@tetherto/pearpass-lib-vault`](https://github.com/Dexterity-Works/lockwright-lib-vault)
- [`@tetherto/pearpass-lib-vault-core`](https://github.com/Dexterity-Works/lockwright-lib-vault-core)
- [`@tetherto/pearpass-utils-password-check`](https://github.com/Dexterity-Works/lockwright-utils-password-check)
- [`@tetherto/pearpass-utils-password-generator`](https://github.com/Dexterity-Works/lockwright-utils-password-generator)

---

## Dependencies

- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Lingui](https://lingui.dev/)
- [Redux](https://redux.js.org/)

---

## Related Projects

| Project | Description |
| --- | --- |
| [`lockwright-app-mobile`](https://github.com/Dexterity-Works/lockwright-app-mobile) | Mobile app for Lockwright |
| [`lockwright-app-browser-extension`](https://github.com/Dexterity-Works/lockwright-app-browser-extension) | Browser extension for Lockwright |
| [`lockwright-lib-vault`](https://github.com/Dexterity-Works/lockwright-lib-vault) | Vault management library |
| [`lockwright-lib-vault-core`](https://github.com/Dexterity-Works/lockwright-lib-vault-core) | Bare worker and client for Lockwright vaults |
| [`lockwright-lib-constants`](https://github.com/Dexterity-Works/lockwright-lib-constants) | Shared constants |
| [`lockwright-lib-ui-react-native-components`](https://github.com/Dexterity-Works/lockwright-lib-ui-react-native-components) | UI kit |

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Apache License 2.0. See `LICENSE.md` and `NOTICE.md`.
