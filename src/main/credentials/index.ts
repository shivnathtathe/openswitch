import * as keytar from 'keytar'

export const CREDENTIAL_SERVICE = 'OpenSwitch'

export class CredentialVault {
  async save(profileId: string, password: string): Promise<void> {
    if (typeof password !== 'string') {
      throw new TypeError('Password must be a string.')
    }

    await keytar.setPassword(CREDENTIAL_SERVICE, accountForProfile(profileId), password)
  }

  get(profileId: string): Promise<string | null> {
    return keytar.getPassword(CREDENTIAL_SERVICE, accountForProfile(profileId))
  }

  delete(profileId: string): Promise<boolean> {
    return keytar.deletePassword(CREDENTIAL_SERVICE, accountForProfile(profileId))
  }

  async has(profileId: string): Promise<boolean> {
    return (await this.get(profileId)) !== null
  }
}

function accountForProfile(profileId: string): string {
  if (typeof profileId !== 'string' || !profileId.trim()) {
    throw new Error('Profile ID is required.')
  }

  return `profile:${profileId.trim()}`
}
