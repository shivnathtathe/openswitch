import type { OpenSwitchApi } from './api'

declare global {
  interface Window {
    readonly openSwitch: OpenSwitchApi
  }
}

export {}
