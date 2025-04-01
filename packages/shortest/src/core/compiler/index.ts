import { mkdirSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, basename } from "path";
import { build, BuildOptions } from "esbuild";
import { ConfigError } from "@/utils/errors";

export class TestCompiler {
  private cacheDir: string;
  private defaultOptions: BuildOptions = {
    format: "esm",
    platform: "node",
    target: "node18",
    sourcemap: true,
    bundle: true,
    external: [
      "shortest",
      "fs",
      "path",
      "os",
      "util",
      "events",
      "stream",
      "assert",
      "url",
      "crypto",
      "buffer",
      "querystring",
      "fsevents",
    ],
    banner: {
      js: `
        import { fileURLToPath } from 'url';
        import { dirname } from 'path';
        import { createRequire } from 'module';

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const require = createRequire(import.meta.url);
      `,
    },
  };

  constructor() {
    this.cacheDir = join(tmpdir(), "shortest-cache");
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async compileFile(filePath: string): Promise<string> {
    const fileName = basename(filePath).replace(".ts", ".mjs");
    const outputPath = join(this.cacheDir, fileName);

    const packageJson = {
      type: "module",
      imports: {
        shortest: resolve(process.cwd(), "packages/shortest/src/index.ts"),
      },
    };
    writeFileSync(
      join(this.cacheDir, "package.json"),
      JSON.stringify(packageJson),
    );

    await build({
      ...this.defaultOptions,
      entryPoints: [filePath],
      outfile: outputPath,
      alias: {
        shortest: resolve(process.cwd(), "packages/shortest/src/index.ts"),
      },
      resolveExtensions: [".ts", ".js", ".mjs"],
      banner: {
        js: `
          import { fileURLToPath } from 'url';
          import { dirname } from 'path';
          import { createRequire } from 'module';

          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          const require = createRequire(import.meta.url);
        `,
      },
    });

    return outputPath;
  }

  async loadModule(filePath: string, cwd: string) {
    const absolutePath = resolve(cwd, filePath);

    if (!existsSync(absolutePath)) {
      throw new ConfigError(
        "file-not-found",
        `Config file not found: ${filePath}`,
      );
    }

    const result = await build({
      ...this.defaultOptions,
      entryPoints: [absolutePath],
      write: false,
      external: ["shortest"],
    });

    const code = result.outputFiles[0].text;
    const tempFile = join(this.cacheDir, "config.mjs");
    writeFileSync(tempFile, code);
    return import(`file://${tempFile}`);
  }
}
