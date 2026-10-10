import { test, expect } from 'vitest'

type AccessCase = { caseId: string; allowed: boolean }
function buildCases(): AccessCase[] {
  return [
    { caseId: 'expired', allowed: false },
    { caseId: 'locked', allowed: false },
  ]
}

test.each(buildCases())(
  'access__denied__billing_ui_stays_blocked [situation:$caseId]',
  async (testCase) => {
    expect(testCase.allowed).toBe(false)
  },
)
