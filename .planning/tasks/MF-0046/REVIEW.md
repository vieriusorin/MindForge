---
verdict: approve
reviewed_hash: ea4e63839af0ff84be6812ab106bf8b336a06ffb074522c0aacb04d448b878a9
reviewed_at: 2026-11-06T12:29:15Z
---
<!-- Round 4 frontmatter. Round 3 frontmatter was: verdict changes-requested,
     reviewed_hash 2a0c72c63335b4a31eb914820ec82629879e111b074418d562c8d6421d8dd029, reviewed_at 2026-11-06T12:22:40Z. -->
<!-- Round 3 frontmatter. Round 2 frontmatter was: verdict changes-requested,
     reviewed_hash 76fa0e9f5089183ee43196eed601a6729829cb5bc4425b5054f5c6cba5591c1b, reviewed_at 2026-11-06T12:12:34Z. -->
<!-- Round 2 note. The hash recipe is in "Round 2 (delta)" below. Round 1 frontmatter was:
     verdict changes-requested, reviewed_hash 47cd7f6ced3eb7f0848cfdf27dd9cbc155f37a8f904827990566d7bd6d51dae8,
     reviewed_at 2026-11-06T12:07:00Z. -->
<!-- Round 1: reviewed_hash = sha256 of (`git diff HEAD` ++ `git ls-files --others --exclude-standard -z | xargs -0 sha256sum`),
     taken before this file existed. `git diff HEAD | sha256sum` alone = c2ec52325d1ae1bb4f88b5a2fac4dab3ff5169d0d2b2d0d244baad0a34f3d1dd.
     `pnpm ticket:verify` does not exist in this repo ("Command not found"), so no receipt diff_hash was available. -->

## Findings

Probed with real fixtures via `MF_WORKSPACE_FILE`. The YAML meaning of each input was confirmed with `yaml@2.9.1` `parseDocument`.

- [blocking] scripts/check-workspace.mjs:23: the value capture `([^#]*?)` followed by `(?:#.*)?` reads a `#` with no
  space before it as the start of a comment. YAML only starts a comment at `#` when whitespace comes before it.
  Input `allowBuilds:\n  esbuild: true#x\n` gives exit 0, "1 allowBuilds entries, ok". YAML parses this as
  `{"esbuild":"true#x"}`, a string. This is a false green for "any allowBuilds value not literally true or false"
  (End state, SC-2 "fails closed"), and the exact silent-accept the plan names as its riskiest step. Fix: require
  `[ \t]+` before the comment group (for example `(?:[ \t]+#.*)?$`), or reject any `#` in the value.
- [blocking] scripts/check-workspace.mjs:40: the parser finds the block only with `/^allowBuilds\s*:/`. When that
  misses, it reports "0 allowBuilds entries, ok". That is "read as none found", which verification.md §4 forbids.
  Each of these exits 0, yet YAML reads each as `allowBuilds: {esbuild: "yes"}`:
  - a UTF-8 BOM: `\xEF\xBB\xBFallowBuilds:\n  esbuild: yes\n`. This is plausible on this Windows team, since
    PowerShell 5 `Set-Content -Encoding UTF8` writes a BOM.
  - a quoted key: `"allowBuilds":\n  esbuild: yes\n` and `'allowBuilds':\n  esbuild: yes\n`.

  Fix: strip a leading `U+FEFF`, and match the key quoted or unquoted. Also fail on any line that names
  `allowBuilds` as a key but is not the one recognised top-level line.
- [blocking] scripts/check-workspace.mjs:40 and :51: only the first `allowBuilds:` block is checked. Input
  `allowBuilds:\n  esbuild: true\npackages:\n  - .\nallowBuilds:\n  sharp: yes\n` exits 0 with "1 allowBuilds entries,
  ok", and the second block is never read. YAML reports DUPLICATE_KEY, so pnpm fails at Install. That is the
  unnamed red this gate exists to prevent, and a merge that concatenates two halves of a file (F-5 in this very
  ticket) produces exactly this shape. Similarly, `allowBuilds:\n---\n  esbuild: yes\n` exits 0 (`---` at column 0
  ends the block, and YAML reports MULTIPLE_DOCS). Fix: count every column-0 `allowBuilds` key and fail when there
  is more than one, and fail on the document markers `---` / `...`.
