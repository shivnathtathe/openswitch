!include "LogicLib.nsh"

!macro customInstall
  ReadEnvStr $0 "OPENVPN_PATH"
  ${If} $0 != ""
    IfFileExists "$0" openvpn_ready
  ${EndIf}

  SetRegView 64
  IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" openvpn_ready
  IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" openvpn_ready

  DetailPrint "Installing OpenVPN Community Edition 2.7.8..."
  SetOutPath "$PLUGINSDIR"
  File /oname=OpenVPN-Community.msi "${PROJECT_DIR}\vendor\openvpn\OpenVPN-2.7.8-I001-amd64.msi"
  ExecWait '"$SYSDIR\msiexec.exe" /i "$PLUGINSDIR\OpenVPN-Community.msi" /passive /norestart' $1

  ${If} $1 != 0
  ${AndIf} $1 != 3010
    MessageBox MB_ICONSTOP|MB_OK "OpenVPN Community Edition could not be installed (Windows Installer code $1). OpenSwitch requires its command-line client and network driver."
    Abort
  ${EndIf}

  openvpn_ready:
!macroend
