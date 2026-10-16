# Codex handoff — Orvyn / StarOptimizer 2.0 / Nivo
**Prepared:** 2026-10-16. **Purpose:** enable a **new Codex CLI session on the user's laptop** to continue earlier ChatGPT work. This document is a concise project transfer, **not a complete transcript or an already-running Codex session**.

## Brand and products
- **Orvyn**, pronounced roughly "Or-vin": software brand / design system; final branding and domain/trademark checks are still open.
- **StarOptimizer 2.0**: first product, an independently installable Windows desktop diagnostics and reversible optimization tool. Keep the existing app and improve it rather than starting over.
- **Nivo**: **separate future** Windows Dynamic Island app, with smooth unobtrusive animations, notifications/media, optional discreet mascot and possible future coding-agent integrations. Do not merge Nivo's runtime/features into StarOptimizer.
- **Nova**: StarOptimizer's expressive lightweight animated mascot. Do **not** rename her Nivo; do not simulate a fake AI.
- If the user verbally says "Oviron", "Orbit", "Startup Optimize" etc., confirm whether they mean Orvyn, Nivo or StarOptimizer rather than creating a third project.

## Exact working location
- Repository: https://github.com/SnoW-099/StarOptimizer
- **Development branch:** `feature/orvyn-staroptimizer-2`
- **Draft pull request:** https://github.com/SnoW-099/StarOptimizer/pull/1
- Default `main` must stay untouched.
- Current branch version metadata: **`2.0.0-beta.1`**, **not released**. Existing releases in `main` are separate.
- Repository is currently *public*; the unmerged beta branch is publicly browsable. "Private beta" in prior chat referred to avoiding a public release, **not** a private repository or already hosted Windows executable.
- JavaScript/Electron, no native Rust migration in progress. `package.json` includes Electron, electron-builder and Playwright.
- No verified signed Windows EXE, no stable installer deployment, no verified public 2.0 release.
- License in `package.json` is `UNLICENSED`: settle deliberately if making the suite open source.

## User's central complaint and the implemented fix
Earlier scans on multiple PCs always recommended identical generic tweaks (disable Windows animations / inspect startup). The scan **does query real Windows information** (`src/system.cjs`), but the recommendation layer `src/priorities.js` used to flag mere *preferences* and inventory as issues. That was misleading.
- Fixed: **Inteligente** reports relevant measured resource pressure, low storage, disk health warnings and missing readings; does **not** suggest disabling animations, reviewing any startup entry just because it exists, or changing a deliberately selected energy plan.
- **Gaming**: explicitly opt-in, keeps Windows look and offers a real installed High Performance power plan *when on AC*; warns about consumption/heat and makes no FPS guarantees.
- **Extremo**: additional optional reversible Windows visual animation changes, never a claim that an enabled animation is an illness.
- Changes require the existing preview, explicit confirmation, saved journal, verification and restore. No automatic speculative mutation on scan.
- Recommendations view shows real snapshot facts; low-storage alert now requires <15% remaining **and** <32 GiB available; when significant RAM pressure, process data may supply evidence.
- Profile chooser is implemented in the "Recomendados" view. Older profiles still exist in "Optimizar" and need UX consistency review.
- Intelligent mode must be able to output: "No se han detectado problemas que requieran cambios." Do not equate "no findings" with comprehensive hardware health certification.

## Architecture and relevant files
- `src/main.cjs`: Electron window, hardened IPC/origin, OS scan, execution, measurement, export.
- `src/system.cjs`: Windows OS readings via Node, PowerShell/CIM and `powercfg`; visual API, energy adapter and telemetry.
- `src/priorities.js`: pure priority/mode decision engine, tests `test/priorities.test.cjs`.
- `src/optimizer.cjs`: tokenized preview/apply/undo, durable journal & failure recovery; tests `test/optimizer.test.cjs`.
- `src/measurements.cjs`: before/after CPU/RAM history; tests `test/measurements.test.cjs`.
- `src/renderer.js`, `src/index.html`, `src/style.css`, `src/apple.css`, `src/scan.css`: interface. Responsive changes were made, but must be visually tested at Windows DPI settings.
- `src/nova.js`, `src/nova.css`: Nova's eyes, float, focus/visibility and recent real-state reactions (`working`/`react`); tests `test/nova.cjs`.
- `src/scan-experience.js`: scan stages and Nova presence; language intentionally avoids pretending the mascot has AI.
- `src/tuneup.js`: guided measurements, disks and Windows settings links.
- `scripts/verify-windows.cjs`: newly added **read-only smoke test** for native OS scan; `npm run test:windows:smoke`.
- `.github/workflows/orvyn-2-checks.yml`: unit tests on Windows/Linux, then Windows-only scan/integration/portable build.
- `docs/ORVYN_2_0.md`: additional safety notes / release gates. Read but check against current code, since some historical text may be stale.

