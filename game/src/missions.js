// The story of Viceport: Rook, a driver who owes the harbour money, runs five jobs for
// fixer Delia Marsh — a car delivery, a timed package run, a port pickup that ends in a
// chase, a beach checkpoint sprint and a cash grab under three stars — and afterwards
// repeatable taxi fares. Dialogue lines, objectives, markers and rewards live here.

import { distanceBetween } from './random.js';
import { clearWanted, forceWanted } from './police.js';

export const CONTACT_NAME = 'Delia Marsh';
export const HERO_NAME = 'Rook';

export const MISSION_DEFS = [
  {
    id: 'wheels', title: 'Hot Wheels, Cold Debt', reward: 250,
    intro: [
      { speaker: CONTACT_NAME, line: 'Rook. You owe the harbour, and I hold the paper. Start paying it off.' },
      { speaker: CONTACT_NAME, line: 'A coupe near Palm Beach has my name on it. Take it, bring it to my garage.' },
      { speaker: HERO_NAME, line: 'Steal a car, drive a car. My two best subjects.' },
    ],
    objective: 'Steal the marked coupe',
  },
  {
    id: 'package', title: 'The Quiet Package', reward: 320,
    intro: [
      { speaker: CONTACT_NAME, line: 'A package waits by the Suburbs fountain. On foot, no drama.' },
      { speaker: CONTACT_NAME, line: 'Carry it to the Portside gate before the clock runs out.' },
    ],
    objective: 'Pick up the package',
  },
  {
    id: 'port', title: 'Portside Heat', reward: 400,
    intro: [
      { speaker: CONTACT_NAME, line: 'Meet my man at the port cranes. He talks too much, so be quick.' },
      { speaker: HERO_NAME, line: 'Last time you said that, the whole dock had badges.' },
    ],
    objective: 'Reach the port meeting point',
  },
  {
    id: 'beachrun', title: 'Beach Road Sprint', reward: 380,
    intro: [
      { speaker: CONTACT_NAME, line: 'A client bets nobody can run the beach road checkpoints in time.' },
      { speaker: CONTACT_NAME, line: 'Prove the client wrong. Any car you like, Rook.' },
    ],
    objective: 'Hit checkpoint 1 of 4',
  },
  {
    id: 'cashgrab', title: 'Downtown Cash', reward: 550,
    intro: [
      { speaker: CONTACT_NAME, line: 'Last job. A cash bag sits in the Downtown plaza, watched and heavy.' },
      { speaker: CONTACT_NAME, line: 'Grab it and reach your hideout. Then we are square, Rook.' },
    ],
    objective: 'Grab the cash bag',
  },
];

export function createMissionState() {
  return {
    index: 0, phase: 'intro', dialogue: null, dialogueIndex: 0,
    objective: 'Talk to Delia Marsh', marker: null, timer: 0,
    checkpoint: 0, carrying: false, complete: false, taxi: null,
  };
}

export function startMissionDialogue(state) {
  const m = state.missions;
  if (m.index >= MISSION_DEFS.length) { startTaxiOffer(state); return; }
  m.dialogue = MISSION_DEFS[m.index].intro;
  m.dialogueIndex = 0;
  m.phase = 'dialogue';
}

export function advanceDialogue(state) {
  const m = state.missions;
  if (!m.dialogue) return;
  m.dialogueIndex += 1;
  if (m.dialogueIndex >= m.dialogue.length) {
    m.dialogue = null;
    beginMissionObjectives(state);
  }
}

export function currentDialogueLine(state) {
  const m = state.missions;
  if (!m.dialogue) return null;
  return m.dialogue[Math.min(m.dialogueIndex, m.dialogue.length - 1)];
}

function setObjective(state, text, x, y) {
  state.missions.objective = text;
  state.missions.marker = x === null ? null : { x, y };
}