- [minor] scripts/check-workspace.mjs:23: the indent is exactly ` {2}`, but LOOP-PLAN §Parser step 3 specifies
  ` {2,}`. A valid 4-space file, `allowBuilds:\n    esbuild: true\n    sharp: false\n`, exits 1 with "cannot read
  line" twice, although YAML reads it as `{esbuild:true, sharp:false}`. This fails closed, so it is not a false
  green, but it would turn CI red on a legitimate file, and it departs from the approved plan without a note. Either
  take the indent from the first entry and require every entry to match it (a deeper line is still rejected as
  nested), or record the 2-space rule as a deliberate decision in GOAL.md.
- [minor] src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts:46-70 (frozen, not to be edited; it is not
  wrong, only thin). SC-2 lists no fail-closed case for the block *locator* (BOM, quoted key, duplicate key) or for
  `#` without whitespace. That is why the three blocking items pass the frozen suite. verification.md §4 asks the
  plan to list every input the parser must reject, each with its own test. Add these as non-frozen tests beside the
  fix.
- [nit] scripts/check-workspace.mjs:32: when `MF_WORKSPACE_FILE` points at a directory, `existsSync` is true and
  `readFileSync` throws EISDIR as an uncaught stack trace (exit 1). It fails closed, but the problem is not reported
  in the script's own `<file>: …` format.
- [nit] .planning/tasks/MF-0061/GOAL.md:12: the renumber note cites "issue #91", but MF-0046 GOAL.md F-5 and SC-6
  say issue #96 holds MF-0061. One of them is wrong.

## Checked and fine

- SC-1 / SC-2 / SC-3 / SC-5: the frozen acceptance suite passes 4/4. The frozen file's sha256 matches FROZEN.json
  (`36f70636…`). The 71ac090 replay is red, and the repo file gives "4 allowBuilds entries, ok".
- SC-4: in `.github/workflows/ci.yml`, the `Workspace check` step runs `node scripts/check-workspace.mjs` after
  setup-node and before `Install`. The script imports only `node:` modules (F-4 holds).
- SC-5: `isRelevantSource("pnpm-workspace.yaml")` is true. Touched paths reach it as repo-relative POSIX
  (`gate-io.mjs` `toRel` splits on `sep`), so a Windows path also matches the exact string. A pnpm-written change
  made through Bash is recorded by the git-snapshot diff in `track-changes.mjs`. `stop-gate.mjs:156` picks up
  `gate:workspace` through the `gate:` prefix. `node scripts/check-hooks.mjs`: PASS.
- SC-6 (T0): `pnpm gate:planning` gives "60 ticket folders checked, ok". The mf-0028 and mf-0053 acceptance tests
  pass 29/29. MF-0061/GOAL.md equals the removed block, plus a frontmatter header and the renumber note.
- CRLF: `\r\n` is normalised and a CRLF fixture passes. A lone `\r` fails closed. Placeholder matching is
  file-wide and case-insensitive, including inside comments.
- Scope: every changed path is inside a task's `owns`. Biome is clean on the changed scripts.

## Round 2 (delta)

- verdict: changes-requested
- reviewed_hash: 76fa0e9f5089183ee43196eed601a6729829cb5bc4425b5054f5c6cba5591c1b
- reviewed_at: 2026-11-06T12:12:34Z
- Hash recipe, run from the repo root before this section was written:
  `{ git diff HEAD; git ls-files --others --exclude-standard -z ':!.planning/tasks/MF-0046/REVIEW.md' | xargs -0 sha256sum; } | sha256sum`.
  The untracked set it covers is `.planning/evidence/MF-0046.md`, `.planning/tasks/MF-0046/{FROZEN.json,LOOP-PLAN.md,LOOP-VERIFY.md}`,
  `.planning/tasks/MF-0061/GOAL.md`, `scripts/check-workspace.mjs`, `src/test/__tests__/check-workspace.test.ts` and
  `src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts`. This file is excluded, so editing it does not
  change the hash.
