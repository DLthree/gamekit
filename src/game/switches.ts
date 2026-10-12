import type { Switch } from "@/content/switches";

/** The example game's feature switches (`on=`): each is off unless the address turns it on. */
export const SWITCHES = {
  throwers: {
    about: "the stone-throwing enemy joins the threat tiers' spawns",
    cut(sim) {
      for (const threat of Object.values(sim.threats))
        threat.spawns = threat.spawns.filter((s) => s.enemy !== "thrower");
    },
  },
} satisfies Record<string, Switch>;
