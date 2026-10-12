import { phoneUrls } from "@scripts/phone";
import { describe, expect, it } from "vitest";
import { PHONE_QUERIES } from "@/game/links";

describe("phoneUrls", () => {
  it("puts each of the game's phone links on the LAN address, the bare one as /", () => {
    const urls = phoneUrls("192.168.1.20", 5282);
    expect(urls).toHaveLength(PHONE_QUERIES.length);
    expect(urls).toContain("http://192.168.1.20:5282/");
    for (const url of urls) expect(url.startsWith("http://192.168.1.20:5282/")).toBe(true);
    expect(urls.filter((u) => u.includes("?"))).toHaveLength(
      PHONE_QUERIES.filter((q) => q !== "").length,
    );
  });
});
