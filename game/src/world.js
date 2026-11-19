// The simulation core: owns the whole game state (player, cars, traffic, pedestrians,
// police, bullets, wanted level, missions, clock) and advances it one fixed step at a time
// from an input snapshot. It never touches the canvas or the DOM, so it can be stepped
// headlessly; render.js and hud.js only read what this file maintains.

import {
  BULLET_LIFE, BULLET_SPEED, DAY_LENGTH_SECONDS, PISTOL_COOLDOWN, PISTOL_DAMAGE,
  PISTOL_MAGAZINE, PISTOL_RELOAD_SECONDS, PLAYER_MAX_HEALTH, PLAYER_RADIUS,
  PLAYER_REGEN_DELAY, PLAYER_REGEN_PER_SECOND, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED,
  START_CASH, WORLD_SIZE,
} from './config.js';
import { angleTowards, clamp, distanceBetween } from './random.js';
import { buildCity, circleHitsBuilding, districtAt, resolveBuildingCollision } from './city.js';
import { carHitsBuilding, carsOverlap, createParkedCars, damageCar, separateCars, stepCarPhysics } from './vehicles.js';
import { maintainTraffic, stepTrafficCar } from './traffic.js';
import { hitPedestrianByCar, maintainPedestrians, scarePedestriansNear, stepPedestrian } from './pedestrians.js';
import {
  CRIME_GUNFIRE, CRIME_HIT_CAR, CRIME_HIT_PEDESTRIAN, CRIME_HIT_POLICE,
  createOfficer, maintainPolice, reportCrime, stepOfficer, stepPoliceCar, stepWanted,
} from './police.js';
import { createMissionState, missionIntroForSave, stepMissions } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

export function createWorld(rng) {
  const city = buildCity(rng);
  const state = {
    rng,
    city,
    time: 0,
    clockHours: 10.2,
    player: {
      x: 1600, y: 1560, angle: 0, health: PLAYER_MAX_HEALTH, cash: START_CASH,
      car: null, moveSpeed: 0, lastDamageAt: -99, district: 'Downtown', dead: false,
    },
    weapon: { ammo: PISTOL_MAGAZINE, reserve: 60, cooldown: 0, reloading: 0, muzzle: 0 },
    traffic: [],
    parkedCars: createParkedCars(rng, city),
    pedestrians: [],
    policeCars: [],
    officers: [],
    bullets: [],
    sparks: [],
    wanted: { heat: 0, stars: 0, sinceCrime: 99, bustTimer: 0, lastCrime: '' },
    missions: createMissionState(),
    camera: { x: 1600, y: 1560 },
    flashMessage: '',
    flashTimer: 0,
    soundEvents: [],
    saveRequested: false,
    gameOver: null,
  };
  state.missions.phase = 'intro';
  return {
    state,
    reset(save) {
      const fresh = createWorld(rng);
      Object.assign(state, fresh.state);
      if (save) {
        state.player.cash = save.cash ?? START_CASH;
        state.player.x = save.x ?? state.player.x;
        state.player.y = save.y ?? state.player.y;
        state.player.health = save.health ?? PLAYER_MAX_HEALTH;
        state.missions.index = save.missionIndex ?? 0;
        missionIntroForSave(state);
      } else {
        state.missions.phase = 'between';
        state.missions.objective = 'Meet Delia Marsh at the Marsh garage';
        state.missions.marker = { x: city.garage.x, y: city.garage.y };
      }
    },
    step(dt, cmd) { return stepWorld(state, dt, cmd); },
  };
}

