/**
 * Extract a human-readable error message from a caught exception.
 * Works with Nuxt's $fetch errors (which have `data.message`) and standard Error objects.
 */
export function extractErrorMessage(e: unknown, fallback: string): string {
  return (e as { data?: { message?: string } })?.data?.message
    || (e instanceof Error ? e.message : fallback);
}