## Genuine verification state, not inflated
- Earlier tests: **39/39 unit cases passed in a manually constructed isolated JS harness** using mocked filesystem/Windows adapters. This is **not** `npm test` executed natively, nor an Electron E2E pass.
- Static JS syntax/JSON consistency checked; does **not** prove UI quality, ABI compatibility or performance.
- GitHub Actions consistently failed with *zero steps* and *no assigned runner* on both Windows and Ubuntu; jobs finished in ~3 s. This persisted after retry and after refactoring workflow to make unit tests dependency-free. **Not evidence that npm tests fail.** Inspect run details, account Action restrictions, budget/payment status and runner eligibility. Example run: https://github.com/SnoW-099/StarOptimizer/actions/runs/38915744774. The exact GitHub-side reason is **not confirmed**.
- No Windows-real acceptance run has been reported; developer cannot currently certify compatibility, power restoration, render quality or performance.
- The prior chat delivered a ZIP "beta kit" for local testing, **not a precompiled EXE**. Treat any such kit as unverified; use the checked-out repository as source of truth.
- Current release status: **Draft PR, do not merge, tag, release, deploy or publicly announce** until user asks and verification passes.

## Immediate task for Codex on the laptop
1. Ensure user is on `feature/orvyn-staroptimizer-2`, inspect `git status -sb`, `git log -5 --oneline` and read `AGENTS.md`, this handoff and docs.
2. Install/verify Node.js 22+ and dependencies, then run `npm ci` and **`npm test`**. Record actual failures with logs; fix root causes on the branch, not by weakening tests.
3. If laptop uses Windows 10/11, run `npm run test:windows:smoke` (read-only), then Electron E2E: `npm run test:ui`, `npm run test:workflow`, `npm run test:scan`, `npm run test:live`, `npm run test:nova`, `npm run test:measure`.
4. Check `artifacts/` screenshot outputs, real 100%/125%/150%/200% DPI, accessibility, small-window responsiveness, dark/light mode, Nova reduced motion and behavior over a real scan.
5. Review power profile selection across Windows variants and battery states; **do not apply/revert real system optimizations without explicit approval and backups**.
6. Fix valid failures with narrow, tested commits. Run `npm run dist` **only when tests pass**, then inspect portable EXE startup and SmartScreen warning; never claim code signing if absent.
7. Inspect GitHub Actions failures; if jobs are denied *before runner allocation*, explain the GitHub account-side blocker and ask the user for the exact annotation rather than changing application code speculatively.
8. Continue hardening measurement and recommendation evidence; prioritize usability, safety, real benefit, event-driven low idle CPU/RAM, and no deceptive claims. Defer broad invasive "optimizations" and code bloat.
9. Before publishing, provide a full report of tested scenarios, findings, unresolved issues, measured resource use and an explicit go/no-go recommendation. **Wait for explicit release/merge authorization.**

## Laptop setup (Windows PowerShell)
```powershell
git clone https://github.com/SnoW-099/StarOptimizer.git
cd StarOptimizer
git switch feature/orvyn-staroptimizer-2
git status -sb
npm ci
npm test
codex
```
If the repository is already cloned: `cd <existing-repo-directory>`, `git status -sb`, `git fetch origin`, and `git switch feature/orvyn-staroptimizer-2` (or `git pull --ff-only` when already on the branch and no conflicting local edits).

**First instruction to Codex:** "Lee AGENTS.md y docs/CODEX_HANDOFF.md, verifica el estado de la rama, ejecuta las pruebas reales y continúa StarOptimizer 2.0. No toques main ni publiques; reporta errores y corrígelos con commits en esta rama. Cuando esté validado, proponme el inicio de Nivo como aplicación separada de Orvyn."

## Future Nivo specification (not implemented in this repository)
Windows Dynamic Island, elegant high-DPI multimonitor handling, native Win32/WinRT focus/no Alt+Tab / no intrusive overlay in fullscreen games, minimal idle resource use, notification/media support, fluid spring transitions; proposed Tauri 2 + Rust native bridge + lightweight frontend. Phase one = polished island/media/notifications, later optional agent coding integration. Make a **separate repo** if user authorizes, not within StarOptimizer.
