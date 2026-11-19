// Shared tuning constants for Viceport: world size, the fixed simulation step, player and
// vehicle numbers, wanted-level thresholds and the save key. Every other module reads its
// numbers from here so the game stays balanced in one place.

export const STEP = 1 / 60;
export const WORLD_SIZE = 3200;
export const ROAD_SPACING = 400;
export const ROAD_WIDTH = 96;
export const SIDEWALK_WIDTH = 18;

export const PLAYER_RADIUS = 11;
export const PLAYER_WALK_SPEED = 165;
export const PLAYER_SPRINT_SPEED = 245;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_REGEN_PER_SECOND = 2.2;
export const PLAYER_REGEN_DELAY = 6;

export const CAR_LENGTH = 44;
export const CAR_WIDTH = 22;
export const CAR_ACCELERATION = 340;
export const CAR_TOP_SPEED = 430;
export const CAR_REVERSE_SPEED = 130;
export const CAR_BRAKE = 620;
export const CAR_DRAG = 0.55;

export const TRAFFIC_TARGET_COUNT = 14;
export const TRAFFIC_SPAWN_RADIUS = 1050;
export const TRAFFIC_DESPAWN_RADIUS = 1450;
export const PEDESTRIAN_TARGET_COUNT = 26;

export const WANTED_MAX_STARS = 5;
export const WANTED_DECAY_SECONDS = 12;
export const BUSTED_RADIUS = 26;
export const BUSTED_SECONDS = 2.5;
export const BUSTED_FEE = 150;
export const WASTED_FEE = 200;

export const PISTOL_DAMAGE = 34;
export const PISTOL_MAGAZINE = 12;
export const PISTOL_RELOAD_SECONDS = 1.1;
export const PISTOL_COOLDOWN = 0.16;
export const BULLET_SPEED = 780;
export const BULLET_LIFE = 0.55;

export const SAVE_KEY = 'viceport-save-v1';
export const DAY_LENGTH_SECONDS = 240;
export const START_CASH = 120;
