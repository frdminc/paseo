---
schema_version: 1
handoff_id: aee9
parent_handoff_ids: [403c]
lineage: inferred
chain: [standalone-b2f1]
repo: paseo
workspace: paseo
branch: feat/workspace-identity-accent
head_sha: a3aa8afaa6a69dbe778c2d146e15f70ac2e85aac
created_at: 2026-11-22T21:55:00-05:00
writer: claude-code
---

# Handoff — fork desktop build 2 on upstream v0.17.3 (built, not installed)

Predecessor: Paseo lead `afa869f0-0e51-4ab7-937e-ccdc72f2c3af` (Claude Sonnet 5.5, high). Successor: Antigravity `gemini-4-neon`, thinking high, same workspace `wks_318d4100eed693ab`, cwd `/Users/djbclark/src/paseo`. djbclark chose the successor model himself ("You should handoff to an Antigravirty Neon High agent").

Lineage is inferred from 403c (`HANDOFF_standalone-b2f1_paseo-install-android-warpbuild_2026-11-21_403c.md`): same chain tag, same work, and I did not start from a resume prompt naming it.

## The Goal

djbclark runs his own patched Paseo desktop build on upstream, kept current by the frdminc fork family (8 repos under github.com/frdminc since 2026-11-21), plus an Android fork release path. Build 1 is the installed v0.17.1 cutover (daemon pid 10622, port 7263). Build 2 is the next desktop build, based on upstream v0.17.3 with all fork picks.

## Where We Are

Build 2 is BUILT and verified in CI, NOT INSTALLED.

