// Input.js - Handles discrete lane switching and forward/backward throttle input

export class Input {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      space: false,
      enter: false,
      escape: false
    };

    // Events triggered once per key press (for discrete lane switches)
    this.laneLeftQueued = false;
    this.laneRightQueued = false;
    this.actionQueued = false; // Space or Enter
    this.pauseQueued = false;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
      // Prevent scrolling with arrows and spacebar
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          if (!this.keys.left) {
            this.laneLeftQueued = true;
          }
          this.keys.left = true;
          break;

        case 'ArrowRight':
        case 'KeyD':
          if (!this.keys.right) {
            this.laneRightQueued = true;
          }
          this.keys.right = true;
          break;

        case 'ArrowUp':
        case 'KeyW':
          this.keys.up = true;
          break;

        case 'ArrowDown':
        case 'KeyS':
          this.keys.down = true;
          break;

        case 'Space':
        case 'Enter':
          if (!this.keys.space && !this.keys.enter) {
            this.actionQueued = true;
          }
          if (e.code === 'Space') this.keys.space = true;
          if (e.code === 'Enter') this.keys.enter = true;
          break;

        case 'Escape':
        case 'KeyP':
          this.pauseQueued = true;
          this.keys.escape = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.keys.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keys.down = false;
          break;
        case 'Space':
          this.keys.space = false;
          break;
        case 'Enter':
          this.keys.enter = false;
          break;
        case 'Escape':
        case 'KeyP':
          this.keys.escape = false;
          break;
      }
    });
  }

  // Consume discrete actions so they only fire once per press
  consumeLaneLeft() {
    if (this.laneLeftQueued) {
      this.laneLeftQueued = false;
      return true;
    }
    return false;
  }

  consumeLaneRight() {
    if (this.laneRightQueued) {
      this.laneRightQueued = false;
      return true;
    }
    return false;
  }

  consumeAction() {
    if (this.actionQueued) {
      this.actionQueued = false;
      return true;
    }
    return false;
  }

  consumePause() {
    if (this.pauseQueued) {
      this.pauseQueued = false;
      return true;
    }
    return false;
  }
}
