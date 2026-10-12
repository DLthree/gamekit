import type { Modifier } from "@/content/schema/modifier";
import {
  type DeliveryNode,
  LOOK_KINDS,
  type LookKind,
  type Multishot,
  type PrimitiveKind,
  type Skill,
} from "@/content/schema/skill";
import type { SourcedMod, Tag } from "@/content/schema/vocab";

export interface AppliedModifier {
  id: string;
  def: Modifier;
}

/** A skill with its modifiers applied: final tags, the merged tree, skill-local StatMods. */
export interface MergedSkill {
  id: string;
  def: Skill;
  tags: readonly Tag[];
  deliver: DeliveryNode;
  mods: readonly SourcedMod[];
}

export function applyTags(tags: readonly Tag[], m: Modifier): Tag[] {
  const out = tags.filter((t) => !m.removeTags.includes(t));
  for (const t of m.addTags) if (!out.includes(t)) out.push(t);
  return out;
}

type NodeOfKind<K extends PrimitiveKind> = Extract<DeliveryNode, { do: K }>;

/** Every node of one primitive kind in a tree, parents before children, narrowed to that kind. */
export function nodesOf<K extends PrimitiveKind>(root: DeliveryNode, kind: K): NodeOfKind<K>[] {
  const out: NodeOfKind<K>[] = [];
  const walk = (n: DeliveryNode) => {
    if (n.do === kind) out.push(n as NodeOfKind<K>);
    for (const child of n.onEnd) walk(child);
  };
  walk(root);
  return out;
}

/** The tier `look` key for one kind of node in one skill: "fire-bolt.projectile". */
export function lookKey(skill: string, kind: LookKind): string {
  return `${skill}.${kind}`;
}

/**
 * A skill as a loadout slot runs it. Modifiers apply in order. Each one's attachments go under
 * the nodes that existed before it (so an attached burst doesn't receive its own modifier's
 * burst again). A modifier's multishot pattern goes on every projectile node; two modifiers with
 * different patterns are an error (the content check reports it). Then vfx are swapped by kind: modifier looks in order, the tier's look last.
 * The content is never mutated: the tree is a copy.
 */
export function mergeSkill(
  id: string,
  def: Skill,
  modifiers: readonly AppliedModifier[],
  tierLook: Readonly<Record<string, string>>,
): MergedSkill {
  const deliver = structuredClone(def.deliver);
  let tags: Tag[] = [...def.tags];
  const mods: SourcedMod[] = [];
  const looks: Partial<Record<LookKind, string>> = {};
  let multishot: { by: string; pattern: Multishot } | null = null;
  for (const m of modifiers) {
    const pattern = m.def.multishot;
    if (pattern !== undefined) {
      if (multishot !== null && multishot.pattern !== pattern) {
        throw new Error(
          `${id}: ${multishot.by} sets multishot ${multishot.pattern}, ${m.id} sets ${pattern}`,
        );
      }
      multishot = { by: m.id, pattern };
    }
    tags = applyTags(tags, m.def);
    for (const mod of m.def.stats) mods.push({ mod, source: `modifiers/${m.id}.json` });
    const targets = m.def.attach.map((a) => nodesOf(deliver, a.to));
    for (const [i, a] of m.def.attach.entries()) {
      for (const node of targets[i]) {
        const action = structuredClone(a.action);
        if (a.chance !== undefined) action.chance = a.chance;
        node.onEnd.push(action);
      }
    }
    Object.assign(looks, m.def.look);
  }
  if (multishot !== null) {
    for (const node of nodesOf(deliver, "projectile")) node.multishot = multishot.pattern;
  }
  for (const kind of LOOK_KINDS) {
    const key = lookKey(id, kind);
    const vfx = Object.hasOwn(tierLook, key) ? tierLook[key] : looks[kind];
    if (vfx === undefined) continue;
    for (const node of nodesOf(deliver, kind)) node.vfx = vfx;
  }
  return { id, def, tags, deliver, mods };
}
