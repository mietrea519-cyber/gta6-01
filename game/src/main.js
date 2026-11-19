// Boot and the one loop for Viceport: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer plus HUD paint
// what is there. Screens: title, play, paused, busted and wasted. Progress saves to
// localStorage on mission completion and from the pause menu.
//
// ?seed=N fixes the city layout. ?shot=cover|chase|mission|world (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import { BUSTED_FEE, SAVE_KEY, STEP, WASTED_FEE } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACTION_ADVANCE, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { advanceDialogue } from './missions.js';
import { clearWanted } from './police.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(world) {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.player.cash,
      missionIndex: s.missions.index,
      x: Math.round(s.player.x),
      y: Math.round(s.player.y),
      health: Math.round(s.player.health),
    }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

function buildCommand(world, input, actions) {
  const s = world.state;
  const mouse = input.mouse();
  return {
    moveVector: () => input.moveVector(),
    throttle: () => input.throttle(),
    steer: () => input.steer(),
    sprinting: () => input.sprinting(),
    firing: () => input.firing(),
    mouse: () => mouse,
    interact: Boolean(actions & ACTION_INTERACT),
    reload: Boolean(actions & ACTION_RELOAD),
    view: {
      cx: s.player.x, cy: s.player.y,
      camX: s.camera.x - canvas.width / 2, camY: s.camera.y - canvas.height / 2,
    },
  };
}

function runShot(name) {
  const world = createWorld(createRandom(seed));
  const renderer = createRenderer(canvas);
  const hud = createHud();
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, hud, canvas.width, canvas.height, scene.screen, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(createRandom(seed));
  const renderer = createRenderer(canvas);
  const hud = createHud();
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveExists = Boolean(readSave());
  world.reset();

  function announce(message) { status.textContent = message; }

  function startNewGame() {
    world.reset();
    screen = SCREEN_PLAY;
    announce('Viceport. Meet Delia Marsh at the Marsh garage.');
  }

  function continueGame() {
    const save = readSave();
    world.reset(save || undefined);
    screen = SCREEN_PLAY;
    announce('Welcome back to Viceport.');
  }

  function respawnAfterBusted() {
    const s = world.state;
    s.player.cash = Math.max(0, s.player.cash - BUSTED_FEE);
    s.player.car = null;
    s.player.x = s.city.policeStation.x + 40;
    s.player.y = s.city.policeStation.y + 40;
    s.player.health = 100;
    s.player.dead = false;
    clearWanted(s);
    screen = SCREEN_PLAY;
  }

  function respawnAfterWasted() {
    const s = world.state;
    s.player.cash = Math.max(0, s.player.cash - WASTED_FEE);
    s.player.car = null;
    s.player.x = s.city.hospital.x + 40;
    s.player.y = s.city.hospital.y + 40;
    s.player.health = 100;
    s.player.dead = false;
    clearWanted(s);
    screen = SCREEN_PLAY;
  }

  window.addEventListener('keydown', (event) => {
    audio.unlock();
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && saveExists) continueGame();
    if (screen === SCREEN_PAUSED) {
      if (event.code === 'KeyS') { writeSave(world); saveExists = true; world.state.flashMessage = 'Game saved.'; world.state.flashTimer = 3; }
      if (event.code === 'KeyT') {
        world.state.missions.phase = 'between';
        world.state.missions.marker = { x: world.state.city.garage.x, y: world.state.city.garage.y };
        world.state.missions.objective = 'Meet Delia Marsh to restart the mission';
        screen = SCREEN_PLAY;
      }
      if (event.code === 'KeyQ') screen = SCREEN_TITLE;
    }
  });
  canvas.addEventListener('mousedown', () => audio.unlock());

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startNewGame();
      return 0;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) respawnAfterBusted();
      return 0;
    }
    if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) respawnAfterWasted();
      return 0;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      return 0;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_ADVANCE) && world.state.missions.dialogue) {
      advanceDialogue(world.state);
      return actions & ~(ACTION_ADVANCE | ACTION_INTERACT);
    }
    return actions;
  }

  function step(actions) {
    const cmd = buildCommand(world, input, actions);
    const events = world.step(STEP, cmd);
    const s = world.state;
    while (s.soundEvents.length) audio.playEvent(s.soundEvents.shift());
    if (s.saveRequested) { s.saveRequested = false; writeSave(world); saveExists = true; }
    if (events & EVENT_BUSTED) { screen = SCREEN_BUSTED; announce('Busted.'); }
    else if (events & EVENT_WASTED) { screen = SCREEN_WASTED; announce('Wasted.'); }
  }

  function audioSnapshot() {
    const s = world.state;
    let nearest = null;
    for (const car of s.policeCars) {
      const d = Math.abs(car.x - s.player.x) + Math.abs(car.y - s.player.y);
      if (nearest === null || d < nearest) nearest = d;
    }
    return {
      drivingSpeed: s.player.car ? s.player.car.speed : null,
      nearestPoliceDistance: nearest,
      wantedStars: s.wanted.stars,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.update(1 / 60, audioSnapshot());
    renderer.draw(world.state, hud, canvas.width, canvas.height, screen, saveExists);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('Viceport. Press Enter for a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
