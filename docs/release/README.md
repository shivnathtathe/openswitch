# OpenSwitch 0.3 Release Notes

## Profile bundles

OpenSwitch 0.3 adds versioned `.osch` bundles for moving one or more selected VPN profiles between installations. Bundles include profile names, usernames, complete OpenVPN configurations, and supported local certificate/key dependencies. Saved passwords are never exported. Import provides a profile preview, selective import, fresh local identifiers, and safe duplicate-name handling.

Bundles are validated for archive traversal, unsafe paths, undeclared files, unsupported directives, encryption, symbolic links, excessive expansion, and configured size/count limits. Bundles may contain sensitive private keys and are not encrypted, so they must be handled as secrets.

## Windows package

OpenSwitch 0.3.0 is packaged as an assisted, per-machine NSIS installer for Windows x64. The stable `com.openswitch.desktop` application ID is retained so an existing OpenSwitch installation can be upgraded in place. Start menu and desktop shortcuts are managed by the installer, and uninstalling OpenSwitch intentionally retains its application data so a later reinstall can recover profile metadata.

The installer retains the existing OpenVPN Community Edition 2.7.8-I001 x64 prerequisite integration. It installs the bundled, unmodified official MSI only when `OPENVPN_PATH` and the standard OpenVPN installation locations do not provide `openvpn.exe`. OpenVPN is not removed with OpenSwitch because another application may use its command-line client or network driver.

The packaged application continues to request administrator elevation at launch. The current runtime starts `openvpn.exe` directly and has no privileged helper or service that could isolate adapter and route changes from the desktop process. Removing `requireAdministrator` would therefore make connections dependent on ambient host permissions and can fail while configuring the VPN adapter. This broad elevation is a known security limitation and should be replaced by a reviewed least-privilege service design in a future release.

`resources/icons/app.ico` is the required Windows application and installer icon. Generated icon assets are committed with their SVG sources and can be verified with `python scripts/generate-icons.py --verify-only`. Branded NSIS artwork can be verified with `python scripts/generate-installer-art.py --verify-only`.

## Signing and updates

Windows executable metadata identifies the product as OpenSwitch and the publisher/author as Shivnath Tathe. `signAndEditExecutable` remains enabled so version information, the icon, and the requested execution level are embedded even in an unsigned local build.

Code signing is optional for local packaging: `forceCodeSigning` is disabled and no certificate or password is committed. A controlled release job can provide electron-builder's standard `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` environment variables. Their presence alone does not establish that an artifact was successfully signed; release operators must verify the Authenticode signature and timestamp on the generated executable and installer before distribution.

Publishing and auto-update delivery are intentionally disabled for 0.2 because no approved release URL exists. The package command uses `--publish never`, and the builder configuration contains no update provider or endpoint. Signature verification remains enabled for a future updater. Adding updates requires an HTTPS release provider, an application-side updater flow, signed artifacts whose certificate subject matches `publisherName`, and tested upgrade/rollback behavior.

## User interface

- The desktop UI imports and manages OpenVPN profiles, stores optional credentials, and shows connection progress, connected state, disconnection, and categorized failures.
- Closing the window keeps OpenSwitch available in the system tray. Tray actions reopen the window, connect a profile, disconnect, or quit.
- Settings control launch-at-login, close-to-tray behavior, diagnostic logging, and system/light/dark appearance.
- Profile records reference the original `.ovpn` file and its external certificates or keys; the UI does not copy those files into OpenSwitch.
- The tray uses the disconnected, connecting, and connected SVG assets copied into the packaged resources directory, with an embedded fallback if an asset cannot be loaded.

## Diagnostics

OpenSwitch writes redacted OpenVPN process output to `%APPDATA%\OpenSwitch\logs\openvpn.log` when diagnostic logging is enabled. At 1 MB the current file is moved to `openvpn.previous.log`, leaving at most the current and previous files. The redactor covers supplied credentials, common credential fields, inline URL credentials, management-password prompts, and PEM private-key blocks.

Logs are still sensitive. OpenVPN can emit profile paths, server names, network topology, and future message formats the redactor does not recognize. Review logs before sharing them. Logging failures are deliberately ignored so diagnostics cannot interrupt a connection attempt.

## Security limitations

- Treat every `.ovpn` profile and referenced file as executable-equivalent untrusted input. Import validation rejects known local-code directives, plugins, and recursive includes, but it is not a complete semantic allowlist for every OpenVPN option.
- The whole packaged desktop process runs elevated on Windows; privilege is not restricted to network operations.
- Passwords are stored through the operating-system credential vault, but usernames, profile names, and absolute file paths are stored unencrypted in application data.
- Credentials are sent through a one-client loopback management channel and are not written to plaintext authentication files. A sufficiently privileged local attacker remains outside this protection boundary.
- Redaction reduces accidental disclosure but cannot guarantee that diagnostics contain no secrets.
- Uninstall retains OpenSwitch application data and credential-vault entries, and it retains OpenVPN. Users requiring complete removal must delete the OpenSwitch user-data directory and its `OpenSwitch` credential-vault records separately, then remove OpenVPN only after confirming no other software depends on it.
- OpenSwitch does not provide a kill switch, split-tunnel policy enforcement, DNS-leak prevention, certificate provisioning, or automatic security updates.
