import type { MetricName } from '../types/horizon';
import type { BodyDeviceId } from './bodyDevices';

/**
 * Clickable body parts in two layers. Signals parts are tied to the wearable that measures them (on the
 * Active Home they turn green only when that device is paired) and show only that device's readings.
 * Movement parts link to saved Movement practice.
 */
export const bodyRegions = [
  { id: 'heart', layer: 'signals', label: 'Heart', mesh: 'heart', offset: [0, 0, 0.10], face: 'front', device: 'astroskin', metrics: ['resting_hr', 'hrv'], note: 'Heart rate and HRV from the Astroskin shirt. These readings do not assess overall heart health.' },
  { id: 'brain', layer: 'signals', label: 'Brain', mesh: 'brain', offset: [0, 0.005, 0.10], face: 'both', device: 'actiwatch', metrics: ['sleep_hours'], note: 'Sleep hours from the Actiwatch. OrbitWell does not measure brain activity or cognitive function.' },
  { id: 'lungs', layer: 'signals', label: 'Lungs', mesh: 'lung_l', offset: [0.04, -0.015, 0.10], face: 'front', device: 'astroskin', metrics: ['spo2'], note: 'Blood oxygen (SpO₂) from the Astroskin headband. SpO₂ is not a direct measurement of lung function.' },
  { id: 'chest', layer: 'signals', label: 'Chest', mesh: 'chest_muscles_r', offset: [-0.025, 0.085, 0.08], face: 'front', device: 'dosimeter', metrics: ['radiation_dose'], note: 'Radiation dose from the personal dosimeter worn on the chest. Dose is context only, not a safety clearance.' },
  { id: 'legs', layer: 'signals', label: 'Legs', mesh: 'quadriceps_l', offset: [0, 0, 0.08], face: 'front', device: 'motion', metrics: [], motion: 'legs', note: 'Leg movement from the thigh motion sensors. This is movement context, not a muscle-strength or injury assessment.' },
  { id: 'back', layer: 'signals', label: 'Back', mesh: 'back_muscles_r', offset: [-0.05, 0.085, -0.07], face: 'back', device: 'motion', metrics: [], motion: 'back', note: 'Back posture and bending from the lower-back motion sensor. It does not assess spinal health or back pain.' },
  { id: 'skin', layer: 'signals', label: 'Skin', mesh: 'forearm_l', offset: [0, 0, 0.05], face: 'both', device: 'astroskin', metrics: ['core_temperature'], note: 'Skin temperature from the Astroskin shirt. Skin temperature is not core body temperature.' },
  { id: 'shoulder', layer: 'movement', label: 'Shoulder', mesh: 'shoulder_muscles_l', offset: [0.02, 0.04, 0.06], face: 'front', metrics: [], note: 'Shoulder-mobility practice context only. It does not assess injury, strength, or readiness.' },
  { id: 'arm', layer: 'movement', label: 'Arm', mesh: 'upper_arm_muscles_l', offset: [0.02, 0.02, 0.06], face: 'front', metrics: [], note: 'Reach-and-return practice context only. It does not assess injury, strength, or readiness.' },
  { id: 'hip', layer: 'movement', label: 'Hip', mesh: 'pelvis', offset: [0.08, 0, 0.06], face: 'front', metrics: [], note: 'Sit-to-stand practice context only. It does not assess the hip joint or diagnose a condition.' },
  { id: 'knee', layer: 'movement', label: 'Knee', mesh: 'patella_l', offset: [0, 0.02, 0.06], face: 'front', metrics: [], note: 'Sit-to-stand practice context only. It does not assess knee health, strength, or injury.' },
  { id: 'ankle', layer: 'movement', label: 'Ankle', mesh: 'foot_l', offset: [0, 0.10, 0.02], face: 'front', metrics: [], note: 'Single-leg balance practice context only. It does not assess fall risk, stability, or injury.' },
] as const satisfies readonly { id: string; layer: 'signals' | 'movement'; label: string; mesh: string; offset: readonly number[]; face: 'front' | 'back' | 'both'; device?: BodyDeviceId; metrics: readonly MetricName[]; motion?: 'legs' | 'back'; note: string }[];
export type BodyRegion = typeof bodyRegions[number];
export type BodyRegionId = BodyRegion['id'];
export interface BodyHotspot { id: BodyRegionId; x: number; y: number; visible: boolean }

export function regionFacesCamera(face: 'front' | 'back' | 'both', degrees: number): boolean {
  const front = Math.cos(degrees * Math.PI / 180);
  return face === 'both' || (face === 'front' ? front > 0.12 : front < -0.12);
}

/** Body parts that can be selected with the given paired devices. */
export function enabledRegions(paired: ReadonlySet<BodyDeviceId>): BodyRegion[] {
  return bodyRegions.filter((region) => 'device' in region && paired.has(region.device));
}
