# Known Limitations

- The Windows x64 installer bundles OpenVPN Community Edition 2.7.8 and requests administrator approval to install its networking components. Development runs and non-Windows builds still require OpenVPN separately.
- The Windows application currently requests administrator elevation at launch so OpenVPN can configure its tunnel adapter. A dedicated least-privilege helper service is not yet implemented.
- OpenVPN is retained when OpenSwitch is uninstalled because other applications may depend on it.
- OpenVPN profile compatibility varies by OpenVPN version, platform, directives, plugins, and external files.
- OpenSwitch rejects known script, plugin, and recursive-include directives, but this is not a complete semantic audit of every OpenVPN option. Only import profiles from trusted sources.
- Smart cards, hardware tokens, provider-specific helpers, management-channel authentication, and interactive challenge/response are not implemented as dedicated flows.
- A desktop credential store may be unavailable in containers, SSH sessions, minimal window managers, and other headless Linux environments.
- `keytar` installation can require native compilation when no compatible prebuilt binary exists.
- The profile keeps a path to the original `.ovpn` file. OpenSwitch does not make the profile portable or copy relative certificate/key dependencies.
- Packaging is configured for Windows NSIS only. Code signing, notarization, auto-update, kill-switch behavior, split tunneling, DNS-leak prevention, and a privileged helper service are not implemented.
- Launch at login and close-to-tray behavior are configurable in Settings.
- Tray profile actions are not disabled during transitional/error states and can request another connection after the current state is disconnected by the lifecycle controller.
- The OpenVPN verifier checks executable availability and version output only. It does not prove that adapters, permissions, DNS, routes, credentials, or a particular profile will work.
