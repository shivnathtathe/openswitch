/** Persisted profile metadata. Passwords are stored separately and never belong in this shape. */
export interface Profile {
  readonly id: string
  readonly name: string
  readonly ovpnPath: string
  readonly username: string
  readonly credentialSaved: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastConnectedAt?: string
}
