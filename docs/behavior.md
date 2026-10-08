# Profile, Credential, and Tray Behavior

## Profiles

- Import records the selected `.ovpn` file's original path; the source file and referenced certificate/key files are not copied.
- Each profile receives a UUID. Display names need not be unique and are not used as credential keys.
- Profile metadata is stored by `electron-store` in the Electron user-data location under the store name `profiles`.
- Stored metadata includes name, `.ovpn` path, username, credential-presence flag, creation/update times, and optional last-connected time.
- Deleting an active profile disconnects first, removes its metadata and keytar password, and leaves the source `.ovpn` and related files untouched.
- Moving, renaming, or deleting a referenced source file breaks that profile until its path is updated.

## Credentials

- Credentials are optional when a profile is created or edited.
- The username is profile metadata. The password is stored through `keytar` using service `OpenSwitch` and account `profile:<profile UUID>`.
- Passwords are write-only across the renderer API; profile reads return only credential status flags.
- Clearing credentials clears the stored username and removes the profile's keytar password without deleting the profile.
- Renaming a profile preserves its credential because the key is based on the UUID.
- At connect time, the username/password pair is written to a temporary OpenVPN auth file. It is removed when the owned OpenVPN process stops or startup fails.
- There is no implemented one-time, unsaved password prompt if keytar is unavailable or locked.

## Diagnostic logs

OpenSwitch writes redacted OpenVPN output to Electron's application log directory as `openvpn.log`. On Windows this is normally `%APPDATA%\OpenSwitch\logs\openvpn.log`. The file rotates at 1 MB to `openvpn.previous.log`. Credentials, authentication-file paths, URLs, and private-key material are redacted before logging.

## Tray

- Closing the window hides it; the tray owns application lifetime on every platform. A supported notification is shown once per run to explain that OpenSwitch is still running.
- Clicking the tray icon toggles the window. **Show/Open OpenSwitch** displays and focuses it.
- The context menu lists every profile; selecting one requests a connection. The active connected profile is checked.
- **Disconnect** is disabled only in the disconnected state. **Quit** initiates shutdown, attempts a VPN disconnect, destroys the tray/windows, and exits.
- The current runtime tray graphic is a single embedded template SVG. It does not switch among the source state icons. The tooltip changes to `OpenSwitch - Connected` only while connected.

## Icon sources

- `resources/icons/app.svg` is the full-color Carbon/Current application mark.
- `resources/icons/tray-disconnected.svg`, `tray-connecting.svg`, and `tray-connected.svg` are monochrome source shapes intended for future platform-specific rendering.
- Tray assets should be converted to the dimensions and template-image conventions required by each target platform during packaging. SVG support in a development shell does not guarantee production tray support.
