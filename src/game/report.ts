import type { Outcome, SimEvent } from "@/realtime/sim/events";

/** What happened in a wave, built from the same events the view sees. */
export interface WaveReport {
  outcome: Outcome | null;
  /** Wave ticks played (countdown and hit-stop excluded). */
  ticks: number;
  kills: number;
  killsByRole: Record<string, number>;
  killsByDef: Record<string, number>;
  killsBySkill: Record<string, number>;
  damageBySkill: Record<string, number>;
  damageTaken: number;
  damageTakenBy: Record<string, number>;
  lowestHp: number;
  causeOfDeath: string | null;
  spawned: number;
  spawnedByRole: Record<string, number>;
  peakAlive: number;
  droppedSpawns: number;
  droppedVolumes: number;
  /** Enemy warned volumes: started, then dodged or taken on resolve, or cancelled. */
  telegraphs: { started: number; dodged: number; taken: number; cancelled: number };
}

export function createReport(playerHp: number): WaveReport {
  return {
    outcome: null,
    ticks: 0,
    kills: 0,
    killsByRole: {},
    killsByDef: {},
    killsBySkill: {},
    damageBySkill: {},
    damageTaken: 0,
    damageTakenBy: {},
    lowestHp: playerHp,
    causeOfDeath: null,
    spawned: 0,
    spawnedByRole: {},
    peakAlive: 0,
    droppedSpawns: 0,
    droppedVolumes: 0,
    telegraphs: { started: 0, dodged: 0, taken: 0, cancelled: 0 },
  };
}

function add(m: Record<string, number>, key: string, n: number): void {
  m[key] = (Object.hasOwn(m, key) ? m[key] : 0) + n;
}

export function recordEvents(r: WaveReport, events: readonly SimEvent[]): void {
  for (const e of events) {
    switch (e.t) {
      case "spawned":
        if (e.team !== "enemy") break;
        r.spawned += 1;
        add(r.spawnedByRole, e.role, 1);
        break;
      case "hit":
        if (e.team === "enemy") add(r.damageBySkill, e.skill, e.amount);
        break;
      case "died":
        if (e.role === "player") {
          r.causeOfDeath = e.killer;
        } else {
          r.kills += 1;
          add(r.killsByRole, e.role, 1);
          add(r.killsByDef, e.def, 1);
          if (e.skill !== null) add(r.killsBySkill, e.skill, 1);
        }
        break;
      case "playerHurt":
        r.damageTaken += e.amount;
        add(r.damageTakenBy, e.by === null ? "unknown" : e.by, e.amount);
        r.lowestHp = Math.min(r.lowestHp, e.hp);
        break;
      case "volumeStarted":
        if (e.team === "enemy" && e.warnTicks > 0) r.telegraphs.started += 1;
        break;
      case "telegraphResolved":
        if (e.hitPlayer) r.telegraphs.taken += 1;
        else r.telegraphs.dodged += 1;
        break;
      case "volumeEnded":
        if (e.team === "enemy" && e.cancelled) r.telegraphs.cancelled += 1;
        break;
      case "waveEnded":
        r.outcome = e.outcome;
        break;
      default:
        break;
    }
  }
}
