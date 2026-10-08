import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
  connection: ReactNode
  profileCount: number
  onAddProfile: () => void
  onOpenSettings?: () => void
}

export function AppShell({
  children,
  connection,
  profileCount,
  onAddProfile,
  onOpenSettings,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__frame">
        <header className="app-header">
          <a className="brand" href="#main-content" aria-label="OpenSwitch home">
            <span className="brand__mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="brand__wordmark">OpenSwitch</span>
          </a>

          <div className="app-header__actions">
            <div className="app-header__meta" aria-label={`${profileCount} local profiles`}>
              <strong>{profileCount}</strong>
              <span>{profileCount === 1 ? 'profile' : 'profiles'}</span>
            </div>
            <button className="settings-button" type="button" onClick={onOpenSettings}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9L15 4l-1.9.9a7 7 0 0 0-1.8-.8L10.5 2h-3l-.7 2a7 7 0 0 0-1.8.8L3.1 4 1 6.1 1.9 8a7 7 0 0 0-.8 1.8l-2.1.7v3l2.1.7a7 7 0 0 0 .8 1.8L1 17.9 3.1 20l1.9-.9a7 7 0 0 0 1.8.8l.7 2.1h3l.7-2.1a7 7 0 0 0 1.8-.8l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .8-1.8z"
                  transform="translate(1.5 0) scale(.875)"
                />
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </header>

        <div className="app-shell__body">
          <aside className="control-rail" aria-label="Connection overview">
            <div className="control-rail__inner">{connection}</div>
          </aside>

          <main className="workspace" id="main-content">
            <header className="workspace__header">
              <div>
                <p className="eyebrow">Your connections</p>
                <h1>VPN profiles</h1>
              </div>
              <button className="add-profile-button" type="button" onClick={onAddProfile}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add profile
              </button>
            </header>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
