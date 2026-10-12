import type { Content } from "@/content/types";
import type { Push } from "@/realtime/content/check-tree";

/** Each stage actor names an enemy. (The game checks `from`: it owns its addresses.) */
export function checkStages(c: Content, push: Push): void {
  for (const [id, stage] of Object.entries(c.sim.stages)) {
    for (const [i, a] of stage.actors.entries()) {
      if (!Object.hasOwn(c.sim.enemies, a.enemy))
        push(`stages/${id}.json`, `actors.${i}.enemy`, `no enemy ${a.enemy}`);
    }
  }
}
