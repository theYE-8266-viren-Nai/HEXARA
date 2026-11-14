import type { MetricName } from '../types/horizon';
import type { BodyDeviceId } from './bodyDevices';

/**
 * Clickable body parts. A part becomes selectable only when its device is paired, and shows only the
 * readings that device provides for that part.
 */
export const bodyRegions = [
  { id: 'heart', label: 'Heart', mesh: 'heart', offset: [0, 0, 0.10], face: 'front', device: 'astroskin', metrics: ['resting_hr', 'hrv'], note: 'Heart rate and HRV from the Astroskin shirt. These readings do not assess overall heart health.' },
  { id: 'brain', label: 'Brain', mesh: 'brain', offset: [0, 0.005, 0.10], face: 'both', device: 'actiwatch', metrics: ['sleep_hours'], note: 'Sleep hours from the Actiwatch. OrbitWell does not measure brain activity or cognitive function.' },
  { id: 'lungs', label: 'Lungs', mesh: 'lung_l', offset: [0.04, -0.015, 0.10], face: 'front', device: 'astroskin', metrics: ['spo2'], note: 'Blood oxygen (SpO₂) from the Astroskin headband. SpO₂ is not a direct measurement of lung function.' },
  { id: 'chest', label: 'Chest', mesh: 'chest_muscles_r', offset: [-0.025, 0.085, 0.08], face: 'front', device: 'dosimeter', metrics: ['radiation_dose'], note: 'Radiation dose from the personal dosimeter worn on the chest. Dose is context only, not a safety clearance.' },
  { id: 'legs', label: 'Legs', mesh: 'quadriceps_l', offset: [0, 0, 0.08], face: 'front', device: 'motion', metrics: [], motion: 'legs', note: 'Leg movement from the thigh motion sensors. This is movement context, not a muscle-strength or injury assessment.' },
  { id: 'back', label: 'Back', mesh: 'back_muscles_r', offset: [-0.05, 0.085, -0.07], face: 'back', device: 'motion', metrics: [], motion: 'back', note: 'Back posture and bending from the lower-back motion sensor. It does not assess spinal health or back pain.' },
  { id: 'skin', label: 'Skin', mesh: 'forearm_l', offset: [0, 0, 0.05], face: 'both', device: 'astroskin', metrics: ['core_temperature'], note: 'Skin temperature from the Astroskin shirt. Skin temperature is not core body temperature.' },
] as const satisfies readonly { id: string; label: string; mesh: string; offset: readonly number[]; face: 'front' | 'back' | 'both'; device: BodyDeviceId; metrics: readonly MetricName[]; motion?: 'legs' | 'back'; note: string }[];
export type BodyRegion = typeof bodyRegions[number];
export type BodyRegionId = BodyRegion['id'];
export interface BodyHotspot { id: BodyRegionId; x: number; y: number; visible: boolean }

export function regionFacesCamera(face: 'front' | 'back' | 'both', degrees: number): boolean {
  const front = Math.cos(degrees * Math.PI / 180);
  return face === 'both' || (face === 'front' ? front > 0.12 : front < -0.12);
}

/** Body parts that can be selected with the given paired devices. */
export function enabledRegions(paired: ReadonlySet<BodyDeviceId>): BodyRegion[] {
  return bodyRegions.filter((region) => paired.has(region.device));
}
