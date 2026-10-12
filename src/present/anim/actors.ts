import type { Content } from "@/content/types";
import { type ActorAnims, creatureOf } from "@/present/anim/creatures";
import { drawMeshActor, type MeshDraw, newMeshDraw } from "@/present/anim/mesh-pose";
import {
  type ActorDraw,
  type ActorInput,
  drawActor,
  drawGhost,
  newActorDraw,
} from "@/present/anim/pose";
import type { World } from "@/sim/world";

/**
 * Every creature's draw this frame: flat images (fodder, death ghosts, creatures without a
 * bend) and the bent ones (the player, elites, bosses). Each mesh draw and its grid live as
 * long as this object and are reused by index, because the renderer's Mesh2D keeps the grid's
 * vertex array.
 */
export class ActorDraws {
  readonly flat: ActorDraw[] = [];
  count = 0;
  /** Live creatures with a mesh bend this frame, in world order; the first `meshCount` count. */
  readonly meshes: MeshDraw[] = [];
  meshCount = 0;
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
    let n = 0;
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
      if (creatureOf(content, a.def).mesh !== null) {
        if (this.meshes.length <= m || this.meshes[m].def !== a.def)
          this.meshes[m] = newMeshDraw(content, a.def);
        drawMeshActor(content, anims, i, t, this.meshes[m]);
        m += 1;
        continue;
      }
      if (this.flat.length <= n) this.flat.push(newActorDraw());
      drawActor(content, anims, i, t, this.flat[n]);
      n += 1;
    }
    this.meshCount = m;
    for (const g of anims.ghosts) {
      if (this.flat.length <= n) this.flat.push(newActorDraw());
      drawGhost(content, g, t, this.flat[n]);
      n += 1;
    }
    this.count = n;
  }
}
