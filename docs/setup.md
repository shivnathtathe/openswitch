# Setup

## Required tools

- Node.js 20.19.0 or newer and npm, as declared by `package.json`.
- OpenVPN 2.x with a working `openvpn` executable for development runs.
- Native build tools for the Node.js version and platform. These are needed when `keytar` cannot use a matching prebuilt binary.

No global npm packages are required by this documentation.

## OpenVPN

OpenSwitch expects the OpenVPN command-line client, not only a browser extension or VPN-provider application.

### Windows

The packaged Windows installer includes the official signed OpenVPN Community Edition 2.7.8 x64 MSI. It installs the CLI and networking components when OpenVPN is not already available. This requires administrator approval.

Development runs do not invoke the packaged prerequisite installer. Install the OpenVPN Community client manually for development. OpenVPN Connect alone is not sufficient because it does not expose the `openvpn.exe` CLI used by OpenSwitch. A common executable location is:

```text
C:\Program Files\OpenVPN\bin\openvpn.exe
```

If it is not on `PATH`, set `OPENVPN_PATH` to the executable. Installing or using a virtual network adapter can require administrator approval.

### macOS

Install OpenVPN with a package manager or another trusted distribution. For Homebrew:

```sh
brew install openvpn
```

Homebrew's prefix differs between Intel and Apple silicon, so prefer `command -v openvpn` over a hard-coded path. Creating a tunnel interface can require elevated privileges.

### Linux

Install OpenVPN through the distribution package manager, for example:

```sh
sudo apt-get install openvpn
```

The account running OpenVPN needs permission to create/configure a TUN interface. Distribution policy may provide this through capabilities, polkit, systemd, or root; OpenSwitch does not establish that policy for the host.

### Verification

Run the dependency-free probe:

```sh
node scripts/verify-openvpn.mjs
```

The script tries `OPENVPN_PATH`, `openvpn` on `PATH`, and common Windows locations. It invokes only `openvpn --version`; it does not create adapters, connect a profile, elevate privileges, or modify files.

## Native keytar prerequisites

`keytar` binds to the operating system credential store and may compile during installation.

### Windows

- Visual Studio Build Tools with the **Desktop development with C++** workload
- A Python version supported by the `node-gyp` version in the dependency tree
- Windows SDK selected by the Visual Studio installer

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- Access to an unlocked login Keychain while running the app

### Linux

Install a compiler toolchain, Python, `pkg-config`, and libsecret development headers. On Debian/Ubuntu:

```sh
sudo apt-get install build-essential python3 pkg-config libsecret-1-dev
```

A Secret Service provider, such as GNOME Keyring, must also be available in the user session at runtime. Headless sessions commonly lack one.

## Install and run

Install exactly from the committed lockfile and start the development processes:

```sh
npm ci
npm run dev
```

The development command starts Vite, the main-process TypeScript compiler in watch mode, and Electron. Other supported commands are:

```sh
npm run build
npm test
npm run lint
npm run typecheck
npm run format:check
npm run package
```

`npm run build` writes compiled output to `dist/`. `npm run package` builds first and asks electron-builder to produce the configured installer under `release/`. The Windows NSIS package embeds `vendor/openvpn/OpenVPN-2.7.8-I001-amd64.msi`; verify its publisher signature and recorded hash before updating it. The current packaging configuration defines a Windows x64 NSIS target only; development on macOS and Linux does not imply a distributable package for those platforms.
