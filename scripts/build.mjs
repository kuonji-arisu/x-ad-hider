import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const src = join(root, "src");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });

copyStatic("manifest.json");
copyStatic("icons/icon16.png");
copyStatic("icons/icon32.png");
copyStatic("icons/icon48.png");
copyStatic("icons/icon128.png");
copyStatic("ui/options/options.html");
copyStatic("ui/popup/popup.html");
copyStatic("ui/shared/ui.css");

await Promise.all([
  bundle({
    entry: "background/service-worker.ts",
    outfile: "background/service-worker.js",
    format: "esm"
  }),
  bundle({
    entry: "content/x-content.ts",
    outfile: "content/x-content.js",
    format: "iife"
  }),
  bundle({
    entry: "ui/options/options.ts",
    outfile: "ui/options/options.js",
    format: "esm"
  }),
  bundle({
    entry: "ui/popup/popup.ts",
    outfile: "ui/popup/popup.js",
    format: "esm"
  })
]);

function copyStatic(relativePath) {
  const source = join(src, relativePath);
  const target = join(dist, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function bundle({ entry, outfile, format }) {
  return build({
    entryPoints: [join(src, entry)],
    outfile: join(dist, outfile),
    bundle: true,
    format,
    target: "es2022",
    platform: "browser",
    sourcemap: false,
    minify: false,
    logLevel: "info"
  });
}
