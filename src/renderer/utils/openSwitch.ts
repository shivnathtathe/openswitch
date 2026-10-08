import type { OpenSwitchApi } from '../../shared/api'

type OpenSwitchWindow = Window & { readonly openSwitch?: OpenSwitchApi }

export function getOpenSwitchApi(): OpenSwitchApi {
  const api = (window as OpenSwitchWindow).openSwitch

  if (!api) {
    throw new Error('OpenSwitch is unavailable. Restart the desktop application.')
  }

  return api
}
