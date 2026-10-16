# Backend Dependency Security Review

Reviewed on 2026-10-16 following the owner's request to address dependency
security warnings without breaking frontend/backend behavior.

## Findings

The fresh **full dependency-tree** `npm audit --json` reported **zero known
vulnerabilities**, including zero informational, low, moderate, high and critical
findings. This was not an audit limited to production dependencies or filtered
by severity. `npm ls --all` also reported a valid installed tree.

The committed lockfile contains three direct packages and one transitive package:

| Package | Locked Version | Role |
| --- | --- | --- |
| `@upstash/redis` | `1.38.0` | Server-only Redis REST client |
| `uncrypto` | `0.1.3` | Transitive dependency of the Redis client |
| `bcryptjs` | `2.4.3` | Server-side password verification |
| `jose` | `5.10.0` | JWT/API and cookie-session signing/verification |

No confirmed backend advisory required remediation. These versions and the
lockfile are deliberately unchanged; an available newer major version is not,
by itself, evidence of a vulnerability. No forced blanket fix, severity filter,
advisory suppression or override was used to manufacture a clean result.
The frontend has a separate dependency tree and its own coordinated review.

## Repeatable Checks

Run from the repository root:

```powershell
npm ci
npm run audit
npm audit --json
npm ls --all
npm test
```

Check the complete `npm ci` output for deprecation and peer-dependency warnings;
do not suppress them with log-level flags. An audit finding and a deprecation
notice are different signals: a zero-vulnerability audit alone does not establish
that packages are supported. The deterministic manifest tests reject a declared
`deprecated` entry in the committed lockfile. Since registry status can change
without a lockfile change, also query `npm view <package>@<locked-version>
deprecated --json` for each locked package during a release review. An unset
deprecation field returns no value. These live queries supplement, rather than
replace, a clean install and the full security audit.

`npm run audit` runs the unfiltered full-tree `npm audit`. It is intentionally
separate from deterministic tests: tests must not depend on registry availability
or upload assets/write Redis. Netlify retains its existing `npm test` deployment
gate. Audit results are point-in-time registry findings, not a guarantee that
unknown vulnerabilities cannot exist.

The new manifest regressions verify lockfile/dependency-group/engine agreement,
HTTPS registry sources without embedded credentials and complete SHA-512
integrity digests. They also prevent the audit command from silently becoming a
production-only/severity-filtered audit or an automatic forced fix. These checks
do not replace npm's actual registry audit or its install-time integrity checks.
Changing package sources deliberately requires reviewing the corresponding test.

This audit covers the repository's committed npm tree. Netlify's hosted build
tools and the convenience `npx netlify-cli` development command are separately
managed/transient tools, not hidden project dependencies included in this count.
No extra CLI dependency was added merely to inflate or change the audit result.

## Behavioral Boundaries

Public/admin endpoint paths and response shapes, secure HttpOnly sessions,
exact-origin credentialed admin CORS, public GET CORS, CSRF, login throttling,
upload authentication, sorting, normalization and ordered media remain unchanged.
No runtime handler, authentication implementation or content source is modified.
The existing full contract/security/storage/migration suite remains the primary
behavioral regression coverage.

A fresh complete public-payload snapshot and canonical hash were captured under
ignored `private-content/dependency-review-2026-10-16/` before release. Canonical
hashing sorts object keys but preserves every array's order. Deployment readback
must match every original normalized field, record and ordered media tuple.
No Redis write, admin save, ImageKit listing/deletion or content migration is part
of this review. Private snapshots/receipts and server credentials stay excluded
from Git and deploy inputs.

Local clean-install, full checks and deployed verification are recorded below
only after they complete. No signed-in UI upload/save is repeated by this
dependency-only maintenance release.

## Local Verification

The review used Node **24.19.0** and npm **11.17.0** locally. `npm ci` installed
the exact four locked third-party packages successfully, with no package or
lockfile version changes. A second full audit and installed-tree check remained
clean. All **204 backend tests** and **71 JavaScript syntax checks** passed,
including existing auth/CORS/CSRF, uploads, storage, sorting and media invariants.
README contents/local links and Git whitespace checks passed as well. There is
no separate lint/build script; Netlify runs the same backend tests as its gate.

The baseline public canonical SHA-256 is
`9deae9d099ea2d6d5f935aac6ba342b2988f3e020e768e53a15d2503f8f1975e`.
It contains 17 jobs, 7 education entries and 15 projects, including all 214
distinct skills across 566 occurrences. Private before/after snapshots, full
audit JSON and installed-tree reports stay outside commits. Deployed verification
is recorded separately after the Git-based release is published.

## Final Production Recheck

On 2026-10-16, a subsequent clean install again produced no deprecation or peer
warnings. None of the four exact locked versions had a registry deprecation
notice, and the unfiltered full-tree audit still reported zero vulnerabilities.
The additional manifest regression keeps the no-declared-deprecations requirement
visible in the offline test suite; it cannot predict future registry changes.
All **206 backend tests** and **71 JavaScript syntax checks** passed. No runtime
handler, package version or lockfile was changed for this recheck.

A fresh exact-byte raw Redis backup and complete public JSON snapshot were
captured and read back under ignored `private-content/final-production-2026-10-16/`
before any save/upload testing. This baseline follows the separately approved
current-residence clearing, so it is not the historical hash above. Its public
canonical SHA-256 is
`83375c7c4a21580733fe63cf7cfc41ec5d826ee859d1e29c45f2c907250c74a8`.
All 17 jobs, 7 education records and 15 projects remain present.

Forty-eight live HTTP checks verified unauthenticated public JSON with wildcard
CORS and no cookies; exact-origin credentialed admin responses for all four
approved origins; successful allowed preflights; rejected unapproved preflights;
401 signed-out responses; 405 unsupported methods; 400 malformed login JSON;
and 401 invalid credentials. Only one deliberately invalid login was sent; live
rate-limit exhaustion is intentionally avoided and remains covered by isolated
tests. Browser authentication, saves and uploads are separate checks and must
not be inferred from these HTTP results. Private receipts record their actual
outcomes when performed. No private backup or credential belongs in Git.
