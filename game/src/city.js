// The city of Viceport: a 3200 by 3200 world with a road grid every 400 px, sidewalks,
// collision buildings with pastel facades, four named districts, palm trees, street lights,
// beach sand and water on the east edge, and crates and piers at the port in the south.
// Other modules ask this file where roads, buildings and districts are; nothing here draws.

import { ROAD_SPACING, ROAD_WIDTH, SIDEWALK_WIDTH, WORLD_SIZE } from './config.js';

export const DISTRICT_DOWNTOWN = 'Downtown';
export const DISTRICT_PALM_BEACH = 'Palm Beach';
export const DISTRICT_PORTSIDE = 'Portside';
export const DISTRICT_SUBURBS = 'Suburbs';

const BUILDING_COLOURS = ['#e8b4a0', '#a8c8d8', '#f2d492', '#b5d3a7', '#d9a7c7', '#f4ead8', '#9fb8e8', '#e6c39a', '#bfe0dd', '#f0b8b0'];
const ROOF_COLOURS = ['#8a6f5c', '#5f7d8c', '#a08b5a', '#6d8a5f', '#8c5f7d', '#9a8f7a', '#5f7496', '#96755a'];

export function isRoadCoordinate(value) {
  const m = ((value % ROAD_SPACING) + ROAD_SPACING) % ROAD_SPACING;
  return m < ROAD_WIDTH / 2 || m > ROAD_SPACING - ROAD_WIDTH / 2;
}

export function isOnRoad(x, y) {
  return isRoadCoordinate(x) || isRoadCoordinate(y);
}

export function isOnSidewalk(x, y) {
  const nearRoadX = isRoadCoordinate(x + SIDEWALK_WIDTH) || isRoadCoordinate(x - SIDEWALK_WIDTH);
  const nearRoadY = isRoadCoordinate(y + SIDEWALK_WIDTH) || isRoadCoordinate(y - SIDEWALK_WIDTH);
  return !isOnRoad(x, y) && (nearRoadX || nearRoadY || isOnRoad(x + SIDEWALK_WIDTH, y) || isOnRoad(x, y + SIDEWALK_WIDTH));
}

export function districtAt(x, y) {
  if (x > WORLD_SIZE - 420) return DISTRICT_PALM_BEACH;
  if (y > WORLD_SIZE - 620 && x > 900) return DISTRICT_PORTSIDE;
  if (x > 1150 && x < 2150 && y > 1050 && y < 2250) return DISTRICT_DOWNTOWN;
  return DISTRICT_SUBURBS;
}

export function isWater(x, y) {
  return x > WORLD_SIZE - 130;
}

