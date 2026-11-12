// Sends realistic synthetic readings to the local webhook receiver (dev server only).
//
//   npm run send:sample                         every second, forever (Ctrl+C to stop)
//   npm run send:sample -- --count 30           send 30 rounds, then stop
//   npm run send:sample -- --bad                also mix in junk rows to show the cleaning
//   npm run send:sample -- --url http://localhost:5174 --interval 2000
//   npm run send:sample -- --backfill           first post yesterday as a full day (a reading every hour)
//   npm run send:sample -- --backfill --shift 28   ...with heart rate 28 bpm above usual, so an alert appears
//
// Alerts only ever come from COMPLETED, well-covered days (a reading in at least 18 different hours),
// never from today's partial day, so use --backfill to see one.
//
// The token is read from the receiver's status endpoint (same machine), or from
// HORIZON_INGEST_TOKEN / --token. All values are synthetic.

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };

const base = option('url', 'http://localhost:5173').replace(/\/$/, '');
const interval = Math.max(100, Number(option('interval', '1000')) || 1000);
const count = Number(option('count', '0')) || Infinity;
const withBad = flag('bad');
const backfill = flag('backfill');
const shift = Number(option('shift', '0')) || 0;
const deviceId = 'sample-sender';

let token = option('token', process.env.HORIZON_INGEST_TOKEN);
if (!token) {
  try {
    const status = await (await fetch(`${base}/api/ingest/status`)).json();
    token = status.token;
  } catch {
    console.error(`Could not reach ${base}/api/ingest/status. Is "npm run dev" running? Use --url if the port is different.`);
    process.exit(1);
  }
}
if (!token) { console.error('No token. The receiver only exists on the dev server.'); process.exit(1); }

// A gentle, believable rhythm around a typical resting level, plus a little sensor wobble.
const wave = (t, period, amp) => amp * Math.sin((2 * Math.PI * t) / period);
const wobble = (amp) => (Math.random() - 0.5) * 2 * amp;
let tick = 0;

function round(now) {
  const t = tick / 5;
  const iso = new Date(now).toISOString();
  const rows = [
    { timestamp: iso, metric: 'heart_rate', value: Math.round(64 + wave(t, 40, 4) + wobble(1.5)), unit: 'bpm', deviceId },
    { timestamp: iso, metric: 'spo2', value: Number((97.8 + wave(t, 90, 0.3) + wobble(0.15)).toFixed(1)), unit: '%', deviceId },
    { timestamp: iso, metric: 'skin_temperature', value: Number((33.3 + wave(t, 300, 0.15) + wobble(0.03)).toFixed(2)), unit: 'C', deviceId },
  ];
  if (tick % 5 === 0) rows.push({ timestamp: iso, metric: 'hrv', value: Math.round(48 + wave(t, 60, 4) + wobble(2)), unit: 'ms', deviceId });
  if (withBad && tick > 0 && tick % 8 === 0) {
    rows.push({ timestamp: iso, metric: 'heart_rate', value: 0, unit: 'bpm', deviceId }); // lost contact
    rows.push({ timestamp: iso, metric: 'spo2', value: 120, unit: '%', deviceId }); // impossible
    rows.push({ timestamp: iso, metric: 'blood_sugar', value: 5.2, unit: 'mmol', deviceId }); // not a supported signal
    rows.push({ timestamp: iso, metric: 'heart_rate', value: 190, unit: 'bpm', deviceId }); // sudden spike
  }
  return rows;
}

// Yesterday (UTC) as a complete day: one reading per hour for each signal.
async function postBackfill() {
  const today = new Date();
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 86_400_000;
  const rows = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const iso = new Date(dayStart + hour * 3_600_000 + 1_800_000).toISOString();
    rows.push({ timestamp: iso, metric: 'heart_rate', value: Math.round((64 + shift + wave(hour, 24, 3) + wobble(1)) * 10) / 10, unit: 'bpm', deviceId });
    rows.push({ timestamp: iso, metric: 'spo2', value: Number((97.8 + wobble(0.25)).toFixed(1)), unit: '%', deviceId });
    rows.push({ timestamp: iso, metric: 'skin_temperature', value: Number((33.3 + wave(hour, 24, 0.12) + wobble(0.03)).toFixed(2)), unit: 'C', deviceId });
  }
  const response = await fetch(`${base}/api/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ readings: rows }) });
  const body = await response.json();
  console.log(`Backfilled yesterday: ${response.status} accepted=${body.accepted ?? '-'} rejected=${body.rejected ?? '-'}${shift ? ` (heart rate ${shift > 0 ? '+' : ''}${shift} bpm)` : ''}`);
}
if (backfill) await postBackfill();

let sent = 0;
console.log(`Sending synthetic readings to ${base}/api/ingest every ${interval} ms${withBad ? ' (with junk rows)' : ''}. Ctrl+C to stop.`);
const timer = setInterval(async () => {
  const rows = round(Date.now());
  tick += 1;
  try {
    const response = await fetch(`${base}/api/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ readings: rows }) });
    const body = await response.json();
    console.log(`#${tick} ${response.status} accepted=${body.accepted ?? '-'} rejected=${body.rejected ?? '-'}${body.error ? ` error="${body.error}"` : ''}`);
  } catch (error) {
    console.error(`#${tick} failed: ${error.message}`);
  }
  if (++sent >= count) { clearInterval(timer); console.log('Done.'); }
}, interval);
process.on('SIGINT', () => { clearInterval(timer); console.log('\nStopped.'); process.exit(0); });
