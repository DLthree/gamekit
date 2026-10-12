import type { BurstNode, DeliveryNode } from "@/content/schema/skill";
import { ACTOR_STAT_IDS, DAMAGE_TYPES, type StatMod } from "@/content/schema/vocab";
import type { SkillStatId } from "@/content/skill-stats";
import type { Content } from "@/content/types";
import { ticks } from "@/core/clock";

export type Push = (file: string, path: string, message: string) => void;

const ACTOR_STATS: readonly string[] = ACTOR_STAT_IDS;
const DAMAGE_TAGS: readonly string[] = DAMAGE_TYPES;

export function checkMods(mods: readonly StatMod[], file: string, path: string, push: Push): void {
  for (const [i, m] of mods.entries()) {
    if (ACTOR_STATS.includes(m.stat) && m.if.length > 0) {
      push(file, `${path}.${i}.if`, "actor stats take no tag condition");
    }
    if (m.stat === "damage" && m.op === "flat") {
      const types = m.if.filter((t) => DAMAGE_TAGS.includes(t));
      if (types.length !== 1) {
        push(file, `${path}.${i}.if`, "flat damage needs exactly one damage type tag");
      }
    }
  }
}

/** The stats each primitive reads, besides damage and knockback, which every skill has. */
const NEEDS: Record<DeliveryNode["do"], readonly SkillStatId[]> = {
  projectile: ["projectileSpeed", "projectileCount", "spread"],
  burst: ["area"],
  zone: ["area", "duration", "pulse"],
  // range is never optional (SkillStats), so only duration can actually be missing.
  dash: ["duration"],
};

/**
 * The vfx recipes that can draw each primitive. A dash has no vfx: it moves its owner, undrawn.
 * A warned burst is drawn by a telegraph, and only a warned burst is.
 */
const FITS: Record<Exclude<DeliveryNode["do"], "dash"> | "warned burst", readonly string[]> = {
  projectile: ["projectile", "none"],
  burst: ["explosion", "none"],
  "warned burst": ["telegraph"],
  zone: ["ground", "none"],
};

/** One problem in a delivery tree: a missing stat (by id) or a bad field at `path`. */
export interface TreeProblem {
  stat: SkillStatId | null;
  path: string;
  message: string;
}

/** A burst's placement and warning fields must agree, and a lane takes its length from range. */
function burstProblems(
  node: BurstNode,
  has: (stat: SkillStatId) => boolean,
  path: string,
): TreeProblem[] {
  const out: TreeProblem[] = [];
  if (node.shape.kind === "lane" && !has("range")) {
    out.push({ stat: "range", path, message: `required by the lane burst in ${path}` });
  }
  if (node.count > 1 && node.scatter <= 0) {
    out.push({
      stat: null,
      path: `${path}.scatter`,
      message: "a burst with count > 1 needs scatter > 0",
    });
  }
  if (node.warn > 0 && node.shape.kind === "arc") {
    out.push({
      stat: null,
      path: `${path}.shape`,
      message: "a warned burst is a circle or a lane",
    });
  }
  if (node.cancelOnOwnerDeath && node.warn <= 0) {
    out.push({
      stat: null,
      path: `${path}.cancelOnOwnerDeath`,
      message: "only a warned burst (warn > 0) can be cancelled",
    });
  }
  return out;
}

/**
 * A delivery tree's rules, for a skill file or for a build's merged tree: each node's stats
 * exist (`has`, i.e. hasSkillStat for that skill), its vfx exists with a recipe that can draw
 * that primitive, and (for zones, from `get`'s base file value) its duration and pulse are long
 * enough for the zone to pulse at least once before it ends.
 */
export function treeProblems(
  c: Content,
  node: DeliveryNode,
  has: (stat: SkillStatId) => boolean,
  get: (stat: SkillStatId) => number | undefined,
  path = "deliver",
): TreeProblem[] {
  const out: TreeProblem[] = [];
  for (const stat of NEEDS[node.do]) {
    if (!has(stat)) out.push({ stat, path, message: `required by the ${node.do} in ${path}` });
  }
  if (node.do === "projectile" && node.impact === "trigger" && has("pierce")) {
    out.push({
      stat: null,
      path: `${path}.impact`,
      message: "a trigger projectile ends on its first contact; it can't pierce",
    });
  }
  if (node.do === "burst") out.push(...burstProblems(node, has, path));
  if (node.do === "dash" && node.onEnd.length > 0) {
    out.push({
      stat: null,
      path: `${path}.onEnd`,
      message: "a dash has no end to hang children on (onEnd)",
    });
  }
  if (node.do === "zone") {
    const duration = get("duration");
    if (duration !== undefined && ticks(duration) < 2) {
      out.push({
        stat: "duration",
        path,
        message: `a zone's duration must be at least 2 ticks so it pulses before it ends (${ticks(duration)})`,
      });
    }
    const pulse = get("pulse");
    if (pulse !== undefined && ticks(pulse) < 1) {
      out.push({
        stat: "pulse",
        path,
        message: `a zone's pulse must be at least 1 tick (${ticks(pulse)})`,
      });
    }
  }
  if (node.do !== "dash") {
    if (!Object.hasOwn(c.look.fx.vfx, node.vfx)) {
      out.push({ stat: null, path: `${path}.vfx`, message: `no vfx ${node.vfx} in look/fx.json` });
    } else {
      const recipe = c.look.fx.vfx[node.vfx].recipe;
      const what = node.do === "burst" && node.warn > 0 ? "warned burst" : node.do;
      const fits = FITS[what];
      if (!fits.includes(recipe)) {
        const article = /^[aeiou]/.test(recipe) ? "an" : "a";
        out.push({
          stat: null,
          path: `${path}.vfx`,
          message: `${node.vfx} is ${article} ${recipe} recipe; a ${what} needs ${fits.join(" or ")}`,
        });
      }
    }
  }
  for (const [i, child] of node.onEnd.entries()) {
    out.push(...treeProblems(c, child, has, get, `${path}.onEnd.${i}`));
  }
  return out;
}