export function nearestEnterableCar(state) {
  const p = state.player;
  let best = null;
  let bestDist = 52;
  for (const car of [...state.traffic, ...state.parkedCars, ...state.policeCars]) {
    if (car.wrecked) continue;
    const d = distanceBetween(p.x, p.y, car.x, car.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  if (car.driver) {
    car.driver = null;
    const fleer = { x: car.x + 26, y: car.y + 10, angle: 0, speed: 130, targetX: car.x + 200, targetY: car.y + 160, shirt: '#888888', skin: '#d9a066', state: 'flee', timer: 3, health: 60, fallen: 0, wantsTaxi: false, id: -1, name: 'Driver' };
    state.pedestrians.push(fleer);
    reportCrime(state, 'car theft', car.x, car.y, 24);
    state.flashMessage = 'You stole a car!';
  }
  p.car = car;
  car.isPlayerCar = true;
  p.x = car.x;
  p.y = car.y;
  state.soundEvents.push('door');
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.isPlayerCar = false;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  const pos = resolveBuildingCollision(state.city, { x: p.x, y: p.y }, PLAYER_RADIUS);
  p.x = pos.x; p.y = pos.y;
  state.soundEvents.push('door');
}

function stepPlayerOnFoot(state, dt, cmd) {
  const p = state.player;
  const mv = cmd.moveVector();
  const len = Math.sqrt(mv.x * mv.x + mv.y * mv.y);
  const speed = cmd.sprinting() ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  if (len > 0) {
    const nx = mv.x / len;
    const ny = mv.y / len;
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
    p.angle = Math.atan2(ny, nx);
    p.moveSpeed = speed;
  } else {
    p.moveSpeed = 0;
  }
  p.x = clamp(p.x, 14, WORLD_SIZE - 14);
  p.y = clamp(p.y, 14, WORLD_SIZE - 14);
  const pos = resolveBuildingCollision(state.city, { x: p.x, y: p.y }, PLAYER_RADIUS);
  p.x = pos.x; p.y = pos.y;
}

function stepPlayerDriving(state, dt, cmd) {
  const p = state.player;
  const car = p.car;
  const beforeSpeed = car.speed;
  const beforeX = car.x;
  const beforeY = car.y;
  stepCarPhysics(car, dt, cmd.throttle(), cmd.steer());
  if (carHitsBuilding(state.city, car)) {
    car.x = beforeX; car.y = beforeY;
    if (Math.abs(beforeSpeed) > 130) {
      damageCar(car, 12);
      hurtPlayer(state, 4);
      state.soundEvents.push('crash');
      reportCrime(state, CRIME_HIT_CAR, car.x, car.y, 6);
    }
    car.speed = -beforeSpeed * 0.25;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.moveSpeed = Math.abs(car.speed);
  if (Math.abs(car.speed) > 260) scarePedestriansNear(state, car.x, car.y, 110);
}

function stepCarCollisions(state) {
  const all = [...state.traffic, ...state.parkedCars, ...state.policeCars];
  if (state.player.car && !all.includes(state.player.car)) all.push(state.player.car);
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i];
      const b = all[j];
      if (!carsOverlap(a, b)) continue;
      const impact = Math.abs(a.speed - b.speed);
      if (separateCars(a, b)) {
        if (impact > 90) {
          damageCar(a, 8); damageCar(b, 8);
          state.soundEvents.push('crash');
          const involvesPlayer = a === state.player.car || b === state.player.car;
          const involvesPolice = a.isPolice || b.isPolice;
          if (involvesPlayer && involvesPolice) reportCrime(state, CRIME_HIT_POLICE, a.x, a.y, 18);
          else if (involvesPlayer) reportCrime(state, CRIME_HIT_CAR, a.x, a.y, 10);
          a.speed *= 0.55; b.speed *= 0.55;
        }
      }
    }
  }
  const carsToCheck = state.player.car ? [state.player.car, ...state.policeCars] : [];
  for (const car of carsToCheck) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of state.pedestrians) {
      if (ped.state === 'down' || ped.state === 'riding') continue;
      if (distanceBetween(ped.x, ped.y, car.x, car.y) < 26) {
        if (hitPedestrianByCar(state, ped, car)) {
          state.soundEvents.push('hit');
          if (car === state.player.car) reportCrime(state, CRIME_HIT_PEDESTRIAN, ped.x, ped.y, 22);
        }
      }
    }
  }
}

function hurtPlayer(state, amount) {
  const p = state.player;
  p.health -= amount;
  p.lastDamageAt = state.time;
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}

