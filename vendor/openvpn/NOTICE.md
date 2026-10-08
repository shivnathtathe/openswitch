# Bundled OpenVPN Community Installer

OpenSwitch's Windows installer includes the unmodified official OpenVPN Community Edition installer:

- Product: OpenVPN Community Edition 2.7.8-I001, Windows x64
- File: `OpenVPN-2.7.8-I001-amd64.msi`
- SHA-256: `1EA61A3056905B90607D4B0F084C04E5CF3043E07CF192D9CD44B0474F29CC49`
- Publisher signature: OpenVPN Inc. (verified when this dependency was added)
- Official download: https://swupdate.openvpn.org/community/releases/OpenVPN-2.7.8-I001-amd64.msi
- Release source: https://github.com/OpenVPN/openvpn/tree/v2.7.8
- OpenVPN license information: https://github.com/OpenVPN/openvpn/blob/v2.7.8/COPYING
- Windows installer sources: https://github.com/OpenVPN/openvpn-build
- OpenVPN GUI sources: https://github.com/OpenVPN/openvpn-gui
- Windows driver sources: https://github.com/OpenVPN/ovpn-dco-win

OpenVPN is a registered trademark of OpenVPN, Inc. OpenSwitch is not affiliated with or endorsed by OpenVPN, Inc.

The OpenVPN installer is invoked only when `OPENVPN_PATH` does not identify an executable and the standard Community Edition executable is absent. OpenSwitch does not remove OpenVPN during uninstallation because other applications may depend on it.
