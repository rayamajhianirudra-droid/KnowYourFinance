// Copies the receipt-reading engine out of node_modules into public/ocr so
// the app serves it itself. That keeps receipt photos on the person's own
// device (nothing is fetched from a third-party CDN) and satisfies the
// content security policy, which only allows scripts from this site.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
const modules = join(root, "node_modules");

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const source = join(modules, from);
  if (!existsSync(source)) {
    throw new Error(`Missing ${from}. Run npm install first.`);
  }
  copyFileSync(source, join(out, to));
}
console.log(`Copied ${files.length} receipt reader files to public/ocr`);
