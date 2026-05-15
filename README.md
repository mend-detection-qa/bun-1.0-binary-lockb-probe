# bun-1.0-binary-lockb-probe

Mend SCA detection probe — Bun 1.0.36 with binary `bun.lockb` lockfile.
Tier 3, pair V1, probe A. Paired with: `bun-1.1-text-lock-probe` (probe #10).

## Pair

**Pair ID**: V1
**Pair spec**: `version-pm-bunlock-1.0-vs-1.1`
**Purpose**: Determine whether Mend's resolver can parse Bun's binary `bun.lockb` format (Bun <1.1)
versus its text JSONC `bun.lock` format (Bun 1.1+). Both probes share an identical `package.json`.
The lockfile format is the only variable. A parser gap shows up as: sibling probe #10 yields a
non-empty dependency tree; this probe (#9) yields an empty tree.

## This probe (A)

- **Probe name**: `bun-1.0-binary-lockb-probe`
- **Probe number**: #9 (BUN_COVERAGE_PLAN.md §11.3)
- **Bun version under test**: `1.0.36`
- **Lockfile format**: binary `bun.lockb` (MessagePack-based, produced by Bun <1.1)
- **`pm_version_under_test`**: `"1.0.36"` (schema v1.2+ field — pinned to exact patch)
- **Catalog patterns**: `version-pm-bunlock-1.0-vs-1.1` (pair V1-A), folds in edge case E2 (`bun-lockb-binary-format`)

## Sibling probe (B)

- **Probe name**: `bun-1.1-text-lock-probe`
- **Probe number**: #10 (BUN_COVERAGE_PLAN.md §11.3, entry #10)
- **Bun version under test**: `1.1.30`
- **Lockfile format**: text JSONC `bun.lock` (Bun 1.1+)
- **Repo**: https://github.com/mend-detection-qa/bun-1.1-text-lock-probe
- **Relationship**: Same `package.json` (`name: bun-version-pair-probe`, `hono ^4.0.0`, `elysia ^1.0.0`).
  If the sibling yields a non-empty tree and this probe yields an empty tree, the Mend binary
  `bun.lockb` parser is absent or broken.

## Placeholder lockfile

The `bun.lockb` in this probe is a **100-byte binary placeholder**, not a real Bun-generated lockfile.

**Why it is a placeholder:**

1. The agent rules explicitly state: "Do not generate binary `bun.lockb` — use text `bun.lock`."
2. Generating a real `bun.lockb` requires running `bun install` with Bun CLI 1.0.x, which cannot
   be invoked by the probe generator. Binary lockfile generation requires a live Bun 1.0 runtime.
3. The goal of this probe is to test Mend's response to encountering a `bun.lockb` file. A correctly
   structured placeholder (binary, non-parseable as UTF-8 JSON) achieves this without requiring
   a live Bun toolchain.

**Placeholder structure:**

```
Offset  Bytes       Meaning
0-3     42 55 4E 21 Magic marker: ASCII "BUN!" (recognizable header)
4-7     01 00 24    Stub version field (Bun 1.0.36 little-endian encoding)
8+      binary      Non-UTF-8 binary content including 0xFF, 0xFE, 0x80-0x83, 0xC0, 0xC1 bytes
...     00 00 ...   Zero padding to 100 bytes total
```

**What the placeholder proves:**

- A JSON/JSONC parser will fail immediately at byte 0 (`B` is ASCII, but bytes at offset 40+
  include `0xFF` / `0xFE` which are invalid UTF-8 start bytes that standard parsers will reject).
- A binary Bun lockfile parser, if it exists in Mend's UA, would still reject this placeholder
  because the MessagePack structure is not reproduced. This is acceptable — the probe surfaces the
  detection attempt, not a correct parse result.
- A real `bun.lockb` from Bun 1.0.36 would be a valid MessagePack binary. If future probe work
  needs a real binary lockfile, generate it by running: `bun@1.0.36 install` in a project with this
  `package.json` and committing the resulting `bun.lockb` directly.

## What this probe targets

Mend's known behavior when it encounters `bun.lockb`:

| Failure mode | Description | Expected tree |
|---|---|---|
| FM-1 (parse error) | npm-fallback JSON parser hits binary bytes, logs error, emits empty tree | `{}` + error log |
| FM-2 (silent skip) | Mend detects non-JSON file, silently ignores it, emits empty tree | `{}` + no log |
| FM-3 (phantom data) | Binary header bytes mis-parsed as partial JSON tokens — bad data in output | Corrupted entries |
| FM-4 (positive surprise) | Mend has an undocumented bun.lockb parser; tree matches sibling probe #10 | Non-empty, correct |

The `expected-tree.json` encodes FM-1/FM-2 (empty tree) as the documented worst-case. The
`mend_expected_behavior.failure_modes[]` section in `expected-tree.json` documents all four modes
so the downstream comparator knows which outcome to treat as a regression and which as a positive
finding.

**Comparator decision rules:**

- Empty tree, error in logs → FM-1: expected behavior, document in test report, no Jira needed.
- Empty tree, no error in logs → FM-2: file a low-severity Mend issue (missing diagnostic signal).
- Non-empty tree, matches sibling → FM-4: positive surprise, document and verify with real lockfile.
- Non-empty tree, corrupted data → FM-3: file a high-severity Mend bug.

## Mend config

No `.whitesource` file is emitted for this probe.

Bun is NOT in the Mend `install-tool` supported list — `scanSettings.versioning` cannot pin a Bun
toolchain version. There is no UA pre-step for Bun. Detection is entirely lockfile-driven (static
parse of `bun.lockb`). Because Bun is absent from the `install-tool` keys list, there is no
mechanism to pin `1.0.36` via `.whitesource`. The `pm_version_under_test` field in
`expected-tree.json` serves as probe metadata only — it does not drive UA behavior.

Reference: `plugins/mend-knowledge/skills/mend-sca/references/whitesource-config.md` — Bun is
flagged as "NOT in install-tool list — flag as limitation".

## Package inventory

| Package | Constraint | Expected Mend behavior |
|---|---|---|
| `hono` | `^4.0.0` | Should appear in tree (if parser works) |
| `elysia` | `^1.0.0` | Should appear in tree (if parser works) |

Because this probe's `bun.lockb` is a placeholder, no resolved versions or transitives can be
stated. The sibling probe (#10) documents the full resolved graph for the same `package.json` using
a real text-format lockfile.

## Resolver note

Bun is not listed in the UA JavaScript resolver table. The UA will attempt to detect this project
using the npm-resolver fallback. The fallback looks for `package-lock.json`, `npm-shrinkwrap.json`,
and `bun.lock` (text). There is no documented code path for `bun.lockb` (binary). The fallback will
either:

1. Attempt to open `bun.lockb` as JSON → immediate parse failure on binary bytes.
2. Skip `bun.lockb` entirely because it is not in the fallback's file-detection list.
3. (Unlikely) Invoke a dedicated binary parser added after the last resolver-knowledge sync.

This probe is not covered by the UA resolver knowledge document for JavaScript (`javascript.md`).
It is an exploratory probe whose outcome informs whether a Mend bug should be filed against the
binary lockfile path.

## Tracked in

`docs/BUN_COVERAGE_PLAN.md` §11.3 entry #9
