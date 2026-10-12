import { burst } from "@/realtime/sim/skills/primitives/burst";
import { dash } from "@/realtime/sim/skills/primitives/dash";
import { projectile } from "@/realtime/sim/skills/primitives/projectile";
import { zone } from "@/realtime/sim/skills/primitives/zone";
import type { Delivery, World } from "@/realtime/sim/world";

export function deliver(world: World, d: Delivery): void {
  const node = d.node;
  switch (node.do) {
    case "projectile":
      projectile(world, d, node);
      break;
    case "burst":
      burst(world, d, node);
      break;
    case "zone":
      zone(world, d, node);
      break;
    case "dash":
      dash(world, d);
      break;
  }
}

/** Phase 3: this tick's casts and last tick's ended volumes' children become queued volumes. */
export function activate(world: World): void {
  for (const d of world.deliveries) deliver(world, d);
  world.deliveries.length = 0;
}
