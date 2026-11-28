---
schema_version: 1
handoff_id: 026c
parent_handoff_ids: []
lineage: none
chain: [standalone-7577]
repo: paseo
workspace: paseo
branch: feat/workspace-identity-accent
head_sha: 617ea57b4eb6a86c1bddda880973ec8c738b8926
created_at: 2026-11-28T08:50:16-05:00
writer: claude-code
---

# Handoff — Claude Code "Code Mode" in Paseo: research done, TUI worker pilot next

## The Goal

djbclark asked (2026-11-28) for a deeper look at getting Claude Code's experimental Code Mode
(`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`, the `REPL` tool) usable from Paseo before Anthropic ships
host support, with herdr, ACP and routing as options, and background (non-interactive) use by other
agents acceptable. Coordinate with the djbclark-ade lead.

The research is done. He then chose the next step: **"1. TUI worker + benchmark"**: benchmark Code
Mode on vs off first, then build a small ADE wrapper that runs interactive `claude` with Code Mode in
a Paseo terminal or herdr pane as a background worker (brief in, report file out). No Paseo change;
the entrypoint plugin stays.

## Where We Are

Research complete and reported to djbclark. Nothing built. No code or config changed in any repo.
Facts live in the memory note
`/Users/djbclark/.claude/projects/-Users-djbclark-src-paseo/memory/reference_claude_code_mode_gating_20261128.md`
(read it first; this handoff does not repeat it in full).

Verified on Claude Code 2.1.332:

- Headless Code Mode already exists: entrypoint must be `sdk-cli`/`sdk-ts`/`sdk-py` AND the variable
  must be in the `env` block of `--settings`. Shell env or `~/.claude/settings.json` alone is ignored.
- Paseo Claude agents are refused because the installed plugin `getpaseo/claude-code-entrypoint-env`
  (`~/.paseo/plugins/claude-code-entrypoint-env/`) sets `CLAUDE_CODE_ENTRYPOINT=Paseo`, the
  workaround for anthropics/claude-code#97074 (sdk labels drain the 5-hour window faster).
- Interactive `claude` (entrypoint `cli`) in a Paseo terminal turns Code Mode on and did a 3-file
  edit through `REPL`, driven by `mcp__paseo__create_terminal` / `send_terminal_keys` /
  `capture_terminal`, result read from a report file.

Not verified: any metering number (all third-party); Code Mode's saving (one third-party 5-pair test;
my toy task showed none); a live Paseo agent on an sdk label; herdr pane (expected same as a Paseo
terminal); ACP (reasoned only: same Agent SDK, same gates, no advantage).

## What We Tried

1. Probes with the variable only in the shell env (entrypoints `Paseo`, `sdk-ts`, unset): no Code
   Mode, no notification. Cause: headless needs `--settings` (`not_passed`), found by reading the
   binary's gate function.
2. Same probes with `--settings '{"env":{"CLAUDE_CODE_EXPERIMENTAL_CODE_MODE":"1"}}'`: `Paseo`
   refused with a `code-mode-opt-in` notification; `sdk-ts` and unset (`sdk-cli`) on (`repl-mode`
   first record in the session file).
3. A 6-file edit task headless, on vs off, Haiku 5.5: on took 5 turns, off 3 (off used one `gsed`),
   same cost. Too small and too easy to mean anything. Do not cite it as a result.
4. Interactive TUI in a Paseo terminal: worked. A new folder shows the trust dialog first; default is
   "No, exit" (send `Down`, `Enter`).
5. Mistake to avoid: printing the stream-json init `tools` list (150+ names) three times cost about
   20k tokens of context.

## Key Decisions

The TUI route was recommended and chosen because it is the only route that should get both Code Mode
and the favourable `cli` meter. A Paseo-native `claude-codemode` provider profile (sdk-ts label plus
a fork patch allowing `settings.env` in `ClaudeProviderOptionsSchema`,
`packages/server/src/server/agent/providers/claude/options.ts`) was offered and not chosen: it pays
the reported meter penalty and needs a live-daemon config change. `claude -p` workers and ACP were
set aside for the same meter reason. Routing changes belong to the djbclark-ade lead; this chain does
not edit `route_agent.py`.

## Decisions

- [ruling] "1. TUI worker + benchmark (Recommended)" chosen from a four-option card (djbclark, 2026-11-28)
- [decision] Pilot the interactive-TUI background worker; rejected: Paseo-native sdk-ts profile, `claude -p` workers, ACP adapter; because only the `cli` entrypoint gets Code Mode without the sdk-label 5-hour meter penalty
- [decision] Benchmark before building the wrapper; rejected: build first; because the only saving figures are third-party and my toy task showed none
- [decision] Leave `route_agent.py` and any routing pool to the djbclark-ade lead; rejected: editing it from this chain; because that repo has its own lead and one-writer rule

