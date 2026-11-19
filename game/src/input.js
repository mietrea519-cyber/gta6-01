// Keyboard and mouse input: WASD and arrow keys to move or drive, E or F to enter and exit
// cars, R to reload, Shift to sprint, Space or click to advance dialogue and confirm menus,
// Esc or P to pause, M to mute, and the mouse position for aiming the pistol.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
export const ACTION_ADVANCE = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function codeToAction(code) {
    if (code === 'KeyE' || code === 'KeyF') return ACTION_INTERACT;
    if (code === 'Escape' || code === 'KeyP') return ACTION_PAUSE;
    if (code === 'Enter' || code === 'Space') return ACTION_CONFIRM | ACTION_ADVANCE;
    if (code === 'KeyR') return ACTION_RELOAD;
    if (code === 'KeyM') return ACTION_MUTE;
    return 0;
  }

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) actions |= codeToAction(event.code);
    keys.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    mouseY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouseDown = true; actions |= ACTION_ADVANCE; }
  });
  window.addEventListener('mouseup', (event) => { if (event.button === 0) mouseDown = false; });

  return {
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    throttle() {
      let t = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) t += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) t -= 1;
      return t;
    },
    steer() {
      let s = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      return s;
    },
    sprinting() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    firing() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    setMouse(x, y) { mouseX = x; mouseY = y; },
    setFiring(on) { mouseDown = on; },
    takeActions() { const a = actions; actions = 0; return a; },
    press(action) { actions |= action; },
  };
}

export function scriptedInput(moveX, moveY, throttle, steer) {
  return {
    moveVector() { return { x: moveX, y: moveY }; },
    throttle() { return throttle; },
    steer() { return steer; },
    sprinting() { return false; },
    firing() { return false; },
    mouse() { return { x: 640, y: 300 }; },
    takeActions() { return 0; },
  };
}
