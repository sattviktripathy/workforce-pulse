import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildDataset } from "./normalize";
import type { NormalizedDataset } from "./types";

let cached: NormalizedDataset | null = null;

/** Loads + normalizes the two files once and caches the in-memory dataset.
 *  Server-only (filesystem access); reused by pages and the AI route. */
export async function getDataset(): Promise<NormalizedDataset> {
  if (cached) return cached;
  const dir = path.join(process.cwd(), "data");
  const [csv, json] = await Promise.all([
    readFile(path.join(dir, "activity_logs.csv"), "utf8"),
    readFile(path.join(dir, "employees.json"), "utf8"),
  ]);
  cached = buildDataset(csv, JSON.parse(json));
  return cached;
}