- Scope: `scripts/check-workspace.mjs` and `src/test/__tests__/check-workspace.test.ts` only. Every fixture was a
  byte-exact file passed through `MF_WORKSPACE_FILE`. I checked each one against `yaml@2.9.1` and, where it mattered,
  against real pnpm (`pnpm config get allowBuilds` in a scratch workspace). Caveat: the local pnpm is 12.16.1, while
  `packageManager` pins 12.3.4.

### Round 1 findings: status

- B1 `true#x`: **fixed.** It exits 1. `esbuild: true<TAB>#x` exits 0, which is correct: yaml and pnpm both read `true`.
- B2 BOM, `"allowBuilds"`, `'allowBuilds'`, `? allowBuilds` at column 0: **fixed** (exit 1). The "any other line
  naming allowBuilds" guard covers column-0 lines only. See R2-B2.
- B3 duplicate block, `---`, `...`, `%YAML` + `---`: **fixed** (exit 1).
- minor 4-space indent: **fixed.** A consistent 4-space block passes, and a mixed 2/4 indent fails.
- nit directory path: **fixed.** It prints `<file>: cannot read the workspace file (EISDIR)` with no stack trace.
- nit MF-0061 #91: I accept the explanation (#91 is the other MF-0059's issue) and did not re-check it.
- Tests: `check-workspace.test.ts` (6) and the frozen acceptance test (4) pass, 10/10. The frozen file sha256 still
  matches FROZEN.json (`36f70636…`). The repo file gives "4 allowBuilds entries, ok". Biome is clean on both files.

### Findings (round 2)

- [blocking] R2-B1 scripts/check-workspace.mjs:81. A block sequence at column 0 under the header is read as "none
  found". `/^\S/` ends the block before the first item is read, so `allowBuilds:\n- esbuild\n` exits 0 with
  "0 allowBuilds entries, ok". `allowBuilds:\n- esbuild: yes\n` does the same. yaml reads `allowBuilds: ["esbuild"]`,
  because a sequence may sit at the parent's indent. pnpm 12.16.1 rejects the file with `unexpected event: expected
  mapping start`, so Install goes red with no named cause. That is the exact failure this gate exists to prevent.
  Someone who copies the old `onlyBuiltDependencies` list shape will write this. Fix: when the first significant
  line after a header is at column 0 and matches `/^-(?:[ \t]|$)/`, report a problem.
- [blocking] R2-B2 scripts/check-workspace.mjs:55-62. Round 1's B2 fix ("fail on any line that names allowBuilds but
  is not the recognised header") only covers lines matching `/^\S/`. A key written on an indented line, or spelled
  with an escape, is still read as "none found". Each of these exits 0 with "0 allowBuilds entries, ok":
  - JSON-style (flow) document: `{\n  "packages": ["."],\n  "allowBuilds": {"esbuild": "yes"}\n}\n`. pnpm 12.16.1
    reads `allowBuilds = {"esbuild": "yes"}`, a string value. That is a false green for SC-2. Writing a YAML file
    as JSON is a realistic shape.
  - explicit key on its own line: `?\n  allowBuilds\n:\n  esbuild: maybe\n`. pnpm reads the key.
  - merge key: `x: &x\n  allowBuilds:\n    esbuild: maybe\n<<: *x\n`. pnpm 12 applies `<<` here and resolves
    `allowBuilds` (with `yes` it printed `{"esbuild": true}`).
  - escaped key: `"allow\u0042uilds":\n  esbuild: yes\n` (also `\x42`). yaml and pnpm both read `allowBuilds`.

  Fix: drop the `/^\S/` condition, so every non-comment line, at any indent, that contains `allowBuilds` and is not
  a recognised header is a problem. Strip a trailing `[ \t]#…` comment before the test (see the first note). Also
  fail on any column-0 line that starts with `{`, `[`, `?` or `<<`, and on any double-quoted key that contains a
  `\`. Add each input above as a test.
- [blocking] R2-B3 scripts/check-workspace.mjs:78-98. A duplicate entry inside one block passes.
  `allowBuilds:\n  esbuild: true\n  esbuild: false\n` exits 0 with "2 allowBuilds entries, ok". yaml reports
  `DUPLICATE_KEY`, and pnpm 12.16.1 fails with `duplicate mapping key: esbuild`, so Install goes red with no named
  cause. Round 1 B3 was blocking for the same reason. This is also the likeliest shape a merge leaves behind when
  both sides add or flip the same package, the F-5 scenario. Fix: keep a `Set` of names, and report a repeat.
- [blocking] R2-B4 scripts/check-workspace.mjs:27. The bare-name alternative `[\w@./-]+` accepts a leading `@`.
  `allowBuilds:\n  @swc/core: true\n` exits 0 with "1 allowBuilds entries, ok". `@` is a reserved YAML indicator:
  yaml reports `BAD_SCALAR_START`, and pnpm 12.16.1 fails with ``unexpected character: `@'``. The gate parsed this
  line, accepted it and called it ok, and then Install fails. Scoped packages with build scripts (`@swc/core`,
  `@parcel/watcher`) are the most likely hand-added entries. Fix: forbid `@` and the backtick as the first character
  of a bare name (for example `([\w.][\w@./-]*)`). The quoted form `'@swc/core': true` already passes, correctly.
