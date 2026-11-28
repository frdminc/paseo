---
schema_version: 1
handoff_id: d6f4
parent_handoff_ids: [026c]
lineage: deterministic
chain: [standalone-7577]
repo: paseo
workspace: paseo
branch: feat/workspace-identity-accent
head_sha: be708ebca14617f3737b3d0a7f6fe5ed3361b0a9
created_at: 2026-11-28T11:05:00-05:00
writer: claude-code
---

# Handoff — Code Mode TUI worker: benchmark done, PR 1028 open

## The Goal

Make Claude Code's experimental Code Mode (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`, the `REPL` tool) usable by ADE agents from
Paseo through an interactive-TUI background worker (brief in, report out), after benchmarking it. Parent handoff 026c has the
research.

## Where We Are

- **Benchmark done** (djbclark approved 5 pairs). Sonnet 5.5, interactive TUI, one 6-file edit-and-test fixture, order alternated.
  Medians on vs off: input 258k vs 316k (-18%), output 6.5k vs 4.7k, API-price cost $0.34 vs $0.31 (+10%), wall 67 s vs 43 s,
  6 requests each, 5/5 tests pass in both arms. Verdict: no saving, because Sonnet without Code Mode already batched its edits into
  4-7 `Bash` calls. Weekly Claude meter went from 5% to 7% (that includes this session's own Opus use).
- **djbclark then ruled: build the wrapper anyway**, and post the 10638 correction without the benchmark paragraph.
- **Posted:** https://github.com/getpaseo/paseo/discussions/10638#discussioncomment-19978815
- **Built:** `bin/claude-codemode-worker` in djbclark-ade by Sonnet worker `dcbae02f-0a15-48d1-84b6-e4877f13827e`
  (window `WORKER djbclark-ade (Code Mode worker)`, tab `worker codemode-worker`), in the claimed worktree
  `/Users/djbclark/src/djbclark-ade-codemode-worker-wt`, branch `claude-codemode-worker`
  (claim `/Users/djbclark/.local/state/ade/claims/djbclark-ade-codemode-worker-wt-20261128T144458Z-38f8.json`, owner this agent).
- **Adversary:** three rounds. `fe8efca4` BLOCK (2 medium: env leaks, trust spreading to subfolders); `ffcae5d3` BLOCK (1 medium:
  identity recovery through the process tree, ADE claim and Ref variables, lost git-guard marker); `c0a0b9b0` APPROVE (2 lows as
  follow-ups).
- **PR open:** https://github.com/djbclark/djbclark-ade/pull/1028. The fragment fill commit `6c36c19c` was pushed by
  `ade-pr-open`. CI (`context-policy`, `pytest-linux`) was pending at handoff. The PR body quotes the verdict in prose, with the marker
  fenced; a live APPROVE marker is the operator's own (`bin/ade-merge-ready approve-post`).
- Paseo checkout: nothing changed except this handoff. The dirty files (`.gitignore`, `.ignore`, two old untracked handoffs) are not
  this chain's.

## What We Tried

1. The first pty driver hung in `waitpid` after the run finished: an exiting `claude` blocks on undrained pty output. Fix: close the
   master fd before reaping. Now in the memory note and the tool.
2. The first analyzer counted `<synthetic>` assistant records, the inner `repl_*` calls, as requests (62 instead of 5). They carry zero
   usage; they are now excluded.
3. The worker's brief said "fake claude first on PATH". The ADE review rules forbid reordering PATH in tests; the brief was amended to
   `--claude-bin`/`--paseo-bin`.
4. Writing a live `adversary-verdict:v1` APPROVE marker in the PR body was refused by the gh shim (only the operator writes a live
   marker), so it is fenced. A heredoc containing `**` was blocked by `secret_read_gate` (glob budget): write PR bodies with the
   Write tool.
5. Hand-typed or reused `Ref:` lines were rejected three times: run `ref CLAUDE` in every turn
   (memory `feedback_ref_line_run_ref_every_post.md`).

## Key Decisions

The benchmark host was a Python pty driver, not a Paseo terminal: same `cli` entrypoint, scriptable, one background job. For env
cleaning, an expanded shared denylist rather than an allowlist, so git and SSH keep working, with `--keep-env` refusing identity and
credential names. For trust, refuse a folder that isn't already trusted unless `--accept-trust` is passed, and always refuse `/`,
home, temp folders and non-git-roots. `ADE_CLAIM_ID` is always stripped (no claim sharing). The child gets `PASEO_AGENT_ID=""` and
`ACP_RUN_AGENT=1`. Routing (`route_agent.py`, pools) was left to the djbclark-ade lead, who agreed and said any pool needs operator
acceptance plus measured evidence.

## Decisions

- [ruling] "1. Run 5 pairs (Recommended)" for the Code Mode benchmark (djbclark, 2026-11-28)
- [ruling] "3. Build the wrapper anyway" after the no-saving benchmark (djbclark, 2026-11-28)
- [ruling] "2. Post without benchmark" for the Discussion 10638 correction (djbclark, 2026-11-28)
- [decision] Env cleaning by expanded denylist plus a refusing `--keep-env`; rejected: strict allowlist; because an allowlist could break git/SSH in the child
- [decision] Refuse an untrusted cwd unless `--accept-trust` is passed; rejected: auto-accept trust; because accepted trust persists for the whole subtree
- [decision] Strip `ADE_CLAIM_ID` always, set `PASEO_AGENT_ID=""` and `ACP_RUN_AGENT=1`; rejected: claim sharing; because the worker must never act as its caller
- [decision] No routing pool or `route_agent.py` change; rejected: a `claude-tui-codemode` pool now; because there is no measured saving and routing is the ADE lead's

## Relations

- continues [[HANDOFF_standalone-7577_code-mode-tui-pilot_2026-11-28_026c]]
- decided_in [[HANDOFF_standalone-7577_codemode-worker-pr1028_2026-11-28_d6f4]]

## Evidence & Data

- Benchmark data, driver, analyzer, fixture bundle: `/Users/djbclark/.local/state/agent-reports/1c1c1b6b-827a-4879-9b6a-6ca8bc04bee2/code-mode-benchmark-20261128/` (`runs/summary.json`).
- Worker reports: `.../1c1c1b6b-827a-4879-9b6a-6ca8bc04bee2/codemode-worker-report.md`, `codemode-worker-repair-report.md`, `codemode-worker-repair2-report.md`.
- Adversary reports: `.../codemode-worker-adversary-report.md`, `-adversary2-report.md`, `-adversary3-report.md`.
- Tests: the worker's focused suite, 119 passed via bgrun at `c0a0b9b0`. Real Haiku smoke runs: pty + paseo at `fe8efca4`, paseo with `--accept-trust` after repair 1; all `done` with `code_mode_active: true`. Linux CI pending at handoff.
- Memory note updated: `/Users/djbclark/.claude/projects/-Users-djbclark-src-paseo/memory/reference_claude_code_mode_gating_20261128.md`.

## Operator Feedback

He approved the spend without comment, chose to build despite the no-saving result, and asked for the public correction to leave out the
benchmark.

## Where We're Going

1. **Watch PR 1028 CI** (`gh pr checks 1028 -R djbclark/djbclark-ade`). On red, read the CI log and send a repair to worker
   `dcbae02f-0a15-48d1-84b6-e4877f13827e` (idle, told to stand by; same worktree, one writer). On green, tell djbclark that the live
   marker/merge is his (`bin/ade-merge-ready approve-post`).
2. After merge: archive worker `dcbae02f…` and its WORKER box if empty, `git worktree remove` the worktree, release the claim
   (`ade_claims.py`), and delete the local branch.
3. Optional follow-up PR for the two adversary lows (provider switches and `ACP_OPERATOR_APPROVED` through `--keep-env`; paseo-mode
   matching above the ` exec` line); ask djbclark first.
4. Upstream items from 026c item 6, each after a dupe search, filed per `~/CLAUDE.md` items 38/43 (show djbclark the text before
   posting): a Paseo PR or Discussion allowing `settings.env` in Claude provider options; a note on
   `getpaseo/claude-code-entrypoint-env` that the `Paseo` label disables Code Mode; Anthropic's Code Mode docs page still says
   "interactive terminal only", while the 2.1.332 binary says headless works.
5. Leftovers, low priority: trust entries in `~/.claude.json` for deleted temp repos (the worker's smoke runs and the benchmark
   fixture under this session's scratchpad); harmless, so leave them unless djbclark wants them removed.

## Detached jobs

none (no bigteam job records; this session's background waiters have all finished).

## Quick Start

```bash
gh pr checks 1028 -R djbclark/djbclark-ade
git -C /Users/djbclark/src/djbclark-ade-codemode-worker-wt log --oneline -4
paseo ls -g --json   # worker dcbae02f-0a15-48d1-84b6-e4877f13827e; djbclark-ade lead da998a19-1776-433d-8ac2-eaefdfa5d6da
python3 /Users/djbclark/src/djbclark-ade/bin/ade_claims.py list
```

Peers: the djbclark-ade lead `da998a19-1776-433d-8ac2-eaefdfa5d6da` (acked; owns routing; was told the footer rule 16 note) and the
Paseo fork lead `afd98ddc-8604-4b0e-ac1b-13f7b58e6c62` (acked; no conflicts). Tell both your new id after accept.
