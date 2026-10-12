import { checkMods, type Push, type TreeProblem, treeProblems } from "@/content/check-tree";
import { type AppliedModifier, applyTags, mergeSkill, nodesOf } from "@/content/loadout";
import { type DeliveryNode, PRIMITIVE_KINDS, type Skill } from "@/content/schema/skill";
import { ACTOR_STAT_IDS, SlotId, type StatMod, type Tag } from "@/content/schema/vocab";
import { hasSkillStat, type SkillStatId } from "@/content/skill-stats";
import type { Content } from "@/content/types";
import { enemyTemplates, playerSkills, tunnellingProblem } from "@/game/loadout";
import type { BuildTier, SlotLoadout } from "@/game/schema/build";

const ACTOR_STATS: readonly string[] = ACTOR_STAT_IDS;

/** The primitive kinds a tree has at least one node of. */
function kindsOf(root: DeliveryNode): Set<string> {
  return new Set(PRIMITIVE_KINDS.filter((k) => nodesOf(root, k).length > 0));
}

/**
 * A slot's modifiers in order: each exists, is not repeated, finds the tags it requires
 * (including tags earlier modifiers added), attaches only to kinds the tree has when it applies
 * (including nodes earlier modifiers attached), sets a multishot pattern only on a tree with a
 * projectile and only if no earlier modifier set another. Null after reporting a problem.
 */
function slotModifiers(
  c: Content,
  skillId: string,
  skill: Skill,
  entry: SlotLoadout,
  file: string,
  at: string,
  push: Push,
): AppliedModifier[] | null {
  const applied: AppliedModifier[] = [];
  let tags: Tag[] = [...skill.tags];
  let ok = true;
  for (const [i, id] of entry.modifiers.entries()) {
    const path = `${at}.modifiers.${i}`;
    if (entry.modifiers.indexOf(id) !== i) {
      push(file, path, `${id} is already on ${skillId}; a modifier doesn't stack with itself`);
      ok = false;
      continue;
    }
    const def = c.sim.modifiers[id];
    if (def === undefined) {
      push(file, path, `no modifier ${id}`);
      ok = false;
      continue;
    }
    const missing = def.requires.filter((t) => !tags.includes(t));
    if (missing.length > 0) {
      push(
        file,
        path,
        `${id} requires ${missing.join(", ")}; ${skillId} has ${tags.join(", ")} here`,
      );
      ok = false;
    }
    const pattern = def.multishot;
    const other = applied.find((m) => m.def.multishot !== undefined);
    if (pattern !== undefined && other !== undefined && other.def.multishot !== pattern) {
      push(
        file,
        path,
        `${id} sets multishot ${pattern} but ${other.id} sets ${other.def.multishot} on ${skillId}; one pattern per skill`,
      );
      ok = false;
    }
    // Attachments go under the nodes that exist before this modifier (see mergeSkill).
    const kinds = kindsOf(mergeSkill(skillId, skill, applied, {}).deliver);
    for (const a of def.attach) {
      if (!kinds.has(a.to)) {
        push(file, path, `${id} attaches to ${a.to}; ${skillId} has no ${a.to} here`);
        ok = false;
      }
    }
    if (pattern !== undefined && !kinds.has("projectile")) {
      push(file, path, `${id} sets multishot ${pattern}; ${skillId} has no projectile here`);
      ok = false;
    }
    tags = applyTags(tags, def);
    applied.push({ id, def });
  }
  return ok ? applied : null;
}

/**
 * The merged tree must still be a valid tree, and each modifier look must find its kind; returns
 * the kinds of node the tree contains. Problems the skill file's own tree already has are left to
 * the skill file's check, so each is reported once.
 */
function checkMerged(
  c: Content,
  skillId: string,
  skill: Skill,
  applied: readonly AppliedModifier[],
  tier: BuildTier,
  file: string,
  at: string,
  push: Push,
): Set<string> {
  const merged = mergeSkill(skillId, skill, applied, tier.look);
  const lines: StatMod[] = [...merged.mods.map((m) => m.mod), ...tier.stats];
  const has = (stat: SkillStatId) => hasSkillStat(skill.stats, stat, lines, merged.tags);
  // As in the skill-file check: the file's base value. Lines can't take the resolved stat below
  // the zone floor: STAT_CLAMPS' minimums meet it (src/sim/stats/resolve.test.ts).
  const get = (stat: SkillStatId) => skill.stats[stat];
  const key = (p: TreeProblem) => `${p.stat}|${p.path}|${p.message}`;
  const baseHas = (stat: SkillStatId) => hasSkillStat(skill.stats, stat, [], skill.tags);
  const own = new Set(treeProblems(c, skill.deliver, baseHas, get).map(key));
  for (const p of treeProblems(c, merged.deliver, has, get)) {
    if (own.has(key(p))) continue;
    const what = p.stat === null ? `${p.path}: ${p.message}` : `stats.${p.stat} ${p.message}`;
    push(file, at, `${skillId} with its modifiers: ${what}`);
  }
  if (nodesOf(merged.deliver, "burst").some((n) => n.warn > 0)) {
    push(file, at, `${skillId} has a warned burst; telegraphs are enemy-only`);
  }
  const kinds = kindsOf(merged.deliver);
  // slotModifiers returns only when every modifier is valid, so applied[i] is modifiers.i.
  for (const [i, m] of applied.entries()) {
    for (const kind of Object.keys(m.def.look)) {
      if (!kinds.has(kind)) {
        push(
          file,
          `${at}.modifiers.${i}`,
          `${m.id} swaps the ${kind} vfx; ${skillId} has no ${kind} in this tier`,
        );
      }
    }
  }
  return kinds;
}

