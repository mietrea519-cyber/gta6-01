[![Bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/mietrea519-cyber/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/mietrea519-cyber/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Viceport

An original top-down 2D open-world crime game that runs entirely in the browser from static
files — no build step, no network at runtime, vanilla JavaScript ES modules only. Every name,
street, character and line of story was invented for this game: you play **Rook**, a driver who
owes the harbour money, working off the debt for fixer **Delia Marsh** across the sun-soaked
city of Viceport.

## The city

A 3200×3200 world with a road grid, lane markings and sidewalks, collision buildings with
pastel facades and pseudo-3D roofs, and four named districts: **Downtown** in the centre,
**Palm Beach** in the east with sand and a water edge, **Portside** in the south with crates
and sheds, and the **Suburbs** of houses in the west and north. Palm trees, street lights that
glow after dark, lit windows at night, and a full day cycle tinting the sky complete the place.

## Systems

- **On foot and driving** — smooth WASD/arrow movement, camera follow, and `E`/`F` to enter or
  exit any parked or traffic car. Stealing a traffic car throws its driver out (they flee) and
  counts as a crime. Arcade car physics: acceleration, top speed, reverse, speed-sensitive
  steering, building and traffic collision.
- **Traffic** — 12–16 AI cars spawn on roads away from you, keep right-hand lanes, slow and
  stop for the car ahead and for your car, and despawn when far away, in seven body styles.
- **Pedestrians** — citizens stroll the sidewalks, wait at crossings, flee gunfire and fast
  cars, and fall when hit (a witnessed crime).
- **Wanted and police** — 0–5 stars. Car theft, hitting a pedestrian or a car, gunfire and
  hitting police raise heat when witnessed. Patrol cars spawn scaled by stars and steer to
  your predicted position to ram; at 3+ stars foot officers appear and shoot when close.
  Heat decays after ~12 s unseen. Get held close while slow and on foot and you are **busted**
  (respawn at the police station minus a fee); health 0 means **wasted** (hospital, minus a fee).
- **Combat** — a pistol with mouse aim, muzzle flash, fast projectiles, hit sparks, damage to
  pedestrians, police and cars, `R` to reload, health with slow regeneration, and police
  return fire at higher wanted levels.
- **Missions and story** — a five-mission chain for Delia Marsh with dialogue boxes, on-screen
  objectives and map markers: steal and deliver a marked coupe; carry a package across town
  against a timer; a port meeting that turns into a forced 2-star escape; a timed beach-road
  checkpoint run; and a downtown cash grab escaping under 3 stars. Afterwards: free roam plus
  repeatable taxi fares paid by distance.
- **HUD** — health bar, cash, wanted stars, weapon and ammo, speed while driving, objective
  banner, dialogue box, flash messages, a bust meter, and a live **minimap** with roads,
  water, buildings, your arrow, the yellow mission marker and blue police blips.
- **Menus and save** — title screen with the story and controls, pause menu (resume, save,
  restart mission, back to title), busted/wasted screens with the fee, and saving to
  `localStorage` (`viceport-save-v1`) on mission completion and from the pause menu.
- **Audio** — everything synthesized with WebAudio, no files: an engine hum pitched by speed,
  a two-tone siren near police, gunshot noise, hit thuds, pickup chimes, a mission-complete
  arpeggio and a slow bass-and-pad music loop. `M` mutes.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E or F | Enter / exit car |
| Mouse | Aim |
| Click | Shoot (on foot) |
| R | Reload |
| Shift | Sprint |
| Space / click | Advance dialogue, confirm |
| Esc / P | Pause |
| M | Mute |

## Run it

```sh
node serve.ts          # serves game/ on localhost:8080
```

Then open the printed address in a desktop browser. To package the entry the way the bounty
expects: `MAKEFUN_OUTPUT_DIR=out node main.ts`, which copies `game/` and `screenshots/` and
writes `dossier.json`.

Screenshot scenes are staged deterministically with `?shot=cover|chase|mission|world&seed=1`
(see `shots.json`).

---

Built for the make.fun gta6-01 bounty — try the platform: https://make.fun/?ref=1e3qpbvy