- [minor] scripts/check-workspace.mjs:93. `String#trimEnd()` strips Unicode whitespace that YAML does not treat as
  whitespace. `esbuild: true` followed by U+FEFF exits 0, but pnpm 12.16.1 reads it as the string `"true\uFEFF"`.
  For NBSP, U+2002, U+3000 and VT, pnpm happens to trim too, so gate and pnpm agree on those. Fix:
  `.replace(/[ \t]+$/, "")`. This fails closed on the other characters, which is acceptable.
- [note] scripts/check-workspace.mjs:55-62. A legitimate file is rejected when a top-level line's trailing comment
  mentions the key, for example `packages: # allowBuilds is below`. This repo writes ticket-citing trailing
  comments, so the case is plausible. It fails closed, so it is not blocking, but the R2-B2 fix should strip
  `[ \t]#.*$` before it tests for `allowBuilds`.
- [note] Fail-closed rejections of input that pnpm accepts. These are consistent with the GOAL's "literally true or
  false" and listed only so the choice is deliberate: `allowBuilds: {}`, `esbuild : true`, `"esbuild" : true`, and
  `esbuild: yes` / `True` (pnpm 12.16.1 reads `yes` as boolean `true`).

### Checked and fine (round 2)

- No new fail-open input on the header line. `allowBuilds: {…}`, `&a`, `*b`, `!!map` and `#c` without a space all fail.
- No new fail-open input on the entry line. `'true'`, `!!bool true`, `&t true`, `<<: *b`, `esbuild:true`, a
  continuation on the next line, a plain multi-line value, a tab indent, a lone CR, and U+2028 / U+0085 inside a line
  all fail closed. A block scalar whose indented content contains `allowBuilds:` does not create a false block.

## Round 3 (delta)

- verdict: changes-requested
- reviewed_hash: 2a0c72c63335b4a31eb914820ec82629879e111b074418d562c8d6421d8dd029
- reviewed_at: 2026-11-06T12:22:40Z
- Hash recipe: the same as round 2, run from the repo root before this section was written. The untracked set is unchanged.
- Scope: `scripts/check-workspace.mjs` and `src/test/__tests__/check-workspace.test.ts` only. Every fixture was written
  byte-exact by a node script (backslashes built with `String.fromCharCode(92)`) and passed through `MF_WORKSPACE_FILE`.
  I checked each one with `yaml@2.9.1` `parseDocument`. For each new fail-open input I also ran real pnpm 12.16.1
  (`pnpm config get allowBuilds` in a scratch workspace).

### Round 2 findings: status

- R2-B1 column-0 list: **fixed.** `allowBuilds:\n- esbuild\n` and `allowBuilds:\n- esbuild: yes\n` exit 1.
- R2-B2: **fixed for the four inputs cited.** The JSON-style document, `?` on its own line, the `<<: *x` merge, and
  `"allow\u0042uilds"` / `"allow\x42uilds"` all exit 1. The class is not closed. See R3-B1.
- R2-B3 duplicate entry: **fixed.** `esbuild` twice exits 1, and so do `esbuild` + `'esbuild'`.
- R2-B4 leading `@`: **fixed.** `@swc/core: true` and a leading backtick exit 1. `'@swc/core': true` passes, correctly.
- minor trailing U+FEFF: **fixed** (exit 1).
- note trailing comment naming the key: **fixed.** `packages: # allowBuilds is below` passes.
- Tests: 15/15 pass (11 in `check-workspace.test.ts`, 4 frozen). The frozen file sha256 still matches FROZEN.json
  (`36f70636…`). The repo file gives "4 allowBuilds entries, ok". Biome is clean on both files.