## Relations

- decided_in [[HANDOFF_standalone-7577_code-mode-tui-pilot_2026-11-28_026c]]

## Evidence & Data

- Gate function (2.1.332 binary): allowed headless entrypoints `new Set(["sdk-cli","sdk-ts","sdk-py"])`;
  interactive requires `cli`; reason codes `entrypoint`, `not_passed`, `turned_off`,
  `headless_provider`, `unprefixed_tools`, `unattended`, `tools`, `model`.
- Headless stream: inner calls are ordinary `Bash`/`Edit` tool_use with ids `toolu_cc_*`; no `REPL`
  event. TUI transcript: `REPL` tool_use plus inner ids `repl_*`, and a `Poll` tool.
- Third-party numbers: Code Mode 236k vs 405k input tokens, 31 s vs 52 s on edit+test, no gain
  read-only (comment on anthropics/claude-code#109679); sdk labels 1.6x to 2.9x faster 5-hour drain,
  weekly unaffected in one report (anthropics/claude-code#97074).
- Paseo: `settings` option schema is strict (no `env`); `extraArgs.settings` is overridden when
  Paseo sets `options.settings` (`buildSettingsOptions`, `agent.ts` near line 3649).
- Links: https://github.com/getpaseo/paseo/discussions/10638 (its premise is now stale),
  https://github.com/anthropics/claude-code/issues/109679,
  https://github.com/anthropics/claude-agent-sdk-typescript/issues/544,
  https://github.com/djbclark/djbclark-ade/issues/810, djbclark-ade `docs/queue.md` item 71.
- Scratch probe files were in the old session's scratchpad and are not kept; the probe commands are
  in the memory note.
- Tests run: none (no code changed).

## Operator Feedback

- Sessions need not be interactive; background use by other agents is fine.
- herdr may be part of the solution; ACP and routing were to be considered.
- He picked the recommended pilot without comment.

## Where We're Going

1. **Design and run the benchmark (next action).** Fixed edit-and-test task in a throwaway repo,
   interactive TUI in a Paseo terminal, Code Mode on vs off (off: `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=0`
   in the launch env), same model (Sonnet 5.5, the ADE code-worker model), at least 5 pairs, order
   alternated, fresh session each. Read tokens per arm from the session transcripts under
   `~/.claude/projects/`. Read 5-hour utilisation before and after each block
   (`aiuse --available --json`). Check quota first (`~/CLAUDE.md` item 29) and tell djbclark the
   expected spend before starting; a label comparison (`cli` vs `sdk-ts` vs `Paseo`) is optional and
   costs much more because the meter has 1% steps.
2. Report the numbers to djbclark and the djbclark-ade lead.
3. If Code Mode wins: build the wrapper in `~/src/djbclark-ade` (claimed workspace, coordinate with
   its lead `da998a19-1776-433d-8ac2-eaefdfa5d6da`, code by a Sonnet worker through
   `route_agent.py plan`, not by Fable). Contract: clean env
   (`env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION`), pre-trusted cwd or
   handle the trust dialog, brief in, report file out, wait on the file, kill the terminal. Paseo
   terminal first; herdr pane variant after a herdr test.
4. Open with the djbclark-ade lead: its answers to three questions (other Code Mode research, anyone
   already on it, constraints on a new routing kind or pool) were still queued at handoff. A
   `claude-tui-codemode` pool in `route_agent.py` is its call.
5. Pending djbclark's OK on exact text: a correction on Discussion 10638 (headless Code Mode exists;
   the blocker for Paseo is the entrypoint label and the `--settings` requirement; no REPL card is
   needed). Draft it, show him, post nothing before his yes.
6. Possible upstream items, each after a dupe search: Paseo PR allowing `settings.env` in Claude
   provider options; a note on getpaseo/claude-code-entrypoint-env that the label disables Code Mode;
   the Code Mode docs page still says "interactive terminal only".

Blockers: none. No sub-agent was dispatched; no report is outstanding.

## Detached jobs

none

## Quick Start

```bash
cat /Users/djbclark/.claude/projects/-Users-djbclark-src-paseo/memory/reference_claude_code_mode_gating_20261128.md
claude --version   # re-check the gate if newer than 2.1.332
aiuse --available --json
paseo ls -g --json   # find the current djbclark-ade lead; id may have changed by succession
```

Peers: Paseo fork lead `afd98ddc-8604-4b0e-ac1b-13f7b58e6c62` (acked; no extra notes; no conflict
with fork builds 4 or 5). djbclark-ade lead `da998a19-1776-433d-8ac2-eaefdfa5d6da` (two messages
queued, no ack yet; its reply goes to the predecessor id `d71983da-4358-42c2-a943-e3eea4274009`, so
tell it your new id).
