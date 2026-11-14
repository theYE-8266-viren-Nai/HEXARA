import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HumanBodyViewer, { clampBodyRotation } from './HumanBodyViewer';
import { bodyRegions, regionFacesCamera, type BodyHotspot } from '../domain/bodyRegions';
import { mockDashboardRepository } from '../lib/mockDashboardRepository';

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
    const metrics = mockDashboardRepository.getSnapshot('usual', {seed:42, replayCount:0}).metrics;
    render(<HumanBodyViewer metrics={metrics} />);
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

  it('keeps posterior markers on the back and never invents unavailable measurements', async () => {
    const user = userEvent.setup();
    render(<HumanBodyViewer metrics={mockDashboardRepository.getSnapshot('usual', {seed:42, replayCount:0}).metrics} />);
    await screen.findByRole('button', {name:'Heart'});
    expect(screen.queryByRole('button', {name:'Spine'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), {target:{value:'180'}});
    expect(screen.queryByRole('button', {name:'Heart'})).not.toBeInTheDocument();
    for (const label of ['Spine','Back muscle']) {
      await user.click(screen.getByRole('button', {name:label}));
      expect(screen.getByRole('complementary', {name:`${label} signals`})).toBeInTheDocument();
      expect(screen.getByRole('complementary', {name:`${label} signals`})).toHaveAttribute('data-side','left');
      expect(screen.getByText('No direct measurement available')).toBeInTheDocument();
      expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', {name:label}));
    }
    await user.click(screen.getByRole('button', {name:'Front view'}));
    for (const label of ['Brain','Lungs','Chest','Leg muscle','Skin']) {
      await user.click(screen.getByRole('button', {name:label}));
      expect(screen.getByRole('complementary', {name:`${label} signals`})).toBeInTheDocument();
      expect(screen.getByRole('complementary', {name:`${label} signals`})).toHaveAttribute('data-side', ['Brain','Chest'].includes(label) ? 'left' : 'right');
      fireEvent.keyDown(screen.getByRole('group'), {key:'Escape'});
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
  });

  it.each(['unpaired','unavailable','loading'] as const)('withholds numbers for a %s source', async signalState => {
    const user = userEvent.setup();
    render(<HumanBodyViewer metrics={mockDashboardRepository.getSnapshot('usual', {seed:42, replayCount:0}).metrics} signalState={signalState} />);
    await user.click(await screen.findByRole('button', {name:'Heart'}));
    expect(screen.getByRole('complementary', {name:'Heart signals'})).toBeInTheDocument();
    expect(screen.queryByText('Resting heart rate')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(signalState === 'loading' ? 'Waiting' : signalState === 'unpaired' ? 'No device paired' : 'Readings unavailable');
  });
});
