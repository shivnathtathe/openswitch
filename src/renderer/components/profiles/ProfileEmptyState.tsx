import { Button } from '../ui'

export interface ProfileEmptyStateProps {
  onAdd: () => void
  disabled?: boolean
}

export function ProfileEmptyState({ onAdd, disabled }: ProfileEmptyStateProps) {
  return (
    <section className="profile-empty-state" aria-labelledby="profile-empty-state-title">
      <div className="profile-empty-state__art" aria-hidden="true" />
      <h2 id="profile-empty-state-title">No VPN profiles yet</h2>
      <p>Add an OpenVPN configuration file to create your first connection.</p>
      <Button variant="primary" onClick={onAdd} disabled={disabled}>
        Add profile
      </Button>
    </section>
  )
}
