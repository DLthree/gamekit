import type { Content } from "@/content/types";
import type { ActorAnims } from "@/present/anim/creatures";
import { drawMeshActor, drawMeshGhost, type MeshDraw, newMeshDraw } from "@/present/anim/mesh-pose";
import type { ActorInput } from "@/present/anim/pose";
import type { World } from "@/sim/world";

/**
 * Every creature's draw this frame, living ones in world order and then the death ghosts. Each
 * draw and its grid live as long as this object and are reused by index (a new def at an index
 * gets a new grid), because the renderer's Mesh2D keeps the grid's vertex array.
 */
export class ActorDraws {
  readonly draws: MeshDraw[] = [];
  /** The first `count` of `draws` are drawn this frame. */
  count = 0;
  private readonly input: ActorInput = {
    id: 0,
    def: "",
    x: 0,
    y: 0,
    facing: 1,
    moveX: 0,
    moveY: 0,
    isPlayer: false,
  };

  collect(content: Content, anims: ActorAnims, world: World, t: number): void {
    let m = 0;
    for (const a of world.actors.items) {
      // The sim never releases the player slot (src/sim/step.ts), so it stays `alive` after
      // death; skip it here too, or it's drawn standing under its own death ghost on a loss.
      if (!a.alive || a.hp <= 0) continue;
      const i = this.input;
      i.id = a.id;
      i.def = a.def;
      i.x = a.x;
      i.y = a.y;
      i.facing = a.facing;
      i.moveX = a.moveX;
      i.moveY = a.moveY;
      i.isPlayer = a.id === world.playerId;
      drawMeshActor(content, anims, i, t, this.slot(content, m, a.def));
      m += 1;
    }
    for (const g of anims.ghosts) {
      drawMeshGhost(content, g, t, this.slot(content, m, g.def));
      m += 1;
    }
    this.count = m;
  }

  private slot(content: Content, m: number, def: string): MeshDraw {
    if (this.draws.length <= m || this.draws[m].def !== def)
      this.draws[m] = newMeshDraw(content, def);
    return this.draws[m];
  }
}
