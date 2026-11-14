import { describe, it, expect } from 'vitest';
import { bodyRegions, regionFacesCamera } from './bodyRegions';
describe('body-region signal mapping', () => {
  it('exposes all eight requested regions and no fabricated muscle or spine signals', () => {
    expect(bodyRegions.filter(r => r.layer === 'signals').map(r => r.label)).toEqual(['Heart','Brain','Lungs','Chest','Leg muscle','Spine','Back muscle','Skin']);
    expect(bodyRegions.filter(r => r.layer === 'movement').map(r => r.label)).toEqual(['Shoulder','Arm','Hip','Knee','Ankle']);
    for (const id of ['leg-muscle','spine','back-muscle']) expect(bodyRegions.find(r => r.id === id)?.metrics).toEqual([]);
    expect(bodyRegions.find(r => r.id === 'brain')?.note).toContain('does not measure brain activity');
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
