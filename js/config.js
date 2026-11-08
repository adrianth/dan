const CONFIG = {
  playerName: 'Dan',
  targetScore: 1200,
  roundSeconds: 60,

  // Pressure rises as dp/dt = pumpRate * (pumpBase + p); the boiler blows at p >= 1.
  pumpRate: 0.52,
  pumpBase: 0.6,

  streamSeconds: 0.6,
  dropsPerSecond: 140,
  // Distance (in game pixels) from Manneken Pis to where the stream lands, at zero and full pressure.
  minRange: 30,
  maxRange: 153,

  cooldownSeconds: 0.25,
  blowoutSeconds: 1.3,

  umbrellaChance: 0.72,
  spawnStart: 1.5,
  spawnEnd: 0.85,
  maxTourists: 8,
  selfieStopSeconds: 2.5,

  points: { tourist: 100, selfie: 100, bureaucrat: 200, vendor: 300 },
  maxMultiplier: 3,
};