function beginMissionObjectives(state) {
  const m = state.missions;
  const def = MISSION_DEFS[m.index];
  m.phase = 'active';
  m.checkpoint = 0;
  m.carrying = false;
  if (def.id === 'wheels') {
    const car = state.traffic.concat(state.parkedCars).find((c) => c.name === 'Coupe') || state.parkedCars[0];
    m.targetCarId = car ? car.id : null;
    if (car) setObjective(state, 'Steal the marked coupe', car.x, car.y);
  } else if (def.id === 'package') {
    m.packagePos = { x: 640, y: 1040 };
    setObjective(state, def.objective, 640, 1040);
  } else if (def.id === 'port') {
    setObjective(state, def.objective, 2120, 2920);
  } else if (def.id === 'beachrun') {
    m.checkpoints = [{ x: 2920, y: 820 }, { x: 2920, y: 1620 }, { x: 2920, y: 2420 }, { x: 2520, y: 2920 }];
    m.timer = 75;
    setObjective(state, def.objective, 2920, 820);
  } else if (def.id === 'cashgrab') {
    setObjective(state, def.objective, 1620, 1620);
  }
}

export function completeMission(state) {
  const m = state.missions;
  const def = MISSION_DEFS[m.index];
  state.player.cash += def.reward;
  state.flashMessage = `Mission complete: ${def.title} (+$${def.reward})`;
  state.soundEvents.push('mission-complete');
  m.index += 1;
  m.phase = 'done';
  m.marker = null;
  m.carrying = false;
  state.saveRequested = true;
  if (m.index >= MISSION_DEFS.length) {
    m.complete = true;
    m.objective = 'Free roam — pick up taxi fares around Viceport';
    startTaxiOffer(state);
  } else {
    m.objective = `Meet ${CONTACT_NAME} for: ${MISSION_DEFS[m.index].title}`;
    m.marker = { x: state.city.garage.x, y: state.city.garage.y };
    m.phase = 'between';
  }
}

export function failMission(state, reason) {
  const m = state.missions;
  state.flashMessage = `Mission failed: ${reason}. Talk to Delia to retry.`;
  m.phase = 'between';
  m.marker = { x: state.city.garage.x, y: state.city.garage.y };
  m.objective = `Retry: ${MISSION_DEFS[m.index] ? MISSION_DEFS[m.index].title : 'Free roam'}`;
  m.timer = 0;
  m.carrying = false;
  clearWanted(state);
}

export function startTaxiOffer(state) {
  const m = state.missions;
  const ped = state.pedestrians.find((p) => p.state === 'walk');
  if (!ped) { m.taxi = null; return; }
  ped.wantsTaxi = true;
  m.taxi = { pedId: ped.id, phase: 'pickup', dest: null, fare: 0 };
  m.objective = 'Taxi: pick up the flagged passenger';
  m.marker = { x: ped.x, y: ped.y };
  m.phase = 'taxi';
}

