import { tickSeconds } from "@/realtime/core/clock";
import { bodyHeight } from "@/realtime/present/anim/creatures";
import { startShake } from "@/realtime/present/camera";
import { buildColorOf, emit, jitter } from "@/realtime/present/fx/emit";
import { explosion } from "@/realtime/present/fx/recipes/explosion";
import { groundFire } from "@/realtime/present/fx/recipes/ground";
import { deathInk, goldFlakes, hitInk } from "@/realtime/present/fx/recipes/ink";
import type { Presentation } from "@/realtime/present/presentation";
import { telegraphVfx } from "@/realtime/present/telegraphs";
import type { SimEvent } from "@/realtime/sim/events";

/** Sim events → effects, flashes, lunges, ghosts, shake and sound, chosen by content keys. */
export function applyEvents(p: Presentation, events: readonly SimEvent[], t: number): void {
  const { content, em } = p;
  const { fx, feedback } = content.look;
  for (const e of events) {
    switch (e.t) {
      case "volumeStarted": {
        const vfx = fx.vfx[e.vfx];
        const build = buildColorOf(content, e.ownerDef);
        if (vfx.recipe === "projectile") {
          p.tracker.start(e.id, vfx, build, t);
          if (vfx.sound !== null) p.sound.request(vfx.sound, t);
        } else if (vfx.recipe === "ground") {
          const lifeS = tickSeconds(e.lifeTicks);
          groundFire(em, vfx, e.x, e.y, e.r, lifeS, t, build);
          if (vfx.sound !== null) p.sound.request(vfx.sound, t, t + lifeS);
        } else if (vfx.recipe === "telegraph") {
          // The event's own tick, as for spawn warnings: a frame can run several ticks.
          if (p.telegraphs.start(e, tickSeconds(e.tick)) && vfx.sound !== null)
            p.sound.request(vfx.sound, t);
        }
        break;
      }
      case "volumeEnded": {
        if (e.kind === "projectile") p.tracker.end(e.id);
        p.telegraphs.end(e.id);
        const vfx = fx.vfx[e.vfx];
        // A cancelled burst never swept: nothing went off.
        if (vfx.recipe === "explosion" && !e.cancelled) {
          const shake = explosion(em, vfx, e.x, e.y, e.r, t, buildColorOf(content, e.ownerDef));
          if (shake !== null) startShake(p.camera, t, feedback.shake[shake]);
          if (vfx.sound !== null) p.sound.request(vfx.sound, t);
        }
        break;
      }
      case "telegraphResolved": {
        const { resolve } = telegraphVfx(content.look, e.vfx);
        const size = 2 * e.r * resolve.scale;
        emit(em, resolve.kind, t, e.x, e.y, size, { rot: jitter(em, 0, Math.PI * 2), build: null });
        if (resolve.shake !== null) startShake(p.camera, t, feedback.shake[resolve.shake]);
        if (resolve.sound !== null) p.sound.request(resolve.sound, t);
        break;
      }
      case "hit":
        if (!p.anims.hit(e.target, t, feedback.hitLimitS)) break;
        hitInk(em, e.x, e.y, bodyHeight(content, e.targetDef), t);
        p.sound.request(feedback.sounds.hit, t);
        break;
      case "died": {
        const h = bodyHeight(content, e.def);
        deathInk(em, e.x, e.y, h, t);
        p.anims.died(e.id, e.def, e.x, e.y, t);
        p.sound.request(feedback.sounds.death, t);
        // Gold leaves only gold art: other roles die in plain ink.
        if (e.role !== "player" && feedback.bigDeathRoles.includes(e.role)) {
          goldFlakes(em, e.x, e.y, h, t, feedback.goldFlakes.count);
          startShake(p.camera, t, feedback.shake[feedback.bigDeathShake]);
          p.sound.request(feedback.sounds.bigDeath, t);
        }
        break;
      }
      case "cast":
        p.anims.cast(e.caster, t, e.ax, e.ay);
        if (e.team === "player" && content.sim.skills[e.skill].activation === "manual") {
          p.sound.request(feedback.sounds.cast, t);
          p.anims.thrust(e.caster, t);
        }
        break;
      case "spawnWarned":
        // The event's own tick, not the batch time t: a frame can run several ticks.
        p.warnings.warn(
          e.x,
          e.y,
          bodyHeight(content, e.def) / 2,
          tickSeconds(e.tick),
          tickSeconds(e.spawnTick),
        );
        break;
      case "playerHurt":
        startShake(p.camera, t, feedback.shake[feedback.playerHurtShake]);
        p.sound.request(feedback.sounds.playerHurt, t);
        break;
      default:
        break;
    }
  }
}
