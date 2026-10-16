# StarOptimizer 2.0 by Orvyn — development notes

This branch is a **development preview**, not a tested Windows 2.0 release. Its package version is `2.0.0-beta.1`; no 2.0 release has been published. See [the local validation report](VALIDATION_2026_10_16.md) for actual results and remaining blockers.

## Goals and policies

- **Inteligente** (default): show only measured problems and unavailable readings; no generic optimization recommendations for enabled animations, startup inventory, or the selected power plan.
- **Gaming**: additionally offer an existing Windows High performance energy plan, only when on external power and available. Never change Windows appearance automatically.
- **Extremo**: Gaming plus explicit, reversible visual effects options. Optional changes are labelled as preferences rather than diagnosed defects.
- The scan itself never changes Windows. All supported actions continue through preview, user confirmation, persistent journal, post-write verification and recovery.

## Diagnostics and evidence

- Scans read OS CPU samples, available memory, local disks, installed graphics adapter, processes, startup inventory, physical disk reports and power/visual settings.
- The recommendations view displays measured CPU/RAM values, GPU and unit inventory where available; partial scans say what could not be retrieved.
- CPU >80% across the current reading, memory utilization >85%, physical disk warnings, and low disk space are flagged as review candidates, not definitive causes.
- A low-disk alert requires **both** <15% free and <32 GiB free, to avoid alarming users who have hundreds of GB remaining on large disks.
- When memory pressure is detected, measured resident memory use of a process group may be shown as evidence, not as an instruction to terminate it.
- Startup entries are not inherently enabled or harmful. Users can inspect them separately.
- These heuristics cannot prove a performance gain, thermal condition, drive reliability, nor an actual gaming bottleneck.

## Test coverage and release gates

- Pure priority-engine test suite: normal systems, CPU/RAM/disk pressure, hardware warnings, malformed/missing values, distinct machine states, optional gaming/extreme rules, large-drive free-space case, and process evidence.
- Browser-based tests under `test/scan-flow.cjs` and `test/live-recommendations.cjs` require Electron and a GUI-capable Windows environment.
- Unit test CI workflow exists under `.github/workflows/orvyn-2-checks.yml`; inspect workflow results rather than assuming success.
- Before merging to `main`: run `npm ci && npm test`, the Electron tests, review power-plan restoration on Windows 10/11, check the layout at different DPI scales and measure CPU/RAM consumption.
- Do not ship a 2.0 installer until the test gates pass, changelog/version metadata are updated and rollback behaviour is exercised on Windows.

## Out of scope for this phase

No registry cleaning, memory purge, driver replacement, Defender disabling, arbitrary PowerShell from the UI, deletion of user files, unsupported automatic overclocking, or "guaranteed FPS" claims.
