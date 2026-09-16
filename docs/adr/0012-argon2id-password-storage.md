# 0012. Store passwords as argon2id hashes

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

Passwords must survive a database leak. General-purpose hashes (MD5, SHA-256) are designed to be
fast, so an attacker with a leaked database can test billions of guesses per second on a GPU.
Password hashing needs functions that are deliberately slow and memory-hard.

## Decision

- Hash with **argon2id** (`argon2` package) using the OWASP baseline: **19 MiB memory, 2 iterations,
  1 degree of parallelism**. The parameters and a per-password random salt are stored inside the
  hash string.
- **Re-hash on login:** when a stored hash uses weaker parameters than the current ones, it is
  replaced after a successful login, so raising the settings later upgrades users silently.
- **Password policy** follows NIST 800-63B: 8–128 characters, no forced character classes.
- **No user enumeration:** login answers `Invalid credentials` for both an unknown email and a wrong
  password, and runs a **dummy argon2 verification** when the email is unknown so both paths take
  the same time.
- The seed script uses the same parameters, so demo data behaves like real data.

### Alternatives considered

- **bcrypt:** acceptable and widely used, but older, not memory-hard, and silently truncates input
  beyond 72 bytes.
- **scrypt:** memory-hard and built into Node, but argon2id is the current recommendation and
  encodes its parameters in the hash.
- **SHA-256 with a salt:** rejected; far too fast for passwords.

## Consequences

- Each login and registration costs roughly 50 ms of CPU and 19 MiB of memory, which also limits how
  fast an attacker can guess online. Rate limiting (ADR 0011) covers the rest.
- Parameters can be raised over time without a password reset.
- `argon2` is a native module; it ships prebuilt binaries, so no compiler is needed at install time.

**Future work:** reject passwords found in known breaches (HaveIBeenPwned range API), and offer
multi-factor authentication.
