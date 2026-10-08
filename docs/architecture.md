# Architecture

OpenSwitch uses Electron with a React renderer and separates UI code from operating-system access.

## Runtime boundaries

- **Desktop main process:** owns windows, tray/menu lifecycle, profile persistence through `electron-store`, credential-store calls through `keytar`, and OpenVPN child processes.
- **Preload bridge:** exposes a narrow, typed set of operations to the renderer. It should validate IPC inputs and avoid exposing raw Electron or Node.js APIs.
- **Renderer:** presents profiles and connection state. It should not read arbitrary files, access credentials, or spawn processes directly.
- **OpenVPN process:** receives `--config <profile path>` and connects to an ephemeral localhost management channel for credentials and lifecycle control. Lifecycle ownership remains in the main process.
- **Operating system services:** provide the credential vault, tunnel adapter, notification area, and privilege boundary.

## Data flow

1. The user imports or selects a profile in the renderer.
2. For standalone `.ovpn` files, the main process validates profile fields and stores the original path. For `.osch`, it validates a bounded ZIP, previews through an opaque session, stages selected isolated subtrees under user data, and atomically appends their metadata.
3. The username is stored with profile metadata. The password, when supplied, is written through `keytar` to the OS credential store.
4. A connect request opens a one-client loopback management channel, then spawns OpenVPN directly without a command shell. `--cd` points at the profile configuration directory so relative dependencies resolve deterministically.
5. Parsed state changes are sent to the renderer and reflected by the tray icon/menu.
6. Disconnect requests close the management channel and terminate the owned OpenVPN process. Shutdown follows the same disconnect path.

## State ownership

Connection state is owned by the main process. UI and tray surfaces are projections of that state.

The shared states are `disconnected`, `connecting`, `connected`, `disconnecting`, and `error`. The OpenVPN service recognizes `Initialization Sequence Completed` in process output as successful initialization and treats process exit or parsed authentication, configuration, and TLS failures as errors.

## Packaging boundary

The current electron-builder configuration creates a Windows x64 NSIS installer, rebuilds/unpacks `keytar`, and embeds the official OpenVPN Community 2.7.8 installer as a prerequisite. Generated application/tray icons and branded NSIS artwork are committed alongside their generator scripts so packaging is reproducible.
