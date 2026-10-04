import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
await mkdir("public/pdfjs", { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(
    resolve("node_modules/pdfjs-dist", directory),
    resolve("public/pdfjs", directory),
    { recursive: true },
  );
}
await cp(
  resolve("node_modules/pdfjs-dist/LICENSE"),
  resolve("public/pdfjs/LICENSE"),
);
