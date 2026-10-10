export function isFeatureProjectionTestMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.FEATURE_PROJECTION_TEST_MODE === '1';
}
