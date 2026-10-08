# Security

## Trust boundaries

OpenVPN profiles and their referenced files are untrusted input. A profile can contain directives that read local files, run scripts, modify routes, or invoke external helpers. Importing a profile must not be treated as equivalent to approving every directive it contains.

The renderer is also outside the privileged trust boundary. Process creation, file access, credential operations, and profile persistence belong in the main process behind explicit IPC handlers.

## Implemented controls

- OpenVPN is spawned directly with an argument array and `shell: false`.
- The renderer has Node.js integration disabled and runs with sandboxing and context isolation. A frozen preload API exposes named IPC operations only.
- Navigation is restricted to the packaged file or development-server origin. New HTTP(S) windows are denied and delegated to the system browser.
- Saved passwords use `keytar`; renderer responses expose only configured/not-configured flags.
- Saved credentials are supplied through an ephemeral localhost-only OpenVPN management channel and are not written to plaintext authentication files.
- OpenVPN output passes through a redactor for supplied credentials, auth-file paths, common credential fields, inline URL credentials, management password messages, and PEM private keys.
- Shutdown attempts to disconnect OpenVPN before destroying the tray and windows.
- Bundle file dialogs, archive paths, extraction, and persistence are main-process operations. Renderer IPC receives only an opaque import session and display metadata.
- Bundle ZIP reads reject traversal, absolute/backslash/colon paths, Windows reserved names, case collisions, links, encryption, unsupported compression, excessive compression ratios, undeclared entries, and configured entry/count/expanded-size limits.
- Bundle manifests and OpenVPN file references are strictly validated. Extraction is staged under a randomized user-data directory and renamed before a single profile metadata batch write.
- Bundle export has no credential-vault dependency. It includes usernames but never passwords or keytar values.

## Residual risks

- Standalone `.ovpn` selection still references files in place. Profile creation rejects known code-execution/include directives, while `.osch` export/import additionally validates and packages supported local file references. This is a denylist boundary rather than a complete OpenVPN directive allowlist.
- The application stores the username and the absolute profile path in the unencrypted `electron-store` profile database. Only the password is placed in the OS vault.
- The OpenVPN management protocol is bound to loopback and accepts one client, but a sufficiently privileged local process remains outside the application's trust boundary.
- Redaction is defense in depth, not proof that every future OpenVPN message format is covered. Review diagnostics before sharing them.
- OpenSwitch does not install a privileged helper or silently elevate. OpenVPN and the tunnel driver must already be usable under host policy.

## Credential identity

Passwords use keytar service `OpenSwitch` and account `profile:<profile UUID>`. Renaming a profile therefore does not change its credential key. Deleting a profile deletes that keytar record.

OS credential stores protect secrets at rest according to the signed-in user's session and platform policy. They do not protect against malware already running as the same user or an unlocked desktop session.

## Logging

OpenVPN service output is redacted before it is emitted or sent to its logger. Logs remain sensitive because profile contents and unknown output formats may disclose data not recognized by the redactor.
