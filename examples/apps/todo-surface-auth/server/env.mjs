import { readFileSync } from "node:fs";

/** Minimal .env loader so `pnpm dev` works without another dependency. */
export function loadEnvFiles(files) {
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().replace(/^export\s+/, "");
      if (!line || line.startsWith("#")) continue;
      const at = line.indexOf("=");
      if (at <= 0) continue;
      const key = line.slice(0, at).trim();
      const value = line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

export function csv(value) {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}
