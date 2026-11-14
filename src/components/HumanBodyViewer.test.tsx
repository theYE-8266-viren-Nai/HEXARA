import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HumanBodyViewer, { clampBodyRotation } from './HumanBodyViewer';
import { bodyRegions, regionFacesCamera, type BodyHotspot } from '../domain/bodyRegions';
import { mockDashboardRepository } from '../lib/mockDashboardRepository';
import { within } from '@testing-library/react';
import type { BodyDeviceId } from '../domain/bodyDevices';
import { motionReadings } from '../domain/motionSensor';

const ALL_DEVICES = new Set<BodyDeviceId>(['astroskin', 'actiwatch', 'dosimeter', 'motion']);
const motion = motionReadings(42, 'active:test');
const metrics = () => mockDashboardRepository.getSnapshot('usual', {seed:42, replayCount:0}).metrics;

const engine = vi.hoisted(() => ({ rotate: vi.fn(), dispose: vi.fn(), fail: false }));
vi.mock('../lib/bodyScene', () => ({
  createBodyScene: (_host: HTMLElement, ready: () => void, _error: () => void, hotspots: (points: BodyHotspot[]) => void) => {
    if (engine.fail) throw new Error('No WebGL');
    queueMicrotask(ready);
    return { rotate: (degrees: number) => {
      engine.rotate(degrees);
      hotspots(bodyRegions.map((region, index) => ({ id: region.id, x: 45 + index, y: 10 + index * 8, visible: regionFacesCamera(region.face, degrees) })));
    }, dispose: engine.dispose };
  },
}));