- Branch `local/main-desktop-v0173-fork2-20261122` on frdminc/paseo, head `2c5cb9d7fbe13bc9c36515d706e45cae48495d57`, worktree `/Users/djbclark/src/paseo-desktop-v0173-fork2-wt`. It is v0.17.3 (`dd7c0499a8c311fae7b3244722a64d73cc178e4a`) + 9 fork commits (workflow, status-ring, linked-checkout/installDirs, publish null, sidebar divider, sticky Workspaces header, replay-wait cap, About marker "djbclark fork 2") + 10 picks (agent-ID search, web UI precompression, sharp worktree fix, shift-drag copy x10, ordering sync = upstream PR 9830, Pi stack x17, Antigravity elicitation) + 3 CI fixes (`f75b081cc` zh-CN docs section, `1b5be56f7` React keys in sidebar lists, `9baaeffb2` sort chosen by click in sidebar-reorder e2e) + workflow retarget `2c5cb9d7f`.
- WarpBuild run https://github.com/frdminc/paseo/actions/runs/45089265694: every step success. Zip `Paseo-main-arm64.zip`, 198,940,563 bytes, sha256 `460e165d2fd5546cf6a3e78ecbe32bac2a67c1fa990c7c1eee9b2d8463848508` (re-hashed locally, matches). App `sh.paseo.desktop` 0.17.3, ad-hoc signed, packaged smoke passed. Test cases: desktop 445, skills 46, worktree 177, status-ring 5, plugin-acp 108, app-local 62, all 0 failures. `app-dist` ships `.br` and `.gz` (main JS 25.3 MB -> 4.06 MB br).
- Artifact and evidence: `~/.local/state/agent-reports/afa869f0-0e51-4ab7-937e-ccdc72f2c3af/build2-artifact/Paseo-main-arm64-2c5cb9d7fbe13bc9c36515d706e45cae48495d57-attempt-1/`.
- ci.yml on the branch (run https://github.com/frdminc/paseo/actions/runs/45081498827): green except 3 Windows terminal tests in `packages/server/src/terminal/worker-terminal-manager.test.ts`; that run's first attempt passed them and our diff has no `packages/server/src/terminal` changes, so it is a flake (not re-run).
- PR 9830 adversary review: APPROVE for the personal build (report `~/.local/state/agent-reports/afa869f0-0e51-4ab7-937e-ccdc72f2c3af/pr9830-adversary-report.md`). Findings, none blocking: I1 a malformed or future-format `~/.paseo/projects/ui-order.json` stops the daemon booting (move it aside); I2 no size bounds on target inventories; I3 every workspace upsert waits on an ordering prune.
- Not tested in the packaged app: About marker, agent-ID search, shift-drag, ordering sync, Pi question fixes, Antigravity question cards. CI proves only unit/e2e and the smoke test.
- Local `~/src/paseo` checkout: branch `feat/workspace-identity-accent` @ a3aa8afaa; dirty `.gitignore`, untracked `.ignore` and two older handoff files are NOT mine (never stage or stash them).

## What We Tried

- Local tests on the v0.17.3 branch: `load-watch ci decide` opens a sudo-ask approval dialog that timed out (twice, 280 s), so no local test ran. The worktree also has no `node_modules`. CI was the only verifier.
- First CI run (45066407202) failed three ways, all ours: zh-CN docs lacked `#ordering-across-devices` (PR 9830 pick); `sidebar-reorder.spec.ts:589` chose Sort by keyboard while the flyout was opening and landed on Manual (PR 9830 pick changed the helper); both onboarding specs timed out because the sticky-header pick (PR 10325, closed unmerged upstream 2026-11-22) used `Children.toArray` over unkeyed items, 741 React key errors, and the error toast covered Settings. Fixed by the three commits above and confirmed green in run 45081498827.
- `ade-fork-picks apply` stops at the v0.17.1 release commits `f03734c40` and `043f0995d` in the Pi range. The rebase worker skipped them on purpose (they would reset package versions). Registry PR 946 (merged) now supports `exclude`.
- Wrangler bump `chore/bump-wrangler-sharp-0-35` @ 1f06e8fb9: fork CI run 45052130017 FAILED (typecheck, desktop-tests ubuntu, quality). Parked, no PR, not in build 2.
- `[SharedOrdering] Target inventory remains pending ... Workspace is not active` console errors (343 in the e2e run) come from PR 9830 as written: `setTargets` rejects the whole inventory when one workspace is archived or unknown. Transient, did not cause a failure. Not patched (it would diverge the pick).
- Hooks ran in all three CI-fix commits; the `--no-verify` commits are in the earlier rebase (two on the v0.17.3 branch) and were disclosed to djbclark.

## Key Decisions

Build 2 goes on upstream v0.17.3, rebased with picks applied by hand, not on v0.17.1 plus picks. The fork build workflow was retargeted to the v0.17.3 branch. The precompress, sharp and plugin-elicitation work are filed upstream as issues/discussions and wait for packaged-build QA before any draft PR. No PR 9830 comment has been posted. Nothing is installed.

## Decisions

- [decision] Build 2 is based on upstream v0.17.3 with picks applied by hand; rejected: v0.17.1 plus picks; because djbclark chose "Rebase onto v0.17.3, then apply picks".
- [decision] The three CI failures were fixed with commits on the build branch; rejected: dropping the PR 9830 or sticky-header picks; because the picks are wanted and the failures were small test and key problems.
- [decision] PR 9830 ships in the personal build; rejected: holding it for upstream review; because the adversary verdict is APPROVE with no blocking finding.
- [decision] The 3 Windows terminal test failures are treated as a flake and not re-run; rejected: re-running that job; because the first run passed and the terminal code is untouched, and a macOS build does not depend on it.
- [decision] The wrangler bump stays parked; rejected: opening a PR; because its fork CI run failed.
- [ruling] "You should handoff to an Antigravirty Neon High agent." (djbclark, 2026-11-22)
- [ruling] "Rebase onto v0.17.3, then apply picks" chosen from the build 2 base question (djbclark, 2026-11-22)
- [ruling] "Run CI on the branch" and "Commit, push and run the build" chosen from the CI and build questions (djbclark, 2026-11-22)
- decided_in [[HANDOFF_standalone-b2f1_fork-build-2-v0173_2026-11-22_aee9]]

## Relations

- continues [[HANDOFF_standalone-b2f1_paseo-install-android-warpbuild_2026-11-21_403c]]

## Evidence & Data

- Memory: `~/.claude/projects/-Users-djbclark-src-paseo/memory/project_fork2_queue_20261122.md` holds the BUILT block with shas and digest; `reference_cutover_lessons_20261122.md` holds five lessons for the cutover script; `project_v0171_build_and_vendor_swap_20261122.md` describes build 1.
- Reports under `~/.local/state/agent-reports/afa869f0-0e51-4ab7-937e-ccdc72f2c3af/`: `build2-v0173-rebase-report.md`, `pr9830-adversary-report.md`, `ci-45066407202-fixes-report.md`, `webui-cutoff-diagnosis-report.md`, `app-dist-precompress-report.md`, `sharp-global-libvips-report.md`, `gemini-picklist-research-report.md`, plugin-elicitation reports (3).
- Upstream items: issues getpaseo/paseo#10536 (precompress), #10539 (sharp, comment added), comment on #9355, Discussion #10542 (shift-drag), Discussion 7470 and PR 8236 (ACP elicitation), draft PR #10534 (agent-ID search).
- Plugin elicitation: `feat/plugin-acp-elicitation-forms` @ faa107e0c, local only in `/Users/djbclark/src/paseo-plugin-elicitation-wt`.
- Peer: registry lead `41840155-eb9e-4a7d-b449-a3b439d0daee` (djbclark-ade, owns `config/fork-picks.toml` and `bin/ade-fork-picks`). I told it not to mark entries landed yet and not to build its two PR 942 LOWs.

## Operator Feedback

- He is walked one decision at a time through `/steps` (AskUserQuestion, one per call, recommended option first, labels numbered). He answers fast; keep each question to the decision.
- The shift-drag dev app (daemon 127.0.0.1:18810, Metro 18811) must stay UP until he says otherwise; he works there.
- Standing rules: never install anything or launch/open any Paseo app or restart the daemon on 6767 without his own approval; show exact text before any public post or billable workflow; nothing goes upstream without his approval of the exact text; shift-drag PR needs his separate OK and recording.

## Where We're Going

1. THE NEXT ACTION: tell djbclark build 2 is ready and ask, via `/steps`, whether to start the cutover (install). Do not install without his explicit approval. The install uses the Touch ID cutover flow: rev 15 drafts plus the five driver lessons in `reference_cutover_lessons_20261122.md`; read those first. Before it, add the I1 line to the cutover RUNBOOK: if the daemon fails at boot in OrderingService.initialize, move `~/.paseo/projects/ui-order.json` aside. Keep rollback copies 7+ days.
2. After install: hands-on QA with him (About shows "djbclark fork 2", agent-ID search, shift-drag, ordering across clients, Pi permission and question fixes, live `agy acp` Antigravity question-card trial, web UI load speed and the m11 tablet at :3333 cut-off, which is Chrome zoom 1.1845 and not a Paseo bug).
3. Then mark registry entries `landed:build-2` with `ade-fork-picks mark` (workspace-id-search, desktop-app-dist-precompress, worktree-setup-sharp-global-libvips, about-fork-marker, shift-drag-copy, sync-sidebar-order, pi-permission-selected-action, pi-ask-user-question-scope, plugin-acp-elicitation-forms) and tell lead 41840155.
4. Upstream follow-ups, each needing his OK on the exact text: draft PRs for precompress (#10536, needs QA from the packaged build), sharp fix (#10539), plugin elicitation (Discussion 7470 / issue 9355), shift-drag (needs his recording); a PR 9830 comment that `setTargets` should skip archived or unknown workspaces (plus I1 to I3); optional Claude Code Code Mode Discussion (awaiting his yes).
5. Android: tag `fork-android-v0.17.1-r1` awaits his OK; frdminc/paseo#4 (Android fork release pipeline) was queued for his review.
6. Older open items: Antigravity blank-screen-on-handoff re-test after the build is deployed; open PR 8542 branch rename for `installDirs`; rev 15 lows; fork-build workflow retarget for the next base.

## Detached jobs

none. (The `bigteam` job records are gone with the shim; no run_in_background task of mine outlives this session.) The shift-drag test instance and daemon are not mine to stop.

## Quick Start

```bash
git -C /Users/djbclark/src/paseo-desktop-v0173-fork2-wt log --oneline -6
gh run view 45089265694 -R frdminc/paseo --json status,conclusion
shasum -a 256 ~/.local/state/agent-reports/afa869f0-0e51-4ab7-937e-ccdc72f2c3af/build2-artifact/Paseo-main-arm64-2c5cb9d7fbe13bc9c36515d706e45cae48495d57-attempt-1/Paseo-main-arm64.zip
paseo ls -g --json
```

Rules that bite: `git -C DIR`, never cd+git compounds; commits through `git-commit-own`; builds and tests through `~/ops/site-private-djbclark/bin/bgrun` after `load-watch ci decide` (the approval dialog may time out, then use CI); `gsed` not `sed`; no `| tail && ...` chains; questions via `/steps`; `hermes-ping "<repo>: <line>"` when something needs him.
