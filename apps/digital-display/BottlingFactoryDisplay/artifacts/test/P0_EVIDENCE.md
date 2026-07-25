# Digital Display P0 Evidence

Date: 2026-07-25

## P0 Audit

- Completed: App starts from `pages/Index` into the read-only overview; no login, admin, control, or parameter-write entry is exposed in the digital display.
- Completed: Overview keeps the nine-stage continuous production flow on top, with production, quality, device, exception, logistics, warehouse, and trace cards below.
- Completed: Stage detail keeps visualization first, then device list, product/material list, quality gates, alarms, and upstream/downstream impact.
- Completed: 2D and 3D are both loaded through ArkWeb `Web` from local HAP rawfile `factory3d/index.html`; no CDN or online page is used.
- Completed: 2D/3D share the same payload fields, including `stateVersion`, speed, progress, device/product state, pause state, status colors, and local demo/backend source.
- Completed: Device and product selection flows are wired through `factory://device/*` and `factory://product/*` intercepts.
- Completed: Fallback data is explicitly marked `LOCAL DEMO`; backend fetch errors are not shown as success.
- Completed: Empty arrays, missing runtime fields, and unknown stage routes are guarded with fallback values.
- Evidence insufficient: Final HarmonyOS emulator install/run verification is blocked because `MatePad Pro 13` repeatedly fails snapshot boot and never appears in `hdc list targets`.

## Commands And Results

- `devecocli --version`: `1.2.0-stable`
- DevEco build: `BUILD SUCCESSFUL`; HAP generated at `D:\HarmonyOS-Dev\Build\BottlingDisplayP0\entry\build\default\outputs\default\entry-default-unsigned.hap`
- Project validator: `tools\validate-project.ps1` passed all checks.
- `git diff --check`: passed.
- Playwright rawfile test: 3D probe `ready=true`, `mode=THREE`, `stateVersion=102`, `rendererInfo.render.calls=60`; 2D probe `ready=true`, `mode=PLANAR`, `stateVersion=102`, `rendererInfo.render.calls=52`.
- Playwright console: only Three.js deprecated build warning; no application JavaScript error in the rawfile test.
- Emulator status: `hdc list targets` remained `[Empty]`; `devecocli emulator list` showed `MatePad Pro 13 stopped`.
- Emulator logs: `D:\HarmonyOS-Dev\Emulator\MatePad Pro 13\Log\crash_server.log` contains `Emulator snapshot boot timeout, try to restart`.

## Local Evidence Files

- `artifacts/test/three-standalone-3d.png`
- `artifacts/test/three-standalone-planar.png`
- `artifacts/test/playwright-threejs-20260725-rerun.log`
- `artifacts/test/hdc-targets-20260725.log`
- `artifacts/test/emulator-list-20260725.log`
- `D:\HarmonyOS-Dev\Logs\bottling-display-final-build-cmd-20260725.log`
- `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`
