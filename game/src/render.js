// Canvas rendering of the world: ground, beach and water, the road grid with lane markings
// and sidewalks, pseudo-3D buildings with roofs, shadows and lit windows at night, props
// (palms, trees, street lights with glow after dark), cars, pedestrians, police, bullets,
// sparks, the player with a muzzle flash, and mission markers. Pure drawing: no game rules.

import { ROAD_SPACING, ROAD_WIDTH, WORLD_SIZE } from './config.js';
import { districtAt, isSand, isWater } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

export function skyTintForHour(hours) {
  if (hours >= 6 && hours < 9) return { sky: '#f7c98a', light: 0.25 };
  if (hours >= 9 && hours < 17) return { sky: '#8fd3e8', light: 0 };
  if (hours >= 17 && hours < 20) return { sky: '#f08a5a', light: 0.35 };
  if (hours >= 20 || hours < 5) return { sky: '#1d2a4a', light: 0.72 };
  return { sky: '#e8a0a0', light: 0.5 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state, hud, viewW, viewH) {
      drawScene(ctx, state, viewW, viewH);
      if (hud) hud.drawOverlay(ctx, state, viewW, viewH);
    },
  };
}

export function drawScene(ctx, state, viewW, viewH) {
  const camX = state.camera.x - viewW / 2;
  const camY = state.camera.y - viewH / 2;
  const tint = skyTintForHour(state.clockHours);
  ctx.fillStyle = '#79a86b';
  ctx.fillRect(0, 0, viewW, viewH);
  drawGround(ctx, state, camX, camY, viewW, viewH);
  drawRoads(ctx, camX, camY, viewW, viewH);
  drawProps(ctx, state, camX, camY, viewW, viewH);
  drawBuildings(ctx, state, camX, camY, viewW, viewH, tint);
  drawMarkers(ctx, state, camX, camY);
  for (const car of state.parkedCars) drawCar(ctx, car, camX, camY, false);
  for (const car of state.traffic) if (car !== state.player.car) drawCar(ctx, car, camX, camY, false);
  for (const car of state.policeCars) drawCar(ctx, car, camX, camY, true);
  if (state.player.car) drawCar(ctx, state.player.car, camX, camY, false);
  for (const ped of state.pedestrians) drawPedestrian(ctx, ped, camX, camY);
  for (const officer of state.officers) drawOfficer(ctx, officer, camX, camY);
  if (!state.player.car) drawPlayer(ctx, state, camX, camY);
  drawBulletsAndSparks(ctx, state, camX, camY);
  if (tint.light > 0) {
    ctx.fillStyle = `rgba(16, 22, 52, ${tint.light * 0.45})`;
    ctx.fillRect(0, 0, viewW, viewH);
    drawLightGlows(ctx, state, camX, camY, viewW, viewH);
  }
}

function visible(x, y, camX, camY, viewW, viewH, pad = 90) {
  return x > camX - pad && x < camX + viewW + pad && y > camY - pad && y < camY + viewH + pad;
}