export function isSand(x, y) {
  return x > WORLD_SIZE - 330 && x <= WORLD_SIZE - 130;
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const lights = [];
  const crates = [];
  const houses = [];
  const half = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 10;
  for (let bx = 0; bx < WORLD_SIZE / ROAD_SPACING; bx += 1) {
    for (let by = 0; by < WORLD_SIZE / ROAD_SPACING; by += 1) {
      const x0 = bx * ROAD_SPACING + half;
      const y0 = by * ROAD_SPACING + half;
      const w = ROAD_SPACING - half * 2;
      const district = districtAt(bx * ROAD_SPACING + 200, by * ROAD_SPACING + 200);
      if (district === DISTRICT_SUBURBS) {
        for (let i = 0; i < 4; i += 1) {
          const hx = x0 + (i % 2) * (w / 2) + 14;
          const hy = y0 + Math.floor(i / 2) * (w / 2) + 14;
          const house = { x: hx, y: hy, w: w / 2 - 30, h: w / 2 - 30, colour: rng.pick(BUILDING_COLOURS), roof: rng.pick(ROOF_COLOURS), floors: 1 };
          houses.push(house);
          buildings.push(house);
        }
      } else if (district === DISTRICT_PORTSIDE && by >= 6) {
        for (let i = 0; i < 5; i += 1) {
          crates.push({ x: x0 + rng.range(0, w - 40), y: y0 + rng.range(0, w - 40), size: rng.range(22, 38), colour: rng.pick(['#c96f4a', '#4a7dc9', '#5da85d', '#c9b44a']) });
        }
        const shed = { x: x0 + 20, y: y0 + 20, w: w - 90, h: 90, colour: '#9aa5ad', roof: '#5c666d', floors: 1 };
        buildings.push(shed);
      } else {
        const tall = district === DISTRICT_DOWNTOWN;
        const bw = rng.range(w * 0.55, w * 0.85);
        const bh = rng.range(w * 0.55, w * 0.85);
        buildings.push({
          x: x0 + (w - bw) / 2, y: y0 + (w - bh) / 2, w: bw, h: bh,
          colour: rng.pick(BUILDING_COLOURS), roof: rng.pick(ROOF_COLOURS),
          floors: tall ? rng.int(4, 9) : rng.int(2, 4),
        });
      }
      for (let i = 0; i < 3; i += 1) {
        trees.push({ x: x0 + rng.range(0, w), y: y0 + rng.range(0, w), palm: district === DISTRICT_PALM_BEACH || rng.chance(0.4), size: rng.range(7, 12) });
      }
    }
  }
  for (let x = ROAD_WIDTH / 2; x < WORLD_SIZE; x += ROAD_SPACING) {
    for (let y = 90; y < WORLD_SIZE; y += 180) {
      lights.push({ x: x + ROAD_WIDTH / 2 + 8, y });
      lights.push({ x: x - ROAD_WIDTH / 2 - 8, y: y + 90 > WORLD_SIZE ? y : y + 90 });
    }
  }
  const policeStation = { x: 1560, y: 1180, label: 'Viceport Police Station' };
  const hospital = { x: 1240, y: 1980, label: 'St. Coral Hospital' };
  const garage = { x: 2360, y: 1560, label: 'Marsh Drop Garage' };
  const hideout = { x: 620, y: 620, label: 'Rook Hideout' };
  return { buildings, houses, trees, lights, crates, policeStation, hospital, garage, hideout };
}

export function buildingAtPoint(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w && y > b.y - pad && y < b.y + b.h) return b;
  }
  return null;
}

export function circleHitsBuilding(city, x, y, radius) {
  return buildingAtPoint(city, x, y, radius) !== null;
}

export function resolveBuildingCollision(city, pos, radius) {
  const b = buildingAtPoint(city, pos.x, pos.y, radius);
  if (!b) return pos;
  const left = pos.x - (b.x - radius);
  const right = (b.x + b.w + radius) - pos.x;
  const top = pos.y - (b.y - radius);
  const bottom = (b.y + b.h + radius) - pos.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) pos.x = b.x - radius;
  else if (min === right) pos.x = b.x + b.w + radius;
  else if (min === top) pos.y = b.y - radius;
  else pos.y = b.y + b.h + radius;
  return pos;
}

export function nearestRoadPoint(x, y) {
  const snap = (v) => Math.round(v / ROAD_SPACING) * ROAD_SPACING;
  const rx = snap(x);
  const ry = snap(y);
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y };
  return { x, y: ry };
}

export function roadAxisAt(x, y) {
  if (isRoadCoordinate(x) && !isRoadCoordinate(y)) return 'vertical';
  if (isRoadCoordinate(y) && !isRoadCoordinate(x)) return 'horizontal';
  return 'junction';
}

export function sidewalkPointNear(rng, x, y, radius) {
  for (let tries = 0; tries < 24; tries += 1) {
    const px = x + rng.range(-radius, radius);
    const py = y + rng.range(-radius, radius);
    if (px < 20 || py < 20 || px > WORLD_SIZE - 20 || py > WORLD_SIZE - 20) continue;
    if (isOnSidewalk(px, py) || isOnRoad(px, py)) return { x: px, y: py };
  }
  const road = nearestRoadPoint(x, y);
  return { x: road.x + ROAD_WIDTH / 2 + 14, y: road.y };
}
