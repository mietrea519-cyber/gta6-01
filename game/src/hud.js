// The HUD: health bar, cash, wanted stars, weapon and ammo, speed while driving, the
// objective banner, flash messages, dialogue boxes, menus (title, pause, busted, wasted)
// and the minimap with roads, water, buildings, the player arrow, the yellow mission
// marker and blue police blips. Drawn every frame over the world render.

import { BUSTED_FEE, PLAYER_MAX_HEALTH, ROAD_SPACING, WASTED_FEE, WORLD_SIZE } from './config.js';
import { carSpeedKmh } from './vehicles.js';
import { currentDialogueLine, MISSION_DEFS } from './missions.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WASTED, skyTintForHour } from './render.js';

const MINIMAP_SIZE = 168;
const MINIMAP_MARGIN = 14;

export function createHud() {
  return {
    drawOverlay(ctx, state, viewW, viewH, screen, saveExists) {
      if (screen === SCREEN_TITLE) { drawTitleScreen(ctx, state, viewW, viewH, saveExists); return; }
      drawHudBars(ctx, state, viewW, viewH);
      drawMinimap(ctx, state, viewW, viewH);
      drawObjectiveBanner(ctx, state, viewW, viewH);
      const line = currentDialogueLine(state);
      if (line) drawDialogueBox(ctx, line, viewW, viewH);
      if (state.flashMessage && state.flashTimer > 0) drawFlashMessage(ctx, state, viewW, viewH);
      if (state.wanted.bustTimer > 0.15) drawBustProgress(ctx, state, viewW, viewH);
      if (screen === SCREEN_PAUSED) drawPauseMenu(ctx, state, viewW, viewH);
      if (screen === SCREEN_BUSTED) drawEndScreen(ctx, viewW, viewH, 'BUSTED', `The Viceport police took $${BUSTED_FEE}. You walk out of the station.`, '#3b6de2');
      if (screen === SCREEN_WASTED) drawEndScreen(ctx, viewW, viewH, 'WASTED', `St. Coral Hospital patched you up for $${WASTED_FEE}.`, '#e23b3b');
    },
  };
}

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10, 14, 22, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHudBars(ctx, state, viewW, viewH) {
  const p = state.player;
  panel(ctx, 14, 14, 232, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`$${p.cash}`, 24, 36);
  ctx.fillStyle = '#57e26a';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(p.district, 24, 54);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(110, 24, 124, 10);
  ctx.fillStyle = p.health > 30 ? '#57e26a' : '#e23b3b';
  ctx.fillRect(110, 24, 124 * Math.max(0, p.health) / PLAYER_MAX_HEALTH, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 110, 48);
  drawWantedStars(ctx, state, viewW);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a0';
  const clock = formatClock(state.clockHours);
  ctx.fillText(clock, viewW - 150, 70);
  if (!p.car) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const reload = state.weapon.reloading > 0 ? ' RELOADING' : '';
    ctx.fillText(`PISTOL  ${state.weapon.ammo} / ${state.weapon.reserve}${reload}`, viewW - 190, 92);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${carSpeedKmh(p.car)} km/h`, viewW - 130, 94);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(p.car.name, viewW - 130, 110);
  }
}

export function formatClock(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawWantedStars(ctx, state, viewW) {
  const stars = state.wanted.stars;
  ctx.font = 'bold 21px system-ui, sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23c' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', viewW - 150 + i * 26, 38);
  }
}

export function drawMinimap(ctx, state, viewW, viewH) {
  const x0 = viewW - MINIMAP_SIZE - MINIMAP_MARGIN;
  const y0 = viewH - MINIMAP_SIZE - MINIMAP_MARGIN;
  const scale = MINIMAP_SIZE / WORLD_SIZE;
  panel(ctx, x0 - 4, y0 - 4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8, 0.62);
  ctx.fillStyle = '#6d9e5f';
  ctx.fillRect(x0, y0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.fillStyle = '#2e7fc2';
  ctx.fillRect(x0 + (WORLD_SIZE - 130) * scale, y0, 130 * scale, MINIMAP_SIZE);
  ctx.fillStyle = '#eed9a0';
  ctx.fillRect(x0 + (WORLD_SIZE - 330) * scale, y0, 200 * scale, MINIMAP_SIZE);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (const b of state.city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  ctx.strokeStyle = '#3f4448';
  ctx.lineWidth = 2;
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    ctx.beginPath(); ctx.moveTo(x0 + v * scale, y0); ctx.lineTo(x0 + v * scale, y0 + MINIMAP_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + v * scale); ctx.lineTo(x0 + MINIMAP_SIZE, y0 + v * scale); ctx.stroke();
  }
  ctx.fillStyle = '#3b6de2';
  for (const car of state.policeCars) {
    ctx.beginPath(); ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  for (const officer of state.officers) {
    if (officer.state !== 'down') ctx.fillRect(x0 + officer.x * scale - 1.5, y0 + officer.y * scale - 1.5, 3, 3);
  }
  if (state.missions.marker) {
    const mk = state.missions.marker;
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(x0 + mk.x * scale, y0 + mk.y * scale, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawObjectiveBanner(ctx, state, viewW, viewH) {
  const m = state.missions;
  if (!m.objective) return;
  ctx.font = 'bold 14px system-ui, sans-serif';
  const timer = m.timer > 0 ? `   ${Math.ceil(m.timer)}s` : '';
  const text = `${m.index < MISSION_DEFS.length && !m.complete ? MISSION_DEFS[m.index].title + ' — ' : ''}${m.objective}${timer}`;
  const w = Math.min(viewW - 40, ctx.measureText(text).width + 28);
  panel(ctx, (viewW - w) / 2, 14, w, 32, 0.6);
  ctx.fillStyle = '#ffd23c';
  ctx.textAlign = 'center';
  ctx.fillText(text, viewW / 2, 36);
  ctx.textAlign = 'left';
}

export function drawDialogueBox(ctx, line, viewW, viewH) {
  const w = Math.min(680, viewW - 48);
  const x = (viewW - w) / 2;
  const y = viewH - 128;
  panel(ctx, x, y, w, 74, 0.78);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(line.speaker, x + 16, y + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  wrapText(ctx, line.line, x + 16, y + 46, w - 32, 17);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Space / click to continue', x + w - 150, y + 64);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}

export function drawFlashMessage(ctx, state, viewW, viewH) {
  ctx.font = 'bold 16px system-ui, sans-serif';
  const w = ctx.measureText(state.flashMessage).width + 30;
  panel(ctx, (viewW - w) / 2, 56, w, 34, 0.65);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(state.flashMessage, viewW / 2, 79);
  ctx.textAlign = 'left';
}

export function drawBustProgress(ctx, state, viewW, viewH) {
  ctx.fillStyle = '#e23b3b';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED METER — MOVE!', viewW / 2, viewH - 170);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(viewW / 2 - 90, viewH - 162, 180, 9);
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(viewW / 2 - 90, viewH - 162, 180 * Math.min(1, state.wanted.bustTimer / 2.5), 9);
  ctx.textAlign = 'left';
}

export function drawTitleScreen(ctx, state, viewW, viewH, saveExists) {
  const tint = skyTintForHour(state.clockHours);
  ctx.fillStyle = 'rgba(12, 16, 30, 0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('VICEPORT', viewW / 2, viewH * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('A sun-soaked city of palm roads, port cranes and bad debts.', viewW / 2, viewH * 0.3 + 34);
  ctx.fillText('Rook owes the harbour. Fixer Delia Marsh holds the paper. Drive, run, deliver — settle it.', viewW / 2, viewH * 0.3 + 58);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a0';
  ctx.fillText('WASD / arrows: move & drive · E or F: enter / exit car · Mouse: aim · Click: shoot', viewW / 2, viewH * 0.55);
  ctx.fillText('R: reload · Shift: sprint · Esc / P: pause · M: mute', viewW / 2, viewH * 0.55 + 24);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#57e26a';
  ctx.fillText(saveExists ? 'Press Enter — New Game · C — Continue' : 'Press Enter — New Game', viewW / 2, viewH * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Sky: ${tint.sky} · An original game — every name, street and story invented for Viceport.`, viewW / 2, viewH * 0.7 + 30);
  ctx.textAlign = 'left';
}

export function drawPauseMenu(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH * 0.36);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Esc / P — Resume', viewW / 2, viewH * 0.46);
  ctx.fillText('S — Save game', viewW / 2, viewH * 0.46 + 30);
  ctx.fillText('T — Restart current mission', viewW / 2, viewH * 0.46 + 60);
  ctx.fillText('Q — Back to title', viewW / 2, viewH * 0.46 + 90);
  ctx.fillStyle = '#ffe9a0';
  ctx.fillText(`Cash $${state.player.cash} · Mission ${Math.min(state.missions.index + 1, MISSION_DEFS.length)} of ${MISSION_DEFS.length}`, viewW / 2, viewH * 0.46 + 130);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, viewW, viewH, title, detail, colour) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.fillText(title, viewW / 2, viewH * 0.42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(detail, viewW / 2, viewH * 0.42 + 38);
  ctx.fillText('Press Enter to continue', viewW / 2, viewH * 0.42 + 68);
  ctx.textAlign = 'left';
}
