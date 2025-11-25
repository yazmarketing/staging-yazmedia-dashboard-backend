/**
 * Prisma Query Timeout Utility
 * Wraps Prisma queries with timeout to prevent long-running queries from blocking connections
 */

/**
 * Execute a Prisma query with timeout
 * @param queryPromise - The Prisma query promise
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 * @returns The query result
 */
export const withTimeout = async <T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([queryPromise, timeoutPromise]);
};

/**
 * Execute multiple queries in parallel with timeout
 * @param queries - Array of query promises
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 * @returns Array of query results
 */
export const withTimeoutAll = async <T>(
  queries: Promise<T>[],
  timeoutMs: number = 30000
): Promise<T[]> => {
  return Promise.all(queries.map((query) => withTimeout(query, timeoutMs)));
};








