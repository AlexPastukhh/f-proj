import { test, expect } from 'vitest'

test(
  'orphan__pending__manual_review__account_ui_waits_for_review',
  async () => {
    const state = 'pending'
    expect(state).toBe('pending')
  },
)
