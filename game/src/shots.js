// Screenshot scenes behind ?shot=cover|chase|mission|world. Each scene builds a fresh world,
// drives the real simulation forward with scripted inputs for a fixed number of steps, and
// leaves the state ready to paint: the same seed always produces the same frame.

import { STEP } from './config.js';
import { advanceDialogue, MISSION_DEFS } from './missions.js';
import { forceWanted } from './police.js';
import { createCar, CAR_STYLES } from './vehicles.js';

export function idleCommand() {
  return {
    moveVector() { return { x: 0, y: 0 }; },
    throttle() { return 0; },
    steer() { return 0; },
    sprinting() { return false; },
    firing() { return false; },
    mouse() { return { x: 700, y: 320 }; },
    interact: false,
    reload: false,
    view: null,
  };
}

export function driveCommand(throttle, steer) {
  const cmd = idleCommand();
  cmd.throttle = () => throttle;
  cmd.steer = () => steer;
  return cmd;
}

export function walkCommand(x, y) {
  const cmd = idleCommand();
  cmd.moveVector = () => ({ x, y });
  return cmd;
}

function snapCamera(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

function runSteps(world, cmd, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, cmd);
}

function talkToDelia(world) {
  const state = world.state;
  state.player.x = state.city.garage.x + 20;
  state.player.y = state.city.garage.y + 20;
  state.player.car = null;
  snapCamera(state);
  runSteps(world, idleCommand(), 0.1);
  let guard = 0;
  while (state.missions.dialogue && guard < 12) {
    advanceDialogue(state);
    guard += 1;
  }
}

function putPlayerInCar(state, car) {
  state.player.car = car;
  car.isPlayerCar = true;
  car.driver = null;
  state.player.x = car.x;
  state.player.y = car.y;
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMissionScene(world);
  if (name === 'world') return stageWorldScene(world);
  return stageCover(world);
}

function stageCover(world) {
  const state = world.state;
  state.clockHours = 18.6;
  talkToDelia(world);
  const target = state.traffic.concat(state.parkedCars).find((c) => c.id === state.missions.targetCarId)
    || state.parkedCars[0];
  if (target) {
    target.x = 1640; target.y = 1600; target.angle = 0.3;
    putPlayerInCar(state, target);
  }
  state.player.x = 1620;
  state.player.y = 1600;
  if (state.player.car) { state.player.car.x = 1620; state.player.car.y = 1600; state.player.car.angle = 0.3; }
  snapCamera(state);
  runSteps(world, driveCommand(1, 0.06), 2.2);
  state.clockHours = 18.6;
  snapCameraSoft(state);
  state.flashMessage = '';
  return { screen: 'play' };
}

function snapCameraSoft(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

function stageChase(world) {
  const state = world.state;
  state.clockHours = 15.2;
  const car = state.parkedCars[0];
  car.x = 2060; car.y = 2840; car.angle = -0.4;
  putPlayerInCar(state, car);
  state.player.x = car.x;
  state.player.y = car.y;
  forceWanted(state, 3);
  snapCamera(state);
  runSteps(world, driveCommand(1, -0.05), 2.6);
  // Pin the exact frame the screenshot needs: three stars, the escape objective on the
  // banner, and no mission logic left running that could overwrite either.
  state.wanted.heat = 3 * 22 - 4;
  state.wanted.stars = 3;
  state.missions.index = MISSION_DEFS.length;
  state.missions.complete = true;
  state.missions.phase = 'intro';
  state.missions.objective = 'Escape the police — break their line of sight!';
  state.missions.marker = null;
  state.clockHours = 15.2;
  snapCameraSoft(state);
  return { screen: 'play' };
}

function stageMissionScene(world) {
  const state = world.state;
  state.clockHours = 11.4;
  state.missions.index = 1;
  state.missions.phase = 'between';
  state.missions.marker = { x: state.city.garage.x, y: state.city.garage.y };
  talkToDelia(world);
  state.player.x = 668;
  state.player.y = 1052;
  state.player.car = null;
  state.missions.dialogue = MISSION_DEFS[1].intro;
  state.missions.dialogueIndex = 1;
  state.missions.phase = 'dialogue';
  snapCamera(state);
  runSteps(world, idleCommand(), 0.4);
  state.missions.dialogue = MISSION_DEFS[1].intro;
  state.missions.dialogueIndex = 1;
  state.missions.phase = 'dialogue';
  state.clockHours = 11.4;
  snapCameraSoft(state);
  return { screen: 'play' };
}

function stageWorldScene(world) {
  const state = world.state;
  state.clockHours = 9.4;
  state.player.x = 2935;
  state.player.y = 1620;
  state.player.car = null;
  const parked = createCar(2870, 1668, 0.2, CAR_STYLES[6]);
  state.parkedCars.push(parked);
  state.missions.objective = 'Free roam — Palm Beach, Viceport';
  state.missions.marker = null;
  snapCamera(state);
  runSteps(world, walkCommand(0.2, 0), 0.8);
  state.player.x = 2935;
  state.player.y = 1620;
  state.clockHours = 9.4;
  snapCameraSoft(state);
  return { screen: 'play' };
}
