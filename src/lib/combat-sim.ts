// Combat simulation — the SINGLE source of truth for all combat calculations.
// Used by both real-time (adventure page) and offline (offline-rewards).
// To change combat formula, modify ONLY this file.

import type { Monster } from "./combat";
import type { Stats } from "./stats";

export const PLAYER_ATTACK_INTERVAL = 3; // seconds

export interface CombatResult {
  playerDmg: number;       // damage player deals per hit
  monsterDmg: number;      // damage monster deals per hit
  hitsToKill: number;      // player hits needed to kill one monster
  timePerKill: number;     // seconds to kill one monster
  monsterHitsPerKill: number; // how many times monster hits player per kill (player attacks first)
  damagePerKill: number;   // total HP player loses per kill
}

/** Calculate the result of fighting one monster. */
export function calcCombatRound(playerStats: Stats, monster: Monster): CombatResult {
  const playerDmg = Math.max(1, playerStats.atk - monster.def);
  const monsterDmg = Math.max(1, monster.atk - playerStats.def);
  const hitsToKill = Math.ceil(monster.hp / playerDmg);
  const timePerKill = hitsToKill * PLAYER_ATTACK_INTERVAL;
  // Player attacks first — on the kill round, monster doesn't get to hit back
  const monsterHitsPerKill = Math.max(0, Math.ceil(timePerKill / monster.attackSpeed) - 1);
  const damagePerKill = monsterHitsPerKill * monsterDmg;

  return { playerDmg, monsterDmg, hitsToKill, timePerKill, monsterHitsPerKill, damagePerKill };
}

/** Simulate N seconds of combat. Returns total kills and whether player died. */
export function simulateCombat(
  playerStats: Stats,
  monster: Monster,
  maxSeconds: number,
): { kills: number; died: boolean; timeUsed: number; hpRemaining: number } {
  const round = calcCombatRound(playerStats, monster);
  let playerHp = playerStats.hp;
  let kills = 0;
  let timeUsed = 0;

  while (timeUsed + round.timePerKill <= maxSeconds) {
    playerHp -= round.damagePerKill;
    if (playerHp <= 0) {
      return { kills, died: true, timeUsed, hpRemaining: 0 };
    }
    kills++;
    timeUsed += round.timePerKill;
  }

  return { kills, died: false, timeUsed, hpRemaining: playerHp };
}
