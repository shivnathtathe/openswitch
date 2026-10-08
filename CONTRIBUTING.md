# Contributing

## Development Setup

1. Install Node.js 20.19 or newer and the prerequisites in [`docs/setup.md`](docs/setup.md).
2. Fork and clone the repository.
3. Create a focused branch from `main`.
4. Install dependencies with `npm ci`.
5. Run the application with `npm run dev`.

## Before Opening a Pull Request

Run:

```powershell
npm run check
python scripts/generate-icons.py --verify-only
python scripts/generate-installer-art.py --verify-only
```

Keep pull requests focused, explain user-visible behavior changes, and include tests for logic changes. Do not commit `node_modules/`, `dist/`, `release/`, credentials, VPN profiles, logs, or local environment files.

Changes to IPC, profile validation, credential handling, OpenVPN process management, elevation, or packaging should describe their security impact. Review [`docs/security.md`](docs/security.md) before working in those areas.

## Commit Messages

Use short imperative subjects, for example:

```text
Add system theme preference
Fix tray connection state
Harden profile path validation
```

## Reporting Problems

Use GitHub Issues for reproducible bugs and feature requests. Do not include passwords, private keys, complete VPN profiles, internal hostnames, or unredacted diagnostics. Report vulnerabilities privately using [`SECURITY.md`](SECURITY.md).