export function checkBuilds(c: Content, push: Push): void {
  const { builds, characters, skills } = c.sim;
  for (const [id, build] of Object.entries(builds)) {
    const file = `builds/${id}.json`;
    if (build.character !== id)
      push(file, "character", `a build file is named after its character (${id})`);
    const character = characters[build.character];
    if (character === undefined) {
      push(file, "character", `no character ${build.character}`);
      continue;
    }
    for (const [t, tier] of build.tiers.entries()) {
      const at = `tiers.${t}`;
      /** Skill id → the kinds of node its merged tree has (for the tier's look keys). */
      const kinds = new Map<string, Set<string>>();
      for (const slot of character.slots) {
        const entry = tier.loadout[slot.id];
        const where = `${at}.loadout.${slot.id}`;
        if (entry === undefined) {
          push(file, where, `slot ${slot.id} needs a skill`);
          continue;
        }
        const skill = skills[entry.skill];
        if (skill === undefined) {
          push(file, `${where}.skill`, `no skill ${entry.skill}`);
          continue;
        }
        if (skill.activation !== slot.activation) {
          push(
            file,
            `${where}.skill`,
            `${entry.skill} is ${skill.activation}, slot ${slot.id} is ${slot.activation}`,
          );
          continue;
        }
        if (skill.target === "player") {
          push(file, `${where}.skill`, `${entry.skill} is an enemy skill`);
          continue;
        }
        const applied = slotModifiers(c, entry.skill, skill, entry, file, where, push);
        if (applied === null) continue;
        kinds.set(
          entry.skill,
          checkMerged(c, entry.skill, skill, applied, tier, file, where, push),
        );
      }
      for (const slotId of Object.keys(tier.loadout)) {
        if (!character.slots.some((s) => s.id === slotId)) {
          push(file, `${at}.loadout.${slotId}`, `${build.character} has no slot ${slotId}`);
        }
      }
      for (const key of Object.keys(tier.look)) {
        const dot = key.lastIndexOf(".");
        const skillId = key.slice(0, dot);
        const kind = key.slice(dot + 1);
        const inTier = SlotId.options.some((s) => tier.loadout[s]?.skill === skillId);
        if (!inTier) push(file, `${at}.look.${key}`, `no ${skillId} in this tier's loadout`);
        else if (kinds.get(skillId)?.has(kind) === false)
          push(file, `${at}.look.${key}`, `${skillId} has no ${kind} in this tier`);
      }
      checkMods(tier.stats, file, `${at}.stats`, push);
    }
  }
  for (const id of Object.keys(characters)) {
    if (!Object.hasOwn(builds, id)) push(`characters/${id}.json`, "", `no builds/${id}.json`);
  }
}

/** Modifier files: StatMods that make sense on one skill, and every modifier used by a build. */
export function checkModifiers(c: Content, push: Push): void {
  const used = new Set<string>();
  for (const build of Object.values(c.sim.builds)) {
    for (const tier of build.tiers) {
      for (const slot of SlotId.options) {
        // A slot may be empty in the schema; checkBuilds reports that.
        const entry = tier.loadout[slot];
        if (entry !== undefined) for (const id of entry.modifiers) used.add(id);
      }
    }
  }
  for (const [id, m] of Object.entries(c.sim.modifiers)) {
    const file = `modifiers/${id}.json`;
    checkMods(m.stats, file, "stats", push);
    for (const field of ["requires", "addTags", "removeTags"] as const) {
      for (const [i, tag] of m[field].entries()) {
        if (m[field].indexOf(tag) !== i) push(file, `${field}.${i}`, `${tag} is listed twice`);
      }
    }
    for (const [i, tag] of m.addTags.entries()) {
      if (m.removeTags.includes(tag)) push(file, `addTags.${i}`, `${tag} is also in removeTags`);
    }
    for (const [i, mod] of m.stats.entries()) {
      if (ACTOR_STATS.includes(mod.stat)) {
        push(
          file,
          `stats.${i}.stat`,
          `${mod.stat} is an actor stat; a modifier changes one skill (put it in a build tier's stats)`,
        );
      }
    }
    if (!used.has(id)) push(file, "", "no build uses it");
  }
}

/**
 * Every build tier against every threat: no player projectile may step past an enemy between
 * hit tests (tunnellingProblem, which createWorld asserts). It resolves skills and enemies as
 * the sim does, so it runs only on content every other check accepted.
 */
export function checkProjectileSteps(c: Content, push: Push): void {
  for (const [id, build] of Object.entries(c.sim.builds)) {
    for (const [t, tier] of build.tiers.entries()) {
      const source = `builds/${id}.json tier ${t + 1}`;
      const buildMods = tier.stats.map((mod) => ({ mod, source }));
      const skills = playerSkills(c.sim, id, t + 1, buildMods, source);
      for (const [threatId, threat] of Object.entries(c.sim.threats)) {
        const threatSource = `threats/${threatId}.json`;
        const enemyMods = threat.enemyMods.map((mod) => ({ mod, source: threatSource }));
        const problem = tunnellingProblem(skills, enemyTemplates(c.sim, enemyMods));
        if (problem !== null)
          push(`builds/${id}.json`, `tiers.${t}`, `against ${threatId}: ${problem}`);
      }
    }
  }
}
