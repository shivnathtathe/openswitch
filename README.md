# OpenSwitch

[![CI](https://github.com/shivnathtathe/openswitch/actions/workflows/ci.yml/badge.svg)](https://github.com/shivnathtathe/openswitch/actions/workflows/ci.yml)

OpenSwitch is a focused Windows desktop client for importing OpenVPN profiles, switching connections, and monitoring tunnel state from one application and the system tray.

## Features

- Import, edit, connect, disconnect, and remove local `.ovpn` profiles.
- Store passwords in the operating system credential vault through `keytar`.
- Send credentials to OpenVPN through an in-memory loopback management channel.
- Follow the system appearance or use an explicit light or dark theme.
- Keep connection controls available from the Windows notification area.
- Install the official OpenVPN Community prerequisite with the Windows installer when needed.
- Restrict unsafe profile directives and redact sensitive diagnostic output.

## Requirements

- Windows 10 or newer for the supported packaged application.
- Node.js 20.19 or newer and npm for development.
- OpenVPN Community 2.x for development runs. The packaged installer includes OpenVPN Community Edition 2.7.8 x64 as a prerequisite.
- Native build tools if `keytar` does not have a compatible prebuilt binary.

See [Setup](docs/setup.md) for platform-specific details.

## Development

```powershell
npm ci
npm run dev
```

The development command starts Vite, the TypeScript main-process watcher, and Electron. OpenVPN must already be installed for development runs. Set `OPENVPN_PATH` if its executable is outside the standard locations:

```powershell
$env:OPENVPN_PATH = 'C:\Program Files\OpenVPN\bin\openvpn.exe'
node scripts/verify-openvpn.mjs
```

## Validation

Run the complete source validation suite:

```powershell
npm run check
```

Individual commands are also available:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
python scripts/generate-icons.py --verify-only
python scripts/generate-installer-art.py --verify-only
```

## Packaging

Build the Windows x64 NSIS installer:

```powershell
npm run package
```

The output is written to `release/`. Generated `dist/` and `release/` files are intentionally excluded from Git; publish installers through GitHub Releases rather than committing them to the source tree.

The installer is not code-signed unless a signing certificate is configured. Windows may display an unrecognized publisher warning for unsigned builds.

## Architecture

OpenSwitch separates privileged desktop operations from the React renderer:

- The Electron main process owns profile persistence, credentials, OpenVPN, windows, and the tray.
- A sandboxed preload exposes a small typed IPC API.
- The renderer has no direct Node.js or Electron access.
- OpenVPN receives credentials through a localhost-only management channel rather than a plaintext authentication file.

Read [Architecture](docs/architecture.md) and [Security](docs/security.md) before changing IPC, profile validation, credential handling, or process management.

## Documentation

- [Setup and prerequisites](docs/setup.md)
- [Architecture](docs/architecture.md)
- [Application behavior](docs/behavior.md)
- [Security model](docs/security.md)
- [Known limitations](docs/known-limitations.md)
- [Release process](docs/release/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Third-Party Software

The Windows installer embeds an unmodified official OpenVPN Community Edition installer. Its version, checksum, upstream source, and license references are recorded in [`vendor/openvpn/NOTICE.md`](vendor/openvpn/NOTICE.md). OpenVPN is a registered trademark of OpenVPN, Inc.; this project is not affiliated with or endorsed by OpenVPN, Inc.

## License

No open-source license has been granted for this repository yet. Copyright (c) 2026 Shivnath Tathe. All rights reserved.
