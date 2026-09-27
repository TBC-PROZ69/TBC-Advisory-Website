import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function persistSubmission(
  id: string,
  payload: unknown,
): Promise<{ store: "file" | "none"; key?: string }> {
  const json = JSON.stringify(payload, null, 2);
  const dirs = [
    path.join(process.cwd(), "submissions"),
    path.join("/tmp", "tbc-assess-submissions"),
  ];

  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${id}.json`);
      await writeFile(file, json, "utf8");
      return { store: "file", key: file };
    } catch (error) {
      console.error(`Assess persist failed for ${dir}`, error);
    }
  }

  return { store: "none" };
}
