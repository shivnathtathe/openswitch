import type { CredentialHandle, CredentialStore, OpenVpnCredentials } from './types'

/** @deprecated OpenVPN credentials must be supplied through the in-memory management channel. */
export class TemporaryAuthFileStore implements CredentialStore {
  constructor(temporaryDirectory?: string) {
    void temporaryDirectory
  }

  create(credentials: OpenVpnCredentials): Promise<CredentialHandle> {
    void credentials
    return Promise.reject(
      new Error('Temporary OpenVPN credential files are disabled; use the management channel'),
    )
  }
}
