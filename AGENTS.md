# Codex working instructions — StarOptimizer / Orvyn

Before making changes, read [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) and [docs/ORVYN_2_0.md](docs/ORVYN_2_0.md).

## Repository and safety contract

- This is **StarOptimizer 2.0 by Orvyn**, an Electron Windows optimizer. The related future product **Nivo** is a separate planned Windows Dynamic Island app, not a feature to insert into StarOptimizer.
- Work only on `feature/orvyn-staroptimizer-2` (or a new branch based on it). **Never alter, force-push, or merge into `main`**, create releases, publish installers, or deploy without explicit user approval.
- Maintain readable, minimal, well-tested changes; commit each coherent milestone to the development branch only.
- User-facing language is primarily **Spanish**. Do not claim that simulated fixtures prove Windows compatibility.
- The scan must use actual observed system values. No fake health scores, generic invented problems, artificial "AI" or fabricated performance gains.
- Modes: Inteligente = evidence-based and conservative; Gaming = prioritizes practical stability/performance while retaining appearance; Extremo = *opt-in* more aggressive but documented, reversible safe options.
- The **scan is read-only**. System mutations require explicit user confirmation, preview of exact values, durable journal, verification and rollback. Avoid disabling Defender, firewall, security services, updates, arbitrary registry "cleaning", nonconsensual file deletion, driver hacks or overclocking.
- Treat any potential power plan or visual tweak as an *option*, not a proven FPS improvement. If no relevant issues are observed, say so.
- Nova is a lightweight animated mascot, not a chatbot or actual AI; use observed operation states, respect reduced-motion and hidden-window conditions.
- Keep diagnosis, measurement, mode policy, UI and Windows adapters separated. Make no network/telemetry assumptions; respect local privacy.

## Before first commit

1. Verify branch and state with `git status -sb`, `git branch --show-current`, `git log -5 --oneline`.
2. Run `npm ci` and `npm test` on a machine with Node 22+.
3. On Windows, run `npm run test:windows:smoke`, `npm run test:ui`, `npm run test:workflow`, `npm run test:scan`, `npm run test:live`, `npm run test:nova`, `npm run test:measure` when feasible.
4. Triage any failure with its actual output. The historical GitHub Actions jobs failed *before a runner was assigned*, not due to a verified application test failure.
5. Explain findings and risk, run tests, then commit. Record remaining blockers before suggesting a public 2.0 release.

## What to do first

Read the handoff, inspect the source and PR #1, diagnose the PC-local build and any failing real Windows tests; fix evidenced issues before expanding the optimizer. Keep Nivo as a separate scoped project after StarOptimizer is validated.
