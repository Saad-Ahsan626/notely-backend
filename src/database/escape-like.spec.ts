import { escapeLikePattern } from './escape-like.js';

describe('escapeLikePattern', () => {
  it.each([
    ['plain text', 'plain text'],
    ['50%', '50\\%'],
    ['my_notes', 'my\\_notes'],
    ['C:\\path', 'C:\\\\path'],
    ['%_%', '\\%\\_\\%'],
    ['emoji 🥚', 'emoji 🥚'],
  ])('escapes %s', (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});
