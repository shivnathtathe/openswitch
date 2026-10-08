# Test API assumptions

These tests intentionally target pure functions so they run without an OpenVPN
installation, network access, Electron, or an operating-system keychain.

## OpenVPN log parser

Module: `src/main/logging/openVpnLogParser.ts`

Expected export:

```ts
export function parseOpenVpnLogLine(line: string): OpenVpnLogEvent
```

The tests exercise initialized, authentication, configuration, TLS, process,
and fallback log events without starting an OpenVPN process.

## Sensitive log redaction

Module: `src/main/logging/redactor.ts`

Expected export:

```ts
export class SensitiveDataRedactor {
  constructor(secrets?: readonly (string | undefined)[])
  redact(value: string): string
}
```

The exact replacement marker is deliberately unspecified. Tests only require
that known secret values are absent and useful non-secret context remains.

## Renderer profiles

Modules: `src/renderer/components/profiles/ProfileStatus.tsx` and
`src/renderer/components/profiles/ProfileRow.tsx`

Tests use React's static renderer. They verify labels, status tones, profile
scoping, safe credential state, and accessible actions without browser event
timing or implementation-specific component mocks.

## Deferred area

Profile store tests are deferred because the current main-process store imports
a profile contract that is not present in `src/shared` and constructs
`electron-store` internally. Testing it now would require a brittle module mock.
No test imports `keytar` or touches the operating-system keychain.
