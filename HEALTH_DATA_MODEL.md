# Health data model and calculation engine

The web UI and the future iOS HealthKit bridge share one canonical JSON snapshot.

## Flow

`HealthKit native bridge -> canonical snapshot -> health-engine.js -> dashboard model -> existing UI`

The native layer must only collect and normalize raw/near-raw health data. Recovery, stress, body energy, sleep score and training-load calculations remain in JavaScript so the PWA and iOS wrapper use the same formulas.

## Canonical snapshot

Defined in `js/health-model.js`.

Main groups:

- `vitals`: HRV, HRV baseline, resting HR, resting HR baseline, current HR, respiratory rate, SpO2, VO2 Max, weight, BMI, body fat and lean mass.
- `sleep`: start/end, total/in-bed/awake/core/deep/REM minutes, efficiency, consistency and target duration.
- `activity`: steps, active/basal energy, exercise minutes, stand hours, walking/running distance and flights climbed.
- `training`: daily load, load history, recommended load range, aerobic/anaerobic focus and HR recovery.
- `trends`: 7+ day arrays used for charts and baselines.
- `workouts`: workout-level duration, distance, calories, HR, cadence, pace, HR zones and splits.

`demoHealthSnapshot` mirrors the current Apple Watch indoor-running example and provides deterministic development data until the native bridge is connected.

## Calculation engine

Defined in `js/health-engine.js`.

Current first-pass formulas:

- Sleep score: duration, efficiency, deep/REM balance and consistency.
- Recovery: HRV vs baseline, resting HR vs baseline, sleep score and current training load.
- Stress proxy: HRV deviation, resting-HR deviation, sleep deficit and training load.
- Body energy: overnight recovery charge minus daytime activity/training drain.
- Training: daily load plus EWMA-derived ATL/CTL/TSB and a recommended target range.

These formulas are intentionally version-1 heuristics. They are isolated so calibration can be changed without rewriting the UI or native HealthKit collector.

## Data-source integration

`js/data-source.js` now:

1. stores the canonical snapshot as `healthRaw`,
2. migrates old localStorage data by inserting the demo snapshot when no raw model exists,
3. runs `deriveDashboardFromHealth()` before rendering,
4. keeps nutrition and strength data separate,
5. exposes `getHealthSnapshot()` and `applyHealthSnapshot()` for the future Capacitor plugin.

## Native bridge contract

The future Capacitor HealthKit plugin should return one object compatible with `normalizeHealthSnapshot()`.

Example call shape:

```js
const result = await HealthKitBridge.readSnapshot({
  date: '2026-09-07',
  includeWorkouts: true,
  historyDays: 56
});

data = applyHealthSnapshot(data, result.snapshot);
```

Do not calculate recovery/stress/energy in Swift. The Swift layer should query HealthKit and normalize units only.

## Validation

Run:

```bash
npm test
```

The iOS GitHub Actions workflow runs the health-engine smoke test before building the unsigned IPA.
