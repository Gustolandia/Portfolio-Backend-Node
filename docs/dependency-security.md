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