function drawGround(ctx, state, camX, camY, viewW, viewH) {
  const x0 = Math.max(0, camX);
  const y0 = Math.max(0, camY);
  const x1 = Math.min(WORLD_SIZE, camX + viewW);
  const y1 = Math.min(WORLD_SIZE, camY + viewH);
  if (isSand(x0 + 10, 0) || camX + viewW > WORLD_SIZE - 340) {
    ctx.fillStyle = '#eed9a0';
    ctx.fillRect(WORLD_SIZE - 330 - camX, y0 - camY, 200, y1 - y0);
  }
  if (camX + viewW > WORLD_SIZE - 140) {
    ctx.fillStyle = '#2e7fc2';
    ctx.fillRect(WORLD_SIZE - 130 - camX, y0 - camY, 140 + viewW, y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const wave = Math.floor(state.time * 2) % 20;
    for (let y = y0 - (y0 % 46); y < y1; y += 46) {
      ctx.fillRect(WORLD_SIZE - 122 - camX + wave, y - camY, 26, 3);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const district = districtAt(state.player.x, state.player.y);
  ctx.fillText(district, 14, viewH - 14);
}

function drawRoads(ctx, camX, camY, viewW, viewH) {
  ctx.fillStyle = '#9aa0a3';
  const startX = Math.floor(camX / ROAD_SPACING) * ROAD_SPACING;
  const startY = Math.floor(camY / ROAD_SPACING) * ROAD_SPACING;
  for (let x = startX - ROAD_SPACING; x < camX + viewW + ROAD_SPACING; x += ROAD_SPACING) {
    ctx.fillRect(x - ROAD_WIDTH / 2 - 16 - camX, 0, ROAD_WIDTH + 32, viewH);
  }
  for (let y = startY - ROAD_SPACING; y < camY + viewH + ROAD_SPACING; y += ROAD_SPACING) {
    ctx.fillRect(0, y - ROAD_WIDTH / 2 - 16 - camY, viewW, ROAD_WIDTH + 32);
  }
  for (let x = startX - ROAD_SPACING; x < camX + viewW + ROAD_SPACING; x += ROAD_SPACING) {
    ctx.fillRect(x - ROAD_WIDTH / 2 - camX, 0, ROAD_WIDTH, viewH);
  }
  ctx.fillStyle = '#3f4448';
  for (let x = startX - ROAD_SPACING; x < camX + viewW + ROAD_SPACING; x += ROAD_SPACING) {
    ctx.fillRect(x - ROAD_WIDTH / 2 - camX, 0, ROAD_WIDTH, viewH);
  }
  for (let y = startY - ROAD_SPACING; y < camY + viewH + ROAD_SPACING; y += ROAD_SPACING) {
    ctx.fillRect(0, y - ROAD_WIDTH / 2 - camY, viewW, ROAD_WIDTH);
  }
  ctx.fillStyle = '#f5eeda';
  for (let y = Math.floor(camY / 40) * 40; y < camY + viewH; y += 40) {
    for (let x = startX - ROAD_SPACING; x < camX + viewW + ROAD_SPACING; x += ROAD_SPACING) {
      ctx.fillRect(x - 2 - camX, y - camY, 4, 20);
    }
  }
  for (let x = Math.floor(camX / 40) * 40; x < camX + viewW; x += 40) {
    for (let y = startY - ROAD_SPACING; y < camY + viewH + ROAD_SPACING; y += ROAD_SPACING) {
      ctx.fillRect(x - camX, y - 2 - camY, 20, 4);
    }
  }
}

function drawProps(ctx, state, camX, camY, viewW, viewH) {
  for (const crate of state.city.crates) {
    if (!visible(crate.x, crate.y, camX, camY, viewW, viewH)) continue;
    ctx.fillStyle = crate.colour;
    ctx.fillRect(crate.x - camX, crate.y - camY, crate.size, crate.size);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(crate.x - camX, crate.y - camY, crate.size, crate.size);
  }
  for (const tree of state.city.trees) {
    if (!visible(tree.x, tree.y, camX, camY, viewW, viewH)) continue;
    const x = tree.x - camX;
    const y = tree.y - camY;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 5, tree.size, tree.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    if (tree.palm) {
      ctx.strokeStyle = '#7a5c3e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 10); ctx.stroke();
      ctx.strokeStyle = '#3f9e4d';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(x + 3, y - 10); ctx.lineTo(x + 3 + Math.cos(a) * 13, y - 10 + Math.sin(a) * 6); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#3f9e4d';
      ctx.beginPath(); ctx.arc(x, y, tree.size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57b568';
      ctx.beginPath(); ctx.arc(x - 3, y - 3, tree.size * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#565d63';
  for (const light of state.city.lights) {
    if (!visible(light.x, light.y, camX, camY, viewW, viewH, 20)) continue;
    ctx.fillRect(light.x - camX - 2, light.y - camY - 2, 4, 4);
  }
}

function drawLightGlows(ctx, state, camX, camY, viewW, viewH) {
  ctx.fillStyle = 'rgba(255, 214, 130, 0.16)';
  for (const light of state.city.lights) {
    if (!visible(light.x, light.y, camX, camY, viewW, viewH, 30)) continue;
    ctx.beginPath(); ctx.arc(light.x - camX, light.y - camY, 22, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBuildings(ctx, state, camX, camY, viewW, viewH, tint) {
  const night = tint.light > 0.4;
  for (const b of state.city.buildings) {
    if (!visible(b.x + b.w / 2, b.y + b.h / 2, camX, camY, viewW, viewH, 200)) continue;
    const x = b.x - camX;
    const y = b.y - camY;
    const lift = 6 + b.floors * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 7, y + 9, b.w, b.h);
    ctx.fillStyle = b.colour;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(x - 4, y - lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(x - 4, y - lift, b.w, b.h);
    ctx.fillStyle = night ? 'rgba(255, 220, 130, 0.9)' : 'rgba(70, 110, 140, 0.55)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if (night && (cx * 7 + cy * 13 + b.floors) % 3 === 0) continue;
        ctx.fillRect(x + 8 + cx * 24, y - lift + 8 + cy * 24, 10, 12);
      }
    }
  }
  drawLandmark(ctx, state.city.policeStation, camX, camY, '#33507a', 'POLICE');
  drawLandmark(ctx, state.city.hospital, camX, camY, '#e8e8e8', 'HOSPITAL');
  drawLandmark(ctx, state.city.garage, camX, camY, '#7a4a2e', 'GARAGE');
  drawLandmark(ctx, state.city.hideout, camX, camY, '#4a6b4f', 'HIDEOUT');
}

function drawLandmark(ctx, spot, camX, camY, colour, label) {
  const x = spot.x - camX;
  const y = spot.y - camY;
  if (x < -80 || y < -40 || x > 1400 || y > 800) return;
  ctx.fillStyle = colour;
  ctx.fillRect(x - 26, y - 14, 52, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 3);
  ctx.textAlign = 'left';
}

function drawMarkers(ctx, state, camX, camY) {
  const m = state.missions;
  if (m.marker) drawMarker(ctx, m.marker.x - camX, m.marker.y - camY, '#ffd23c', state.time);
  if (m.phase === 'active' && m.packagePos && !m.carrying) drawMarker(ctx, m.packagePos.x - camX, m.packagePos.y - camY, '#57e26a', state.time);
  if (m.taxi && m.taxi.phase === 'pickup') {
    const ped = state.pedestrians.find((p) => p.id === m.taxi.pedId);
    if (ped) drawMarker(ctx, ped.x - camX, ped.y - camY - 18, '#ffd23c', state.time);
  }
}

function drawMarker(ctx, x, y, colour, time) {
  const bob = Math.sin(time * 4) * 4;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y - 16 + bob);
  ctx.lineTo(x - 8, y - 30 + bob);
  ctx.lineTo(x + 8, y - 30 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
}

export function drawCar(ctx, car, camX, camY, police) {
  const x = car.x - camX;
  const y = car.y - camY;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.colour;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 30, 45, 0.85)';
  roundRect(ctx, -car.length * 0.08, -car.width / 2 + 3, car.length * 0.34, car.width - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 230, 245, 0.7)';
  roundRect(ctx, car.length * 0.3, -car.width / 2 + 4, car.length * 0.12, car.width - 8, 3);
  ctx.fill();
  if (car.taxi) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(-4, -5, 9, 10);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.fillText('TAXI', -4, 2);
  }
  if (police) {
    ctx.fillStyle = '#1d3f6e';
    ctx.fillRect(-car.length / 2, -car.width / 2, car.length, 5);
    ctx.fillRect(-car.length / 2, car.width / 2 - 5, car.length, 5);
    ctx.fillStyle = '#e23b3b';
    ctx.fillRect(-7, -4, 6, 8);
    ctx.fillStyle = '#3b6de2';
    ctx.fillRect(2, -4, 6, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.fillText('VCPD', -12, 2);
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(car.length * 0.32, 0, 8 + (45 - car.health) * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPedestrian(ctx, ped, camX, camY) {
  const x = ped.x - camX;
  const y = ped.y - camY;
  if (ped.state === 'riding') return;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'down') {
    ctx.fillStyle = ped.shirt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ped.angle + 1.2);
    ctx.fillRect(-10, -4, 20, 8);
    ctx.restore();
    return;
  }
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(x + Math.cos(ped.angle) * 2, y + Math.sin(ped.angle) * 2, 4.5, 0, Math.PI * 2); ctx.fill();
  if (ped.wantsTaxi) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('!', x - 2, y - 14);
  }
}

export function drawOfficer(ctx, officer, camX, camY) {
  const x = officer.x - camX;
  const y = officer.y - camY;
  if (officer.state === 'down') {
    ctx.fillStyle = '#2c4a72';
    ctx.fillRect(x - 10, y - 4, 20, 8);
    return;
  }
  ctx.fillStyle = '#2c4a72';
  ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(x + Math.cos(officer.angle) * 2, y + Math.sin(officer.angle) * 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#182a44';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(officer.angle) * 13, y + Math.sin(officer.angle) * 13);
  ctx.stroke();
}

export function drawPlayer(ctx, state, camX, camY) {
  const p = state.player;
  const x = p.x - camX;
  const y = p.y - camY;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20303e';
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e2574c';
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 2, y + Math.sin(p.angle) * 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14181d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.angle) * 15, y + Math.sin(p.angle) * 15);
  ctx.stroke();
  if (state.weapon.muzzle > 0) {
    ctx.fillStyle = 'rgba(255, 200, 60, 0.9)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.angle) * 20, y + Math.sin(p.angle) * 20, 6 * state.weapon.muzzle + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.missions.carrying) {
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x - 5, y - 16, 10, 8);
  }
}

function drawBulletsAndSparks(ctx, state, camX, camY) {
  ctx.fillStyle = '#ffe9a0';
  for (const b of state.bullets) ctx.fillRect(b.x - camX - 2, b.y - camY - 2, 4, 4);
  ctx.fillStyle = 'rgba(255, 170, 40, 0.85)';
  for (const s of state.sparks) {
    ctx.beginPath(); ctx.arc(s.x - camX, s.y - camY, 4 + s.life * 10, 0, Math.PI * 2); ctx.fill();
  }
}
