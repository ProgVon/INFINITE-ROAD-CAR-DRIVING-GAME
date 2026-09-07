// Storage.js - Manages persistent arcade records using localStorage

const STORAGE_KEYS = {
  HIGH_SCORE: 'retro_highway_highscore',
  BEST_DISTANCE: 'retro_highway_best_distance',
  MAX_COMBO: 'retro_highway_max_combo',
  TOTAL_RUNS: 'retro_highway_total_runs'
};

export class Storage {
  static getHighScore() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE) || '0', 10);
    } catch {
      return 0;
    }
  }

  static getBestDistance() {
    try {
      return parseFloat(localStorage.getItem(STORAGE_KEYS.BEST_DISTANCE) || '0');
    } catch {
      return 0;
    }
  }

  static getMaxCombo() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.MAX_COMBO) || '0', 10);
    } catch {
      return 0;
    }
  }

  static saveRun(score, distance, combo) {
    try {
      const prevHigh = this.getHighScore();
      const prevDistance = this.getBestDistance();
      const prevCombo = this.getMaxCombo();
      const totalRuns = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_RUNS) || '0', 10) + 1;

      const isNewHighScore = score > prevHigh;

      if (isNewHighScore) {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
      }
      if (distance > prevDistance) {
        localStorage.setItem(STORAGE_KEYS.BEST_DISTANCE, distance.toFixed(1));
      }
      if (combo > prevCombo) {
        localStorage.setItem(STORAGE_KEYS.MAX_COMBO, combo.toString());
      }
      localStorage.setItem(STORAGE_KEYS.TOTAL_RUNS, totalRuns.toString());

      return {
        isNewHighScore,
        highScore: Math.max(score, prevHigh),
        bestDistance: Math.max(distance, prevDistance),
        maxCombo: Math.max(combo, prevCombo)
      };
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
      return {
        isNewHighScore: false,
        highScore: score,
        bestDistance: distance,
        maxCombo: combo
      };
    }
  }
}
