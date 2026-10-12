import Phaser from "phaser";
import type { Content } from "@/content/types";
import type { Viewport } from "@/realtime/present/camera";
import { WorldScene } from "@/realtime/render/world-scene";

/** Starts Phaser (WebGL, device-pixel canvas, CSS zoom 1/dpr) and resolves once the atlas is in. */
export function bootRenderer(
  parent: HTMLElement,
  content: Content,
  view: Viewport,
): Promise<WorldScene> {
  return new Promise((resolve, reject) => {
    const scene = new WorldScene(content, resolve, reject);
    new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: view.width,
      height: view.height,
      banner: false,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / view.dpr },
      render: { antialias: true, roundPixels: false, powerPreference: "high-performance" },
      scene,
    });
  });
}
