# Assumed devices and health signals

<!-- Generated from src/domain/deviceAssumptions.ts. Do not edit by hand; regenerate with: npm run docs:assumptions -->

Simulated data only. Not medical advice. Not diagnostic.

Horizon analyzes readings; it does not measure anything. Real hardware cannot be tested in this research demo, so every signal is **assumed** to arrive from an imagined crew wearable plus a personal dosimeter.

## Assumed signals

| Signal | Unit | Accepted range | Assumed device | How often | Note |
| --- | --- | --- | --- | --- | --- |
| Heart rate | bpm | 30–220 | Wearable or chest strap | Continuous (about once a second over Bluetooth) | Resting and exercise readings are kept apart; exercise heart rate never raises a recovery alert. |
| Heart-rate variability (HRV) | ms | 1–300 | Wearable, or estimated from beat-to-beat intervals | About every 10 seconds when intervals are sent | Estimated as RMSSD from beat-to-beat intervals. A rough, short-term estimate. |
| Blood oxygen (SpO₂) | % | 70–100 | Wearable pulse oximeter | Periodic | Brief dips are common sensor noise and are not treated as findings. |
| Skin temperature | °C | 30–42 | Wearable skin sensor | Periodic | Skin temperature, not core body temperature. It normally sits several degrees below core. |
| Sleep | h | 0–24 | Wearable sleep tracking | Once per day (last night's total) | A daily total, so it only changes when a new night is synced. |
| Radiation dose | mSv/day | 0–50 | Personal dosimeter | Periodic | Consumer wearables do not measure radiation, so a separate dosimeter is assumed. |

Values outside the accepted range are treated as sensor errors and rejected with a reason.

## Data flow

Device or file, then a source adapter, then the sanitizer (shape, units, ranges, timestamps, duplicates, artefact flags), then a quality score (good, limited, poor), then the alert engine on completed days, then Home and Trends. Poor-quality data never produces an alert.

## What each source can supply

- **Simulated wearable (demo):** All six signals.
- **File import (CSV or JSON):** Any of the six signals present in the file.
- **Bluetooth heart-rate device:** Heart rate and, if the device sends beat-to-beat intervals, HRV. Other signals stay simulated.
- **Webhook (local demo receiver):** Any of the six signals the sending service includes; the rest stay simulated. Readings are held in dev-server memory for up to 48 hours and are display-only for alerts until a full day is collected.

## Entered by the user, not from a device

- Baseline check-in: resting heart rate, sleep hours, mood, and stress.
- Wellbeing check-in: mood, stress, sleep quality, and an optional note.
- Voice check-in (optional): spoken answers to the same wellbeing questions, turned into the 1 to 5 values you review before saving.
- Movement check: repetitions, timing, balance, approximate joint-angle ranges, and pauses from the camera (body points are tracked on the device and never stored), plus how it felt.

## Not assumed

- Blood pressure, glucose, or ECG.
- Bone density, vision, or blood-clot detection.
- Any diagnosis, disease probability, or medical clearance.