describe('Human body viewer', () => {
  beforeEach(() => { engine.fail = false; vi.clearAllMocks(); });

  it('clamps rotation in both directions, supports keyboard and resets to front', async () => {
    const user = userEvent.setup();
    const view = render(<HumanBodyViewer />);
    const slider = await screen.findByRole('slider', { name: 'Body rotation' });
    await waitFor(() => expect(slider).toBeEnabled());
    fireEvent.change(slider, {target:{value:'180'}});
    expect(engine.rotate).toHaveBeenLastCalledWith(180);
    expect(screen.getByRole('button', {name:'Turn right'})).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('group'), {key:'ArrowRight'});
    expect(engine.rotate).toHaveBeenLastCalledWith(180);
    fireEvent.change(slider, {target:{value:'-180'}});
    expect(screen.getByRole('button', {name:'Turn left'})).toBeDisabled();
    await user.click(screen.getByRole('button', {name:'Front view'}));
    expect(slider).toHaveValue('0');
    fireEvent.keyDown(screen.getByRole('group'), {key:'ArrowLeft'});
    expect(slider).toHaveValue('-15');
    fireEvent.keyDown(screen.getByRole('group'), {key:'Home'});
    expect(slider).toHaveValue('0');
    expect(clampBodyRotation(999)).toBe(180);
    expect(clampBodyRotation(-999)).toBe(-180);
    view.unmount(); expect(engine.dispose).toHaveBeenCalledOnce();
  });

  it('supports horizontal pointer drag and stops on release', async () => {
    render(<HumanBodyViewer />);
    await waitFor(() => expect(screen.getByRole('slider')).toBeEnabled());
    const stage = screen.getByRole('group');
    stage.setPointerCapture = vi.fn();
    const pointer = (type: string, x: number) => {
      const event = new Event(type, {bubbles:true});
      for (const [key,value] of Object.entries({clientX:x,pointerId:1,isPrimary:true,button:0})) Object.defineProperty(event,key,{value});
      fireEvent(stage,event);
    };
    pointer('pointerdown',100); pointer('pointermove',200);
    expect(engine.rotate).toHaveBeenLastCalledWith(60);
    pointer('pointermove',1000);
    expect(engine.rotate).toHaveBeenLastCalledWith(180);
    pointer('pointerup',1000); pointer('pointermove',0);
    expect(screen.getByRole('slider')).toHaveValue('180');
  });

  it('reports WebGL failure honestly and allows a fresh attempt', async () => {
    engine.fail = true;
    const user = userEvent.setup(); render(<HumanBodyViewer />);
    expect(await screen.findByText('3D view unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Turn left'})).toBeDisabled();
    engine.fail = false;
    await user.click(screen.getByRole('button', {name:'Try again'}));
    await waitFor(() => expect(screen.getByRole('slider')).toBeEnabled());
    expect(screen.getByText(/not a scan of you/)).toBeInTheDocument();
  });

  it('hides readings until selection and toggles the selected region', async () => {
    const user = userEvent.setup();
    render(<HumanBodyViewer metrics={metrics()} pairedDevices={ALL_DEVICES} motion={motion} />);
    const heart = await screen.findByRole('button', {name:'Heart'});
    expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
    await user.hover(heart);
    expect(heart.querySelector('.body-hotspot-label')).toHaveTextContent('Heart');
    await user.click(heart);
    expect(screen.getByRole('complementary', {name:'Heart signals'})).toBeInTheDocument();
    expect(screen.getByRole('complementary', {name:'Heart signals'})).toHaveAttribute('data-side','right');
    expect(screen.getByText('Resting heart rate')).toBeInTheDocument();
    expect(screen.getByText('HRV')).toBeInTheDocument();
    expect(screen.queryByText('Skin temperature')).not.toBeInTheDocument();
    expect(heart).toHaveAttribute('aria-pressed','true');
    await user.click(heart);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
  });

  it('keeps the Back marker on the back and shows each part only its own readings', async () => {
    const user = userEvent.setup();
    render(<HumanBodyViewer metrics={metrics()} pairedDevices={ALL_DEVICES} motion={motion} />);
    await screen.findByRole('button', {name:'Heart'});
    expect(screen.queryByRole('button', {name:'Back'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Spine'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), {target:{value:'180'}});
    expect(screen.queryByRole('button', {name:'Heart'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name:'Back'}));
    const back = screen.getByRole('complementary', {name:'Back signals'});
    expect(back).toHaveAttribute('data-side','left');
    expect(back).toHaveTextContent('Upright posture');
    expect(back).not.toHaveTextContent('Sit-to-stand');
    await user.click(screen.getByRole('button', {name:'Back'}));
    await user.click(screen.getByRole('button', {name:'Front view'}));
    const expected: Record<string, { has: string[]; not: string[] }> = {
      Brain: { has: ['Sleep'], not: ['Resting heart rate'] },
      Lungs: { has: ['SpO₂'], not: ['HRV'] },
      Chest: { has: ['Radiation dose'], not: ['SpO₂', 'Resting heart rate'] },
      Legs: { has: ['Sit-to-stand repetitions', 'Left / right balance'], not: ['Upright posture'] },
      Skin: { has: ['Skin temperature'], not: ['Radiation dose', 'Resting heart rate'] },
    };
    for (const [label, readings] of Object.entries(expected)) {
      await user.click(screen.getByRole('button', {name:label}));
      const panel = screen.getByRole('complementary', {name:`${label} signals`});
      expect(panel).toHaveAttribute('data-side', ['Brain','Chest'].includes(label) ? 'left' : 'right');
      for (const text of readings.has) expect(panel).toHaveTextContent(text);
      for (const text of readings.not) expect(panel).not.toHaveTextContent(text);
      fireEvent.keyDown(screen.getByRole('group'), {key:'Escape'});
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
  });

  it('always shows every dot: red and not connected until its device is paired, then green with readings', async () => {
    const user = userEvent.setup();
    const onPair = vi.fn();
    const view = render(<HumanBodyViewer metrics={metrics()} onPairDevice={onPair} motion={motion} />);
    await waitFor(() => expect(screen.getByRole('slider')).toBeEnabled());
    for (const name of ['Heart','Brain','Lungs','Chest','Legs','Skin']) {
      const dot = screen.getByRole('button', {name:`${name}, not connected`});
      expect(dot).toHaveAttribute('data-connected', 'false');
    }

    await user.click(screen.getByRole('button', {name:'Heart, not connected'}));
    const panel = screen.getByRole('complementary', {name:'Heart signals'});
    expect(panel).toHaveTextContent('Not connected. Pair the Astroskin shirt to see heart signals.');
    expect(panel).not.toHaveTextContent('Resting heart rate');
    await user.click(within(panel).getByRole('button', {name:'Pair Astroskin shirt'}));
    expect(onPair).toHaveBeenCalledWith('astroskin');

    view.rerender(<HumanBodyViewer metrics={metrics()} pairedDevices={new Set<BodyDeviceId>(['astroskin'])} motion={motion} />);
    expect(screen.getByRole('button', {name:'Heart'})).toHaveAttribute('data-connected', 'true');
    expect(screen.getByRole('complementary', {name:'Heart signals'})).toHaveTextContent('Resting heart rate');
    for (const name of ['Lungs','Skin']) expect(screen.getByRole('button', {name})).toHaveAttribute('data-connected', 'true');
    for (const name of ['Brain','Chest','Legs']) expect(screen.getByRole('button', {name:`${name}, not connected`})).toBeInTheDocument();
  });

  it.each(['unpaired','unavailable','loading'] as const)('withholds numbers for a %s source', async signalState => {
    const user = userEvent.setup();
    render(<HumanBodyViewer metrics={metrics()} signalState={signalState} pairedDevices={ALL_DEVICES} motion={motion} />);
    await user.click(await screen.findByRole('button', {name:'Heart'}));
    const panel = screen.getByRole('complementary', {name:'Heart signals'});
    expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
    expect(within(panel).getByRole('status')).toHaveTextContent(signalState === 'loading' ? 'Waiting' : signalState === 'unpaired' ? 'No device paired' : 'Readings unavailable');
  });
});
