#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const examples = join(root, "examples");
const dist = join(examples, "dist");
const failures = [];
const textFile = /\.(?:html|js|mjs|cjs|css|json|map|txt|xml|svg)$/;

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = join(path, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function valuesFromEnvFile(path) {
  if (!existsSync(path)) return [];
  const values = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!/(?:API_?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_?KEY)/i.test(key)) continue;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (value.length >= 8) values.push({ key, value, source: relative(root, path) });
  }
  return values;
}

function envFilesUnder(path, output = []) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const file = join(path, entry.name);
    if (entry.isDirectory()) {
      envFilesUnder(file, output);
      continue;
    }
    if (entry.name === ".env" || (entry.name.startsWith(".env.") && !entry.name.endsWith(".example"))) {
      output.push(file);
    }
  }
  return output;
}

const credentialPatterns = [
  { name: "OpenAI-style key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

if (!existsSync(dist)) {
  console.error("Public build check failed: examples/dist does not exist. Build the examples first.");
  process.exit(1);
}

const files = walk(dist).filter((file) => statSync(file).isFile() && textFile.test(file));
const artifacts = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));
const exampleEnvFiles = [".env", ".env.local", ".env.production", ".env.production.local"]
  .map((name) => join(examples, name));
const tutorialEnvFiles = envFilesUnder(join(examples, "tutorials"));
const envValues = [...exampleEnvFiles, ...tutorialEnvFiles].flatMap((path) => valuesFromEnvFile(path));

for (const secret of envValues) {
  for (const artifact of artifacts) {
    if (artifact.text.includes(secret.value)) {
      failures.push(`${relative(root, artifact.file)} embeds ${secret.key} from ${secret.source}`);
    }
  }
}

for (const artifact of artifacts) {
  for (const { name, pattern } of credentialPatterns) {
    if (pattern.test(artifact.text)) {
      failures.push(`${relative(root, artifact.file)} contains a credential-shaped value (${name})`);
    }
    pattern.lastIndex = 0;
  }
}

if (failures.length) {
  console.error("Public build check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("Values are intentionally omitted from this report.");
  process.exit(1);
}

console.log(`✓ Public build contains no detected credentials (${files.length} artifacts checked).`);