export function stepMissions(state, dt) {
  const m = state.missions;
  const p = state.player;
  if (m.phase === 'between' || m.phase === 'done') {
    if (m.marker && distanceBetween(p.x, p.y, m.marker.x, m.marker.y) < 60 && !p.car) startMissionDialogue(state);
    return;
  }
  if (m.phase === 'taxi') { stepTaxi(state, dt); return; }
  if (m.phase !== 'active') return;
  const def = MISSION_DEFS[m.index];
  if (!def) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(state, 'out of time'); return; }
  }
  if (def.id === 'wheels') {
    const car = state.traffic.concat(state.parkedCars).find((c) => c.id === m.targetCarId);
    if (car && m.marker && p.car !== car) { m.marker.x = car.x; m.marker.y = car.y; }
    if (p.car && p.car.id === m.targetCarId) setObjective(state, 'Deliver the coupe to the Marsh garage', state.city.garage.x, state.city.garage.y);
    if (p.car && p.car.id === m.targetCarId && distanceBetween(p.x, p.y, state.city.garage.x, state.city.garage.y) < 90) completeMission(state);
  } else if (def.id === 'package') {
    if (!m.carrying && !p.car && distanceBetween(p.x, p.y, m.packagePos.x, m.packagePos.y) < 30) {
      m.carrying = true;
      m.timer = 90;
      state.soundEvents.push('pickup');
      setObjective(state, 'Deliver the package to Portside gate (timer!)', 2020, 2820);
    }
    if (m.carrying && distanceBetween(p.x, p.y, 2020, 2820) < 55) completeMission(state);
  } else if (def.id === 'port') {
    if (!m.escaped && distanceBetween(p.x, p.y, 2120, 2920) < 70) {
      m.escaped = true;
      forceWanted(state, 2);
      setObjective(state, 'Lose the 2-star wanted level', null, null);
      state.flashMessage = 'Ambush! Lose the police.';
    }
    if (m.escaped && state.wanted.stars === 0) completeMission(state);
  } else if (def.id === 'beachrun') {
    const cp = m.checkpoints[m.checkpoint];
    if (cp && distanceBetween(p.x, p.y, cp.x, cp.y) < 85) {
      m.checkpoint += 1;
      state.soundEvents.push('pickup');
      if (m.checkpoint >= m.checkpoints.length) completeMission(state);
      else setObjective(state, `Hit checkpoint ${m.checkpoint + 1} of 4`, m.checkpoints[m.checkpoint].x, m.checkpoints[m.checkpoint].y);
    }
  } else if (def.id === 'cashgrab') {
    if (!m.carrying && !p.car && distanceBetween(p.x, p.y, 1620, 1620) < 34) {
      m.carrying = true;
      forceWanted(state, 3);
      state.soundEvents.push('pickup');
      setObjective(state, 'Escape to the Rook hideout', state.city.hideout.x, state.city.hideout.y);
    }
    if (m.carrying && distanceBetween(p.x, p.y, state.city.hideout.x, state.city.hideout.y) < 70) completeMission(state);
  }
}

function stepTaxi(state, dt) {
  const m = state.missions;
  const taxi = m.taxi;
  if (!taxi) { startTaxiOffer(state); return; }
  const ped = state.pedestrians.find((p) => p.id === taxi.pedId);
  if (!ped || ped.state === 'down') { m.taxi = null; m.objective = 'Free roam — looking for a fare'; return; }
  if (taxi.phase === 'pickup') {
    m.marker = { x: ped.x, y: ped.y };
    if (state.player.car && distanceBetween(state.player.x, state.player.y, ped.x, ped.y) < 55) {
      taxi.phase = 'drive';
      ped.state = 'riding';
      taxi.dest = { x: 400 + ((ped.id * 733) % 2600), y: 400 + ((ped.id * 389) % 2400) };
      taxi.fare = Math.round(distanceBetween(ped.x, ped.y, taxi.dest.x, taxi.dest.y) / 22);
      m.objective = `Taxi: drive your passenger to the marker ($${taxi.fare} fare)`;
      m.marker = { x: taxi.dest.x, y: taxi.dest.y };
      state.soundEvents.push('pickup');
    }
  } else if (taxi.phase === 'drive') {
    ped.x = state.player.x; ped.y = state.player.y;
    if (state.player.car && distanceBetween(state.player.x, state.player.y, taxi.dest.x, taxi.dest.y) < 70) {
      state.player.cash += taxi.fare;
      state.flashMessage = `Fare paid: $${taxi.fare}. Nice driving, Rook.`;
      state.soundEvents.push('mission-complete');
      ped.state = 'walk';
      ped.wantsTaxi = false;
      ped.x += 30; ped.y += 30;
      m.taxi = null;
      m.objective = 'Free roam — looking for the next fare';
      m.marker = null;
    }
  }
}

export function missionIntroForSave(state) {
  const m = state.missions;
  m.phase = 'between';
  if (m.index < MISSION_DEFS.length) {
    m.objective = `Meet ${CONTACT_NAME} for: ${MISSION_DEFS[m.index].title}`;
    m.marker = { x: state.city.garage.x, y: state.city.garage.y };
  } else {
    m.complete = true;
    m.objective = 'Free roam — pick up taxi fares around Viceport';
  }
}
