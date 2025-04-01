#!/usr/bin/env node

import { execSync } from "child_process";

// Define external packages to exclude from the bundle
const externalDeps = [
  // Node.js built-ins
  "fsevents", "chokidar", "events", "path", "fs", "util", "stream",
  "os", "assert", "url", "https", "http", "net", "tls", "crypto", "tty", "debug",

  // Dependencies
  "esbuild", "playwright", "expect", "dotenv", "otplib", "picocolors",
  "punycode", "mailosaur", "ai", "@ai-sdk/*", "@babel/*", "commander",
  "@netlify/framework-info", "normalize-package-data", "hosted-git-info", "glob",
  "simple-git", "globby", "listr2", "@inquirer/prompts", "@listr2/prompt-adapter-inquirer"
];

const cmd = [
  "esbuild src/cli/bin.ts",
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--outdir=dist/cli",
  "--metafile=dist/meta-cli.json",
  ...externalDeps.map(dep => `--external:${dep}`),
].join(" ");

try {
  console.log("Building CLI...");
  execSync(cmd, { stdio: "inherit" });
  console.log("CLI build completed successfully");
} catch (error) {
  console.error("CLI build failed:", error);
  process.exit(1);
}
