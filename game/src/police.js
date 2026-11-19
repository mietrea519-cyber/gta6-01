// Wanted level and police response: crimes raise heat when a witness is near, stars follow
// heat, patrol cars spawn on roads near the player and steer to the player's predicted
// position to ram, foot officers appear at three stars and shoot when close, heat decays
// when the player stays unseen, and a held-close slow player is busted.

import { BUSTED_RADIUS, BUSTED_SECONDS, WANTED_DECAY_SECONDS, WANTED_MAX_STARS } from './config.js';
import { angleTowards, clamp, distanceBetween } from './random.js';
import { nearestRoadPoint } from './city.js';
import { createCar, stepCarPhysics } from './vehicles.js';

export const CRIME_CAR_THEFT = 'car theft';
export const CRIME_HIT_PEDESTRIAN = 'hit a pedestrian';
export const CRIME_HIT_CAR = 'hit a car';
export const CRIME_GUNFIRE = 'gunfire';
export const CRIME_HIT_POLICE = 'hit police';

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return clamp(Math.ceil(heat / 22), 1, WANTED_MAX_STARS);
}

export function witnessNear(state, x, y, radius) {
  for (const ped of state.pedestrians) {
    if (ped.state !== 'down' && distanceBetween(ped.x, ped.y, x, y) < radius) return true;
  }
  return state.policeCars.length > 0 || state.officers.length > 0;
}

export function reportCrime(state, kind, x, y, heat) {
  const witnessed = witnessNear(state, x, y, 340) || state.wanted.stars > 0;
  if (!witnessed && kind !== CRIME_HIT_POLICE) return false;
  state.wanted.heat = clamp(state.wanted.heat + heat, 0, WANTED_MAX_STARS * 22);
  state.wanted.stars = starsForHeat(state.wanted.heat);
  state.wanted.sinceCrime = 0;
  state.wanted.lastCrime = kind;
  state.soundEvents.push('siren-blip');
  return true;
}

export function forceWanted(state, stars) {
  state.wanted.heat = Math.max(state.wanted.heat, stars * 22 - 4);
  state.wanted.stars = starsForHeat(state.wanted.heat);
  state.wanted.sinceCrime = 0;
}

export function clearWanted(state) {
  state.wanted.heat = 0;
  state.wanted.stars = 0;
  state.wanted.sinceCrime = 0;
}

export function createPoliceCar(x, y, angle) {
  const car = createCar(x, y, angle, { name: 'Patrol', colour: '#eef1f4', length: 45, width: 23, topSpeed: 1.08 });
  car.isPolice = true;
  car.cruiseSpeed = 300;
  return car;
}

export function createOfficer(x, y) {
  return { x, y, angle: 0, health: 70, shootTimer: 1, state: 'chase', fallen: 0 };
}

export function policeHasLineOfSight(state) {
  const p = state.player;
  for (const car of state.policeCars) if (distanceBetween(car.x, car.y, p.x, p.y) < 520) return true;
  for (const officer of state.officers) if (officer.state !== 'down' && distanceBetween(officer.x, officer.y, p.x, p.y) < 380) return true;
  return false;
}

export function maintainPolice(state, rng) {
  const wanted = state.wanted;
  const targetCars = wanted.stars === 0 ? 0 : wanted.stars + 1;
  state.policeCars = state.policeCars.filter((car) => !car.wrecked && distanceBetween(car.x, car.y, state.player.x, state.player.y) < 1500);
  if (state.policeCars.length < targetCars && rng.chance(0.06)) {
    const road = nearestRoadPoint(state.player.x + rng.range(-700, 700), state.player.y + rng.range(-700, 700));
    state.policeCars.push(createPoliceCar(road.x, road.y, rng.range(0, Math.PI * 2)));
  }
  const targetOfficers = wanted.stars >= 3 ? wanted.stars - 1 : 0;
  state.officers = state.officers.filter((o) => o.state !== 'down' || o.fallen < 12);
  if (state.officers.length < targetOfficers && rng.chance(0.04)) {
    const road = nearestRoadPoint(state.player.x + rng.range(-260, 260), state.player.y + rng.range(-260, 260));
    state.officers.push(createOfficer(road.x + 30, road.y + 30));
  }
}

export function stepPoliceCar(state, car, dt) {
  const p = state.player;
  const target = p.car || p;
  const lead = clamp(distanceBetween(car.x, car.y, target.x, target.y) / 300, 0, 0.8);
  const aimX = target.x + Math.cos(target.angle || 0) * (target.speed || 0) * lead;
  const aimY = target.y + Math.sin(target.angle || 0) * (target.speed || 0) * lead;
  const wanted = angleTowards(car.x, car.y, aimX, aimY);
  let diff = wanted - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.4, -1, 1);
  const dist = distanceBetween(car.x, car.y, target.x, target.y);
  stepCarPhysics(car, dt, dist > 30 ? 1 : 0, steer);
  if (dist < 60 && car.speed > 210) car.speed = 210;
}

export function stepOfficer(state, officer, dt) {
  if (officer.state === 'down') { officer.fallen += dt; return null; }
  if (officer.health <= 0) { officer.state = 'down'; officer.fallen = 0.001; return null; }
  const p = state.player;
  const dist = distanceBetween(officer.x, officer.y, p.x, p.y);
  officer.angle = angleTowards(officer.x, officer.y, p.x, p.y);
  if (dist > 120) {
    officer.x += Math.cos(officer.angle) * 118 * dt;
    officer.y += Math.sin(officer.angle) * 118 * dt;
  }
  officer.shootTimer -= dt;
  if (dist < 300 && officer.shootTimer <= 0 && state.wanted.stars >= 3) {
    officer.shootTimer = 0.9;
    return { x: officer.x, y: officer.y, angle: officer.angle, fromPolice: true };
  }
  return null;
}

export function stepWanted(state, dt) {
  const wanted = state.wanted;
  wanted.sinceCrime += dt;
  if (wanted.stars > 0 && wanted.sinceCrime > WANTED_DECAY_SECONDS && !policeHasLineOfSight(state)) {
    wanted.heat = Math.max(0, wanted.heat - 9 * dt);
    wanted.stars = starsForHeat(wanted.heat);
    if (wanted.stars === 0) state.flashMessage = 'You lost the police.';
  }
  const p = state.player;
  const playerSlow = !p.car && Math.abs(p.moveSpeed || 0) < 40;
  let held = false;
  if (wanted.stars > 0) {
    for (const car of state.policeCars) if (distanceBetween(car.x, car.y, p.x, p.y) < BUSTED_RADIUS + 14) held = true;
    for (const o of state.officers) if (o.state !== 'down' && distanceBetween(o.x, o.y, p.x, p.y) < BUSTED_RADIUS) held = true;
  }
  if (held && playerSlow) {
    wanted.bustTimer += dt;
    if (wanted.bustTimer >= BUSTED_SECONDS) return 'busted';
  } else {
    wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
  }
  return null;
}
