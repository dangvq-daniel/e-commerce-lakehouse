import { cpSync, existsSync, mkdirSync } from "node:fs";

const standaloneDirectory = new URL("../.next/standalone/", import.meta.url);
const standaloneNextDirectory = new URL("../.next/standalone/.next/", import.meta.url);
const publicDirectory = new URL("../public/", import.meta.url);
const staticDirectory = new URL("../.next/static/", import.meta.url);

if (!existsSync(standaloneDirectory)) {
  throw new Error("Next.js standalone output was not generated");
}

mkdirSync(standaloneNextDirectory, { recursive: true });
cpSync(publicDirectory, new URL("public/", standaloneDirectory), {
  recursive: true,
  force: true,
});
cpSync(staticDirectory, new URL("static/", standaloneNextDirectory), {
  recursive: true,
  force: true,
});

console.log("Copied public and static assets into the standalone server bundle");
