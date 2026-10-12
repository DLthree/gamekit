import type { Push } from "@/content/check-tree";
import type { Stage } from "@/content/schema/stage";
import type { Content, SimContent } from "@/content/types";

/** The stage `id`, or a throw naming the stages there are. */
export function stageOf(content: SimContent, id: string): Stage {
  const stage = content.stages[id];
  if (stage === undefined)
    throw new Error(
      `no stage ${id}; content/stages has ${Object.keys(content.stages).join(", ") || "none"}`,
    );
  return stage;
}

/** Each stage actor names an enemy. (The game checks `from`: it owns its addresses.) */
export function checkStages(c: Content, push: Push): void {
  for (const [id, stage] of Object.entries(c.sim.stages)) {
    for (const [i, a] of stage.actors.entries()) {
      if (!Object.hasOwn(c.sim.enemies, a.enemy))
        push(`stages/${id}.json`, `actors.${i}.enemy`, `no enemy ${a.enemy}`);
    }
  }
}