function fireBullet(state, x, y, angle, fromPolice) {
  state.bullets.push({
    x, y, vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_LIFE, fromPolice, damage: fromPolice ? 7 : PISTOL_DAMAGE,
  });
}

function stepCombat(state, dt, cmd, view) {
  const p = state.player;
  const w = state.weapon;
  w.cooldown -= dt;
  w.muzzle = Math.max(0, w.muzzle - dt * 9);
  if (w.reloading > 0) {
    w.reloading -= dt;
    if (w.reloading <= 0) {
      const take = Math.min(PISTOL_MAGAZINE - w.ammo, w.reserve);
      w.ammo += take;
      w.reserve -= take;
    }
  }
  if (cmd.reload && w.reloading <= 0 && w.ammo < PISTOL_MAGAZINE && w.reserve > 0) {
    w.reloading = PISTOL_RELOAD_SECONDS;
    state.soundEvents.push('reload');
  }
  if (!p.car && cmd.firing() && w.cooldown <= 0 && w.reloading <= 0) {
    if (w.ammo > 0) {
      w.ammo -= 1;
      w.cooldown = PISTOL_COOLDOWN;
      w.muzzle = 1;
      const mouse = cmd.mouse();
      const aim = angleTowards(view.cx, view.cy, view.camX + mouse.x, view.camY + mouse.y);
      p.angle = aim;
      fireBullet(state, p.x + Math.cos(aim) * 16, p.y + Math.sin(aim) * 16, aim + state.rng.range(-0.02, 0.02), false);
      state.soundEvents.push('gunshot');
      scarePedestriansNear(state, p.x, p.y, 260);
      reportCrime(state, CRIME_GUNFIRE, p.x, p.y, 14);
    } else {
      w.reloading = PISTOL_RELOAD_SECONDS;
      state.soundEvents.push('reload');
    }
  }
  for (const officer of state.officers) {
    const shot = stepOfficerFire(state, officer, dt);
    if (shot) fireBullet(state, shot.x, shot.y, shot.angle + state.rng.range(-0.06, 0.06), true);
  }
  stepBullets(state, dt);
}

function stepOfficerFire(state, officer, dt) {
  // Police shooting cadence lives in police.js stepOfficer; this wrapper keeps world.js
  // from double-stepping officers (they are moved in stepWorld, shots are requested here).
  return null;
}

function stepBullets(state, dt) {
  const p = state.player;
  state.bullets = state.bullets.filter((b) => {
    b.life -= dt;
    if (b.life <= 0) return false;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (circleHitsBuilding(state.city, b.x, b.y, 2)) {
      state.sparks.push({ x: b.x, y: b.y, life: 0.25 });
      return false;
    }
    if (b.fromPolice) {
      const target = p.car || p;
      const radius = p.car ? 26 : PLAYER_RADIUS + 3;
      if (distanceBetween(b.x, b.y, target.x, target.y) < radius) {
        hurtPlayer(state, b.damage);
        state.soundEvents.push('hit');
        return false;
      }
      return true;
    }
    for (const ped of state.pedestrians) {
      if (ped.state !== 'down' && distanceBetween(b.x, b.y, ped.x, ped.y) < 11) {
        ped.health -= b.damage;
        state.sparks.push({ x: b.x, y: b.y, life: 0.25 });
        if (ped.health <= 0) reportCrime(state, CRIME_HIT_PEDESTRIAN, ped.x, ped.y, 20);
        return false;
      }
    }
    for (const officer of state.officers) {
      if (officer.state !== 'down' && distanceBetween(b.x, b.y, officer.x, officer.y) < 11) {
        officer.health -= b.damage;
        state.sparks.push({ x: b.x, y: b.y, life: 0.25 });
        reportCrime(state, CRIME_HIT_POLICE, officer.x, officer.y, 20);
        return false;
      }
    }
    for (const car of [...state.traffic, ...state.parkedCars, ...state.policeCars]) {
      if (distanceBetween(b.x, b.y, car.x, car.y) < 24) {
        damageCar(car, b.damage);
        state.sparks.push({ x: b.x, y: b.y, life: 0.25 });
        if (car.isPolice) reportCrime(state, CRIME_HIT_POLICE, car.x, car.y, 16);
        return false;
      }
    }
    return true;
  });
  state.sparks = state.sparks.filter((s) => { s.life -= dt; return s.life > 0; });
}

