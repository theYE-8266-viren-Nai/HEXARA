import { describe, it, expect } from 'vitest';
import { bodyRegions, enabledRegions, regionFacesCamera } from './bodyRegions';
describe('body-region signal mapping', () => {
  it('exposes the seven body parts, each tied to the device that measures it', () => {
    expect(bodyRegions.filter(r => r.layer === 'signals').map(r => r.label)).toEqual(['Heart','Brain','Lungs','Chest','Legs','Back','Skin']);
    expect(bodyRegions.filter(r => r.layer === 'movement').map(r => r.label)).toEqual(['Shoulder','Arm','Spine','Hip','Knee','Legs','Ankle']);
    const byId = Object.fromEntries(bodyRegions.map(r => [r.id, r])) as Record<string, (typeof bodyRegions)[number] & { device?: string }>;
    expect([byId.heart.device, byId.lungs.device, byId.skin.device]).toEqual(['astroskin','astroskin','astroskin']);
    expect(byId.brain.device).toBe('actiwatch');
    expect(byId.chest.device).toBe('dosimeter');
    expect([byId.legs.device, byId.back.device]).toEqual(['motion','motion']);
    expect(byId.heart.metrics).toEqual(['resting_hr','hrv']);
    expect(byId.lungs.metrics).toEqual(['spo2']);
    expect(byId.skin.metrics).toEqual(['core_temperature']);
    expect(byId.brain.metrics).toEqual(['sleep_hours']);
    expect(byId.chest.metrics).toEqual(['radiation_dose']);
    expect(byId.brain.note).toContain('does not measure brain activity');
  });

  it('enables only the parts of paired devices', () => {
    expect(enabledRegions(new Set())).toEqual([]);
    expect(enabledRegions(new Set(['astroskin'])).map(r => r.id)).toEqual(['heart','lungs','skin']);
    expect(enabledRegions(new Set(['motion'])).map(r => r.id)).toEqual(['legs','back']);
  });

  it('switches front and back visibility for either rotation direction', () => {
    for (const degrees of [-180,180]) {
      expect(regionFacesCamera('back',degrees)).toBe(true);
      expect(regionFacesCamera('front',degrees)).toBe(false);
    }
    expect(regionFacesCamera('front',0)).toBe(true);
    expect(regionFacesCamera('back',0)).toBe(false);
    for (const degrees of [-90,90]) {
      expect(regionFacesCamera('both',degrees)).toBe(true);
      expect(regionFacesCamera('front',degrees)).toBe(false);
      expect(regionFacesCamera('back',degrees)).toBe(false);
    }
  });
});
