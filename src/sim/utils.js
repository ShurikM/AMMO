export function dist2(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Seeded PRNG (mulberry32)
let _seed = 0;
let _rng = Math.random; // default to Math.random

export function seedRNG(seed) {
  _seed = seed;
  let t = seed + 0x6D2B79F5;
  _rng = function() {
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function resetRNG() {
  _rng = Math.random;
}

export function random() {
  return _rng();
}
