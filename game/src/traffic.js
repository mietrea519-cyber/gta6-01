// Traffic: AI cars that spawn on roads away from the player, keep to the right-hand lane,
// follow their road through junctions, slow down for the car ahead and stop at a safe gap,
// and despawn when they fall far behind. A stolen traffic car loses its driver, who flees.

import { ROAD_SPACING, ROAD_WIDTH, TRAFFIC_DESPAWN_RADIUS, TRAFFIC_SPAWN_RADIUS, TRAFFIC_TARGET_COUNT, WORLD_SIZE } from './config.js';
import { angleTowards, clamp, distanceBetween } from './random.js';
import { isRoadCoordinate } from './city.js';
import { CAR_STYLES, createCar, stepCarPhysics } from './vehicles.js';

const LANE_OFFSET = ROAD_WIDTH / 4;

export function laneTargetFor(car) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  if (Math.abs(dx) > Math.abs(dy)) {
    const roadY = Math.round(car.y / ROAD_SPACING) * ROAD_SPACING;
    return { x: car.x + dx * 120, y: roadY + (dx > 0 ? LANE_OFFSET : -LANE_OFFSET) };
  }
  const roadX = Math.round(car.x / ROAD_SPACING) * ROAD_SPACING;
  return { x: roadX + (dy > 0 ? -LANE_OFFSET : LANE_OFFSET), y: car.y + dy * 120 };
}

export function spawnTrafficCar(rng, player) {
  for (let tries = 0; tries < 20; tries += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(620, TRAFFIC_SPAWN_RADIUS);
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    if (x < 60 || y < 60 || x > WORLD_SIZE - 60 || y > WORLD_SIZE - 60) continue;
    const vertical = rng.chance(0.5);
    let sx; let sy; let heading;
    if (vertical && isRoadCoordinate(x)) { sx = x; sy = y; heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
    else if (!vertical && isRoadCoordinate(y)) { sx = x; sy = y; heading = rng.chance(0.5) ? 0 : Math.PI; }
    else continue;
    const car = createCar(sx, sy, heading, rng.pick(CAR_STYLES));
    car.driver = { name: 'driver' };
    car.cruiseSpeed = rng.range(120, 185);
    return car;
  }
  return null;
}

export function maintainTraffic(state, rng) {
  const player = state.player;
  state.traffic = state.traffic.filter((car) => distanceBetween(car.x, car.y, player.x, player.y) < TRAFFIC_DESPAWN_RADIUS || car === player.car);
  const active = state.traffic.filter((car) => car !== player.car).length;
  if (active < TRAFFIC_TARGET_COUNT && rng.chance(0.25)) {
    const car = spawnTrafficCar(rng, player);
    if (car) state.traffic.push(car);
  }
}

export function stepTrafficCar(state, car, dt) {
  if (car === state.player.car || car.wrecked) return;
  const target = laneTargetFor(car);
  const wanted = angleTowards(car.x, car.y, target.x, target.y);
  let diff = wanted - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  let throttle = 1;
  let desired = car.cruiseSpeed || 150;
  const aheadX = car.x + Math.cos(car.angle) * 58;
  const aheadY = car.y + Math.sin(car.angle) * 58;
  const blockers = [...state.traffic, ...state.policeCars];
  if (state.player.car) blockers.push(state.player.car);
  for (const other of blockers) {
    if (other === car) continue;
    if (distanceBetween(aheadX, aheadY, other.x, other.y) < 40) { desired = 0; break; }
    if (distanceBetween(car.x, car.y, other.x, other.y) < 110) desired = Math.min(desired, 70);
  }
  if (!state.player.car && distanceBetween(aheadX, aheadY, state.player.x, state.player.y) < 34) desired = 0;
  if (car.speed > desired) throttle = car.speed - desired > 40 ? -1 : 0;
  const fakeInput = { throttle, steer };
  const before = car.speed;
  stepCarPhysics(car, dt, fakeInput.throttle, fakeInput.steer);
  if (desired === 0 && before < 60) car.speed = Math.max(0, car.speed - 240 * dt);
  if (car.speed > desired + 4) car.speed = Math.max(desired, car.speed - 300 * dt);
}
