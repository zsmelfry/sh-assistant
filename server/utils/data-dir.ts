/**
 * Returns the base data directory path.
 * Dev: DATA_DIR=./data-dev (set in .env)
 * Prod: DATA_DIR=./data (default)
 */
export function getDataDir(): string {
  return process.env.DATA_DIR || './data';
}
