import { expect, test } from 'vitest'

test.each([
  { caseId: 'expired', allowed: false },
  { caseId: 'locked', allowed: false },
])(
  'access__denied__request_is_rejected [situation:$caseId]',
  ({ allowed }) => {
    expect(allowed).toBe(false)
  },
)
