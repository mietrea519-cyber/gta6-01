// Cars: their shapes and colours, arcade driving physics (acceleration, drag, reverse,
// speed-sensitive steering), building and car-to-car collision, and the parked cars that
// wait around Viceport for the player to borrow.

import { CAR_ACCELERATION, CAR_BRAKE, CAR_DRAG, CAR_LENGTH, CAR_REVERSE_SPEED, CAR_TOP_SPEED, CAR_WIDTH, WORLD_SIZE } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { circleHitsBuilding } from './city.js';

export const CAR_STYLES = [
  { name: 'Sedan', colour: '#d95f4b', length: 44, width: 22, topSpeed: 1 },
  { name: 'Hatch', colour: '#4b83d9', length: 38, width: 21, topSpeed: 0.9 },
  { name: 'Taxi', colour: '#f2b63c', length: 44, width: 22, topSpeed: 0.95, taxi: true },
  { name: 'Pickup', colour: '#5da85d', length: 48, width: 24, topSpeed: 0.88 },
  { name: 'Coupe', colour: '#b44bd9', length: 42, width: 21, topSpeed: 1.12 },
  { name: 'Van', colour: '#e8e4da', length: 50, width: 25, topSpeed: 0.8 },
  { name: 'Convertible', colour: '#3cc8c0', length: 43, width: 22, topSpeed: 1.05 },
];

let nextCarId = 1;

export function createCar(x, y, angle, style) {
  return {
    id: nextCarId++, x, y, angle, speed: 0, steer: 0,
    colour: style.colour, name: style.name, length: style.length, width: style.width,
    topSpeedFactor: style.topSpeed, taxi: Boolean(style.taxi),
    health: 100, driver: null, isPlayerCar: false, isPolice: false, wrecked: false,
  };
}

export function createParkedCars(rng, city) {
  const cars = [];
  const spots = [
    [1620, 1240], [1980, 1620], [820, 1620], [2420, 820], [2820, 1620], [420, 2420],
    [1220, 420], [2020, 2420], [620, 1220], [2620, 2020], [1020, 2820], [2220, 1220],
  ];
  for (const [x, y] of spots) {
    const style = rng.pick(CAR_STYLES);
    const car = createCar(x + rng.range(-14, 14), y + rng.range(-14, 14), rng.chance(0.5) ? 0 : Math.PI / 2, style);
    if (!circleHitsBuilding(city, car.x, car.y, 26)) cars.push(car);
  }
  return cars;
}

export function stepCarPhysics(car, dt, throttle, steerInput) {
  if (car.wrecked) { car.speed = 0; return; }
  const top = CAR_TOP_SPEED * car.topSpeedFactor;
  if (throttle > 0) car.speed += CAR_ACCELERATION * dt;
  else if (throttle < 0) car.speed -= (car.speed > 4 ? CAR_BRAKE : CAR_ACCELERATION * 0.7) * dt;
  car.speed -= car.speed * CAR_DRAG * dt;
  car.speed = clamp(car.speed, -CAR_REVERSE_SPEED, top);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const steerAuthority = clamp(Math.abs(car.speed) / 130, 0, 1);
  const turnRate = 2.1 * steerAuthority * Math.sign(car.speed || 1);
  car.angle = wrapAngle(car.angle + steerInput * turnRate * dt * (car.speed < 0 ? -1 : 1));
  car.steer = steerInput;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 24, WORLD_SIZE - 24);
  car.y = clamp(car.y, 24, WORLD_SIZE - 24);
}

export function carCorners(car) {
  const hl = car.length / 2;
  const hw = car.width / 2;
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}

export function carHitsBuilding(city, car) {
  for (const corner of carCorners(car)) {
    if (circleHitsBuilding(city, corner.x, corner.y, 2)) return true;
  }
  return circleHitsBuilding(city, car.x, car.y, 6);
}

export function carsOverlap(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = (a.length + b.length) / 2 - 6;
  return dx * dx + dy * dy < reach * reach;
}

export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const reach = (a.length + b.length) / 2 - 6;
  const push = (reach - dist) / 2;
  if (push <= 0) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  return true;
}

export function damageCar(car, amount) {
  car.health -= amount;
  if (car.health <= 0) { car.health = 0; car.wrecked = true; car.speed = 0; }
  return car.wrecked;
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36);
}

export { CAR_LENGTH, CAR_WIDTH };
