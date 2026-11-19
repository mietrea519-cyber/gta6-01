// All sound is synthesized with WebAudio — no audio files. An engine hum pitched by speed,
// a two-tone siren that follows the nearest police car, a gunshot noise burst, a hit thud,
// a pickup chime, a mission-complete arpeggio and a slow synth music loop (bass plus pad).
// Audio starts on the first user gesture; M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let muted = false;
  let started = false;

  function ensureContext() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function startEngineAndSiren() {
    if (!ctx || started) return;
    started = true;
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ctx || muted) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type = 'sine', when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain); gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    unlock() {
      if (!ensureContext()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startEngineAndSiren();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    playEvent(name) {
      if (!ctx || muted) return;
      if (name === 'gunshot') noiseBurst(0.12, 0.5, 2600);
      else if (name === 'hit') tone(90, 0.14, 0.5, 'sine', 0, 45);
      else if (name === 'crash') { noiseBurst(0.22, 0.45, 900); tone(70, 0.2, 0.4, 'sine', 0, 40); }
      else if (name === 'pickup') { tone(880, 0.1, 0.25, 'sine'); tone(1320, 0.14, 0.25, 'sine', 0.08); }
      else if (name === 'mission-complete') { tone(523, 0.14, 0.25, 'triangle'); tone(659, 0.14, 0.25, 'triangle', 0.12); tone(784, 0.22, 0.28, 'triangle', 0.24); }
      else if (name === 'reload') tone(300, 0.06, 0.2, 'square');
      else if (name === 'door') tone(180, 0.08, 0.2, 'square', 0, 120);
    },
    update(dt, snapshot) {
      if (!ctx || !started) return;
      const t = ctx.currentTime;
      if (engineGain) {
        const driving = snapshot.drivingSpeed !== null;
        const speed = Math.abs(snapshot.drivingSpeed || 0);
        engineGain.gain.setTargetAtTime(muted || !driving ? 0 : 0.05 + speed / 430 * 0.06, t, 0.08);
        if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + speed * 0.32, t, 0.08);
      }
      if (sirenGain && sirenOsc) {
        const near = snapshot.nearestPoliceDistance;
        const on = !muted && near !== null && near < 620 && snapshot.wantedStars > 0;
        sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.1);
        if (on) sirenOsc.frequency.setTargetAtTime(Math.floor(t * 1.6) % 2 === 0 ? 690 : 920, t, 0.03);
      }
      musicTimer -= dt;
      if (musicTimer <= 0 && !muted) {
        musicTimer = 2.4;
        const bassNotes = [55, 55, 65.4, 49];
        const bar = Math.floor(t / 2.4) % bassNotes.length;
        tone(bassNotes[bar], 1.6, 0.12, 'triangle');
        tone(bassNotes[bar] * 4, 2.2, 0.045, 'sine');
        tone(bassNotes[bar] * 6, 2.2, 0.03, 'sine', 0.4);
      }
    },
  };
}