### Findings (round 3)

- [blocking] R3-B1 scripts/check-workspace.mjs:33-40 and :64-72. The opaque-key and "allowBuilds anywhere" guards
  still miss two classes, so pnpm can read `allowBuilds` while the gate reports "0 allowBuilds entries, ok". Every
  input below exits 0. yaml reports no error for any of them, and pnpm 12.16.1 prints `{"esbuild": "maybe"}`, a string
  value. That is a false green for SC-2:
  1. `withoutComment` (:33-34) cuts from the first `[ \t]#`, even when that `#` is inside a quoted scalar, where it is
     not a comment. Everything after it is hidden from both guards:
     - `&a {"x #": 1, allowBuilds: {esbuild: maybe}}\n` (an anchor on a flow root)
     - `!!map {"x #": 1, allowBuilds: {esbuild: maybe}}\n` (a tag on a flow root)
     - ` {"x #": 1, allowBuilds: {esbuild: maybe}}\n` (a flow root indented one space)
     - `&a {\n  "x #": 1, allowBuilds: {esbuild: maybe}}\n`
  2. The opaque-key list (:36-40) checks `{ [ ?` at column 0 only, and checks an escaped key only when the closing
     quote and the `:` are on the same line. A root that begins with an anchor, a tag or an indent, or a key whose `:`
     is on the next line, gets past it:
     - ` ? "allow\u0042uilds"\n : {esbuild: maybe}\n` (indented block root with an explicit key)
     - ` ? "allow\<newline>   Builds"\n : {esbuild: maybe}\n` (an escaped line break joins `allow` and `Builds`
       with no space, and the backslash has no closing quote on its line)
     - ` {? "allow\u0042uilds"\n : {esbuild: maybe}}\n`
     - `&a {"allow\u0042uilds"\n : {esbuild: maybe}}\n`

  These inputs are contrived. But SC-2 says "fails closed", and the last two rounds closed each finding as a class
  ("any line … mentions allowBuilds", "any escaped double-quoted key"). Those classes leak here. Fix by class, not by
  input:
  - (a) strip a comment only when no `'` or `"` comes before the `#` on that line. Otherwise test the raw line. The
    `packages: # allowBuilds is below` case still passes.
  - (b) fail on any line that contains both `"` and `\`. That covers every escape and escaped line break, on any line
    and at any position. This repo's file has neither.
  - (c) require the root to be a column-0 block map: fail when the first significant line is indented, and when any
    significant column-0 line starts with a character other than a plain-key character, a quote, `-` or `#`. That
    covers `&`, `!`, `*`, `|`, `>`, `%`, `{`, `[`, `?`, `@` and the backtick.
  Add the eight inputs above as tests, RED before the fix.
- [note] scripts/check-workspace.mjs:74. A file that YAML rejects for a reason outside `allowBuilds` still passes.
  For example, `packages:` twice (`DUPLICATE_KEY`) gives "1 allowBuilds entries, ok". The gate is not a YAML
  validator and the GOAL scopes it to `allowBuilds`, so this is not blocking. It is listed so that the hand-off does
  not claim that a green gate means pnpm will parse the file.
- [note] `allowBuilds:` with no entries (`allowBuilds:\npackages:\n  - .\n`) gives "0 allowBuilds entries, ok". yaml
  reads `null` and pnpm reads `undefined`, with no error. The gate and pnpm agree.

### Checked and fine (round 3)

- No false rejection of this repo's file shape: trailing ticket comments, 2-space entries, a quoted `'@next/env@…'`
  list under another key, and `'x #': 1` / `['a #b']` on other keys all pass.
- `!!map\n? "allow\u0042uilds"\n: …` (a tag on its own line, then a column-0 `?`) and a single-line
  `!!map {"allow\u0042uilds" : …}` both fail. The leaks above need the specific shapes listed.

## Round 4 (delta)