function stepWorld(state, dt, cmd) {
  const p = state.player;
  state.time += dt;
  state.clockHours = (state.clockHours + dt * 24 / DAY_LENGTH_SECONDS) % 24;
  state.flashTimer = Math.max(0, state.flashTimer - dt);
  if (state.flashTimer <= 0 && state.flashMessage) { /* message stays until replaced */ }

  if (cmd.interact) {
    if (p.car) exitCar(state);
    else {
      const car = nearestEnterableCar(state);
      if (car) enterCar(state, car);
    }
  }

  if (p.car) stepPlayerDriving(state, dt, cmd);
  else stepPlayerOnFoot(state, dt, cmd);

  maintainTraffic(state, state.rng);
  for (const car of state.traffic) stepTrafficCar(state, car, dt);
  maintainPedestrians(state, state.rng);
  for (const ped of state.pedestrians) {
    if (ped.state !== 'riding') stepPedestrian(state, ped, dt, state.rng);
  }
  maintainPolice(state, state.rng);
  for (const car of state.policeCars) stepPoliceCar(state, car, dt);
  for (const officer of state.officers) {
    // Officers move in police.js logic through a light inline step to keep fire in stepCombat.
    stepOfficerMovement(state, officer, dt);
  }
  stepCarCollisions(state);
  stepCombat(state, dt, cmd, cmd.view || { cx: p.x, cy: p.y, camX: state.camera.x - 640, camY: state.camera.y - 360 });
  stepMissions(state, dt);

  if (p.health < PLAYER_MAX_HEALTH && state.time - p.lastDamageAt > PLAYER_REGEN_DELAY && !p.dead) {
    p.health = Math.min(PLAYER_MAX_HEALTH, p.health + PLAYER_REGEN_PER_SECOND * dt);
  }
  p.district = districtAt(p.x, p.y);

  const camSpeed = p.car ? 5.2 : 7.5;
  state.camera.x += (p.x - state.camera.x) * Math.min(1, camSpeed * dt);
  state.camera.y += (p.y - state.camera.y) * Math.min(1, camSpeed * dt);

  let events = 0;
  const bust = stepWanted(state, dt);
  if (bust === 'busted') events |= EVENT_BUSTED;
  if (p.dead) events |= EVENT_WASTED;
  return events;
}

function stepOfficerMovement(state, officer, dt) {
  if (officer.state === 'down') { officer.fallen += dt; return; }
  if (officer.health <= 0) { officer.state = 'down'; officer.fallen = 0.001; return; }
  const p = state.player;
  const dist = distanceBetween(officer.x, officer.y, p.x, p.y);
  officer.angle = angleTowards(officer.x, officer.y, p.x, p.y);
  if (dist > 120) {
    officer.x += Math.cos(officer.angle) * 118 * dt;
    officer.y += Math.sin(officer.angle) * 118 * dt;
    const pos = resolveBuildingCollision(state.city, { x: officer.x, y: officer.y }, 10);
    officer.x = pos.x; officer.y = pos.y;
  }
  officer.shootTimer -= dt;
  if (dist < 300 && officer.shootTimer <= 0 && state.wanted.stars >= 3) {
    officer.shootTimer = 0.95;
    state.pendingPoliceShots = state.pendingPoliceShots || [];
    state.pendingPoliceShots.push({ x: officer.x, y: officer.y, angle: officer.angle });
  }
  if (state.pendingPoliceShots && state.pendingPoliceShots.length) {
    for (const shot of state.pendingPoliceShots) {
      fireBullet(state, shot.x, shot.y, shot.angle + state.rng.range(-0.06, 0.06), true);
    }
    state.pendingPoliceShots = [];
  }
}

export function setFlash(state, message) {
  state.flashMessage = message;
  state.flashTimer = 4;
}

export { createOfficer };
