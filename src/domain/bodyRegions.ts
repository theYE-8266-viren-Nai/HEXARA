import type { MetricName } from '../types/horizon';

export const bodyRegions = [
  { id: 'heart', layer: 'signals', label: 'Heart', mesh: 'heart', offset: [0, 0, 0.10], face: 'front', metrics: ['resting_hr', 'hrv'], note: 'Heart rate and HRV from the current source. These readings do not assess overall heart health.' },
  { id: 'brain', layer: 'signals', label: 'Brain', mesh: 'brain', offset: [0, 0.005, 0.10], face: 'both', metrics: ['sleep_hours'], note: 'Sleep context only. OrbitWell does not measure brain activity or cognitive function.' },
  { id: 'lungs', layer: 'signals', label: 'Lungs', mesh: 'lung_l', offset: [0.04, -0.015, 0.10], face: 'front', metrics: ['spo2'], note: 'Blood oxygen from the current source. SpO₂ is not a direct measurement of lung function.' },
  { id: 'chest', layer: 'signals', label: 'Chest', mesh: 'chest_muscles_r', offset: [-0.025, 0.085, 0.08], face: 'front', metrics: ['resting_hr', 'spo2'], note: 'Related heart-rate and blood-oxygen readings. There is no direct chest measurement or chest-pain assessment.' },
  { id: 'leg-muscle', layer: 'signals', label: 'Leg muscle', mesh: 'quadriceps_l', offset: [0, 0, 0.08], face: 'front', metrics: [], note: 'No direct leg-muscle signal is available. The optional Movement check provides an approximate movement summary, not muscle strength or injury assessment.' },
  { id: 'spine', layer: 'signals', label: 'Spine', mesh: 'spine_lumbar', offset: [0, 0, -0.09], face: 'back', metrics: [], note: 'No spine or bone-density measurement is available. Movement summaries cannot assess spinal health.' },
  { id: 'back-muscle', layer: 'signals', label: 'Back muscle', mesh: 'back_muscles_r', offset: [-0.05, 0.085, -0.07], face: 'back', metrics: [], note: 'No direct back-muscle signal is available. Use Movement for an optional practice summary; it does not evaluate back pain or injury.' },
  { id: 'skin', layer: 'signals', label: 'Skin', mesh: 'forearm_l', offset: [0, 0, 0.05], face: 'both', metrics: ['core_temperature', 'radiation_dose'], note: 'Skin-temperature and whole-body dosimeter context. Radiation dose is not a measurement of skin damage.' },
  { id: 'shoulder', layer: 'movement', label: 'Shoulder', mesh: 'shoulder_muscles_l', offset: [0.02, 0.04, 0.06], face: 'front', metrics: [], note: 'Shoulder-mobility practice context only. It does not assess injury, strength, or readiness.' },
  { id: 'arm', layer: 'movement', label: 'Arm', mesh: 'upper_arm_muscles_l', offset: [0.02, 0.02, 0.06], face: 'front', metrics: [], note: 'Reach-and-return practice context only. It does not assess injury, strength, or readiness.' },
  { id: 'hip', layer: 'movement', label: 'Hip', mesh: 'pelvis', offset: [0.08, 0, 0.06], face: 'front', metrics: [], note: 'Sit-to-stand practice context only. It does not assess the hip joint or diagnose a condition.' },
  { id: 'knee', layer: 'movement', label: 'Knee', mesh: 'patella_l', offset: [0, 0.02, 0.06], face: 'front', metrics: [], note: 'Sit-to-stand practice context only. It does not assess knee health, strength, or injury.' },
  { id: 'ankle', layer: 'movement', label: 'Ankle', mesh: 'foot_l', offset: [0, 0.10, 0.02], face: 'front', metrics: [], note: 'Single-leg balance practice context only. It does not assess fall risk, stability, or injury.' },
] as const satisfies readonly { id: string; layer: 'signals' | 'movement'; label: string; mesh: string; offset: readonly number[]; face: 'front' | 'back' | 'both'; metrics: readonly MetricName[]; note: string }[];
export type BodyRegionId = typeof bodyRegions[number]['id'];
export interface BodyHotspot { id: BodyRegionId; x: number; y: number; visible: boolean }

export function regionFacesCamera(face: 'front' | 'back' | 'both', degrees: number): boolean {
  const front = Math.cos(degrees * Math.PI / 180);
  return face === 'both' || (face === 'front' ? front > 0.12 : front < -0.12);
}
