/**
 * Makes user input match literally inside a SQL LIKE pattern.
 *
 * In LIKE, `%` matches any sequence and `_` matches any single character, and Prisma's
 * `contains` does not escape them on MySQL (verified: searching "5%" matched "50%").
 * MySQL's default LIKE escape character is the backslash, so it is escaped first.
 * (This relies on the default sql_mode, without NO_BACKSLASH_ESCAPES.)
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (character) => `\\${character}`);
}
