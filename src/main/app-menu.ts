import { Menu } from 'electron'

export function installAppMenu(): void {
  Menu.setApplicationMenu(null)
}
