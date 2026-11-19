// Pedestrians: Viceport citizens who stroll the sidewalks, pause at crossings, wander a
// little, flee from gunfire and fast cars, hail taxis when a fare is waiting, and fall when
// a car hits them (which the police module counts as a crime when anyone sees it).

import { PEDESTRIAN_TARGET_COUNT, WORLD_SIZE } from './config.js';
import { angleTowards, distanceBetween } from './random.js';
import { resolveBuildingCollision, sidewalkPointNear } from './city.js';

const SHIRT_COLOURS = ['#e2574c', '#4c8de2', '#57b06a', '#e2b84c', '#9a6ae2', '#e28bb0', '#4cc3c9', '#e8e4da'];
const SKIN_TONES = ['#f2c9a0', '#d9a066', '#a06a3b', '#7a4a26', '#ffe0bd'];

let nextPedId = 1;

export function createPedestrian(rng, x, y) {
  const target = sidewalkPointNear(rng, x, y, 500);
  return {
    id: nextPedId++, x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62), targetX: target.x, targetY: target.y,
    shirt: rng.pick(SHIRT_COLOURS), skin: rng.pick(SKIN_TONES),
    state: 'walk', timer: 0, health: 60, fallen: 0, wantsTaxi: false, name: 'Citizen',
  };
}

export function maintainPedestrians(state, rng) {
  const player = state.player;
  state.pedestrians = state.pedestrians.filter((ped) => ped.fallen <= 0 || ped.fallen < 20);
  const near = state.pedestrians.filter((ped) => distanceBetween(ped.x, ped.y, player.x, player.y) < 900).length;
  if (near < PEDESTRIAN_TARGET_COUNT && rng.chance(0.3)) {
    const spot = sidewalkPointNear(rng, player.x + rng.range(-700, 700), player.y + rng.range(-700, 700), 260);
    if (spot.x > 16 && spot.y > 16 && spot.x < WORLD_SIZE - 16 && spot.y < WORLD_SIZE - 16) {
      state.pedestrians.push(createPedestrian(rng, spot.x, spot.y));
    }
  }
}

export function scarePedestriansNear(state, x, y, radius) {
  for (const ped of state.pedestrians) {
    if (ped.state !== 'down' && distanceBetween(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.timer = 2.4;
      ped.angle = angleTowards(x, y, ped.x, ped.y);
    }
  }
}

export function stepPedestrian(state, ped, dt, rng) {
  if (ped.state === 'down') { ped.fallen += dt; return; }
  if (ped.health <= 0) { ped.state = 'down'; ped.fallen = 0.001; return; }
  ped.timer -= dt;
  const playerCar = state.player.car;
  if (playerCar && Math.abs(playerCar.speed) > 200 && distanceBetween(ped.x, ped.y, playerCar.x, playerCar.y) < 90 && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.timer = 1.6;
    ped.angle = angleTowards(playerCar.x, playerCar.y, ped.x, ped.y);
  }
  let speed = ped.speed;
  if (ped.state === 'flee') {
    speed = 150;
    if (ped.timer <= 0) ped.state = 'walk';
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
  } else if (ped.state === 'wait') {
    if (ped.timer <= 0) {
      const target = sidewalkPointNear(rng, ped.x, ped.y, 620);
      ped.targetX = target.x; ped.targetY = target.y;
      ped.state = 'walk';
    }
  } else {
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 12) {
      ped.state = 'wait';
      ped.timer = rng.range(0.6, 3.2);
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
    }
  }
  ped.x = Math.max(12, Math.min(WORLD_SIZE - 12, ped.x));
  ped.y = Math.max(12, Math.min(WORLD_SIZE - 12, ped.y));
  const pos = resolveBuildingCollision(state.city, { x: ped.x, y: ped.y }, 9);
  ped.x = pos.x; ped.y = pos.y;
}

export function hitPedestrianByCar(state, ped, car) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.fallen = 0.001;
  ped.health = 0;
  return true;
}