- verdict: approve
- reviewed_hash: ea4e63839af0ff84be6812ab106bf8b336a06ffb074522c0aacb04d448b878a9
- reviewed_at: 2026-11-06T12:29:15Z
- Hash recipe: the same as rounds 2 and 3, run from the repo root before this section was written. The untracked set is unchanged.
- Scope: `scripts/check-workspace.mjs` after the rewrite from a blocklist to an allowlist of line shapes, and
  `src/test/__tests__/check-workspace.test.ts`. Every fixture was written byte-exact by a node script, run through
  `MF_WORKSPACE_FILE`, and checked with `yaml@2.9.1` `parseDocument`. Where a fixture could leak, I also ran real
  pnpm 12.16.1 (`pnpm config get allowBuilds` in a scratch workspace).

### Round 3 findings: status

- R3-B1: **fixed as a class.** All 8 cited inputs exit 1: the `&`/`!!map`/indented flow roots with `"x #"`, the
  indented `?` roots with an escaped or line-folded key, and the anchored multi-line flow roots. All 30 round-1 to
  round-3 fixtures behave as expected: only `repo`, `note_comment_ok`, `rb4_quoted_ok` and `n12_empty_header` exit 0.
  The structural reasons:
  - A column-0 line must be `[A-Za-z][\w-]*:` or the `allowBuilds` header, bare or quoted.
  - The first significant line can't be indented, since section `none` makes it unreadable.
  - A line after a key that has a value is unreadable.
  - Scalars must close on their own line, and double-quoted ones may not contain `\`.

  Together these leave YAML only one place to put a top-level key, a column-0 block-map line the gate classifies.
  `allowBuilds` can't appear anywhere else.
- note `packages:` twice: now caught (exit 1, "appears twice at the top level").
- Tests: 17/17 pass (13 in `check-workspace.test.ts`, 4 frozen). The frozen file sha256 still matches FROZEN.json
  (`36f70636…`). The repo file gives "4 allowBuilds entries, ok". Biome is clean on both files.

### Findings (round 4)

No blocking findings. I found no fail-open input in round 4. These are the classes I probed:

- **Key spellings pnpm might normalise:** `allow-builds:`, `allow_builds:`, `allowbuilds:` and `AllowBuilds:`, each
  with `esbuild: maybe` underneath. The gate passes them as "other" keys. Real pnpm 12.16.1 returns `undefined` for
  `allowBuilds` (and for `allow-builds`) in every case, so pnpm does not map them onto `allowBuilds`, and this is not
  a leak.
- **Value shapes PLAIN admits that are YAML indicators:** `foo: >` is a folded block scalar. The gate accepts it as
  closed, and yaml reads `foo: ""`. Any indented content after it is rejected, and content can't sit at column 0.
  `foo: <<` reads as a string. Nested `- >` with content `allowBuilds: maybe` stays a string inside `foo`. None of
  these reaches the top-level key.
- **Entry lines:** `esbuild:<TAB>true`, `-: true` and `...: true` give boolean values in yaml, so the gate is correct
  to accept them. `allowBuilds: ~` and `allowBuilds: # c` (followed by entries) are both handled correctly.

- [note] scripts/check-workspace.mjs:32. These inputs pass the gate but YAML rejects them, all outside `allowBuilds`:
  - `foo: -` (PLAIN admits a lone `-`). pnpm says "block sequence entries are not allowed in this context".
  - `foo:\n  - a\n  b: c` (a list and a map mixed under one key). yaml reports `BAD_INDENT`.
  - `foo:\n  a: x\n   b: y` (a deeper nested line). yaml reports `MULTILINE_IMPLICIT_KEY`.

  This is the same class as the round-3 note. The header already says a green gate does not mean pnpm parses the
  file. CI's Install still goes red here, though without a named cause. It isn't blocking. Narrowing PLAIN's first
  character to exclude a lone `-`, and requiring one indent per nested section, would close it cheaply.
- [note] These richer but legitimate files now fail closed: `packages: ['a #b']`, a quoted top-level key `'x #': 1`,
  flow values, anchors, block scalars under `allowBuilds`, and deeper nesting. The header documents this ("widen the
  grammar then"). This repo's own `pnpm-workspace.yaml` passes: trailing ticket comments, 2-space entries, and the
  `minimumReleaseAgeExclude` list of single-quoted `@`-scoped names.
