const DATABASE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/u;
const DEFAULT_MAX_CHECKS = 200;
const DEFAULT_DELAY_MS = 10;

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export async function closePoolAndDropTestDatabase({
  targetPool,
  installerPool,
  databaseName,
  maxChecks = DEFAULT_MAX_CHECKS,
  delayMs = DEFAULT_DELAY_MS,
  waitForNextCheck = wait,
}) {
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error('Test database name is outside the strict identifier boundary');
  }
  if (
    !Number.isSafeInteger(maxChecks)
    || maxChecks < 1
    || maxChecks > DEFAULT_MAX_CHECKS
  ) {
    throw new Error('Test database session-check bound is invalid');
  }
  if (
    !Number.isSafeInteger(delayMs)
    || delayMs < 0
    || delayMs > DEFAULT_DELAY_MS
  ) {
    throw new Error('Test database session-check delay is invalid');
  }

  await targetPool.end();

  for (let check = 0; check < maxChecks; check += 1) {
    const result = await installerPool.query(
      `SELECT count(*)::integer AS session_count
         FROM pg_catalog.pg_stat_activity
        WHERE datname = $1`,
      [databaseName],
    );
    const sessionCount = result.rows[0]?.session_count;
    if (
      result.rows.length !== 1
      || !Number.isSafeInteger(sessionCount)
      || sessionCount < 0
    ) {
      throw new Error('Test database session count is invalid');
    }
    if (sessionCount === 0) {
      await installerPool.query(`DROP DATABASE "${databaseName}"`);
      return;
    }
    if (check + 1 < maxChecks) {
      await waitForNextCheck(delayMs);
    }
  }

  throw new Error('Test database sessions did not drain within the bounded cleanup window');
}
