import type { Pin } from "@shared/schema";

export type DescMode = "auto" | "below" | "beside";

export function getPinDesc(pin: Pick<Pin, "descriptionFinal" | "descriptionAi" | "descriptionCustomInput">): string {
  return pin.descriptionFinal || pin.descriptionAi || pin.descriptionCustomInput || "";
}

export function isDescLong(pin: Parameters<typeof getPinDesc>[0], mode: DescMode = "auto"): boolean {
  const description = getPinDesc(pin);
  if (!description || mode === "below") return false;
  return mode === "beside" || description.length > 60;
}