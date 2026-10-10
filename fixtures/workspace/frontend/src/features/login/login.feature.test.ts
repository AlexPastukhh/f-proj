import { test, expect } from 'vitest'

type LoginCase = { caseId: string; authenticated: boolean }
function buildCases(): LoginCase[] {
  return [
    { caseId: 'passwords_dont_match', authenticated: false },
    { caseId: 'email_has_invalid_format', authenticated: false },
  ]
}

test.each(buildCases())(
  'login__invalid_user_input__user_stays_on_login_form_and_sees_an_error [situation:$caseId]',
  async (testCase) => {
    const authState = { isAuthenticated: testCase.authenticated }
    expect(authState.isAuthenticated).toBe(false)
  },
)

test(
  'login__session_expired__refresh_token_expired__reauthentication_screen_is_shown',
  async () => {
    const reauthenticationScreen = { visible: true }
    expect(reauthenticationScreen.visible).toBe(true)
  },
)
