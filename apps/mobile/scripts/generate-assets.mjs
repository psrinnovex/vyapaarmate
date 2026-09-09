import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "assets", "brand");

await mkdir(output, { recursive: true });

const mark = ({ background = "#10261C", transparent = false, monochrome = false } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${transparent ? "" : `<rect width="1024" height="1024" fill="${background}"/>`}
  <circle cx="512" cy="512" r="330" fill="${monochrome ? "#FFFFFF" : "#F3F6EF"}"/>
  <path d="M300 326h118l101 286 105-286h112L570 716H455L300 326Z" fill="${monochrome ? "#000000" : "#10261C"}"/>
  <path d="M604 620c62-38 106-93 133-164l53 34c-34 91-92 158-174 203l-12-73Z" fill="${monochrome ? "#000000" : "#F29B3D"}"/>
  <circle cx="722" cy="318" r="49" fill="${monochrome ? "#000000" : "#F29B3D"}"/>
</svg>`;

const adaptive = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(154 154) scale(.7)">
    ${mark({ transparent: true }).replace(/<\/?svg[^>]*>/g, "")}
  </g>
</svg>`;

const monochrome = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(154 154) scale(.7)" fill="#FFFFFF">
    <circle cx="512" cy="512" r="330"/>
    <path fill-rule="evenodd" d="M300 326h118l101 286 105-286h112L570 716H455L300 326Zm304 294c62-38 106-93 133-164l53 34c-34 91-92 158-174 203l-12-73Z"/>
    <circle cx="722" cy="318" r="49"/>
  </g>
</svg>`;

await Promise.all([
  sharp(Buffer.from(mark())).png().toFile(path.join(output, "icon.png")),
  sharp(Buffer.from(adaptive)).png().toFile(path.join(output, "adaptive-foreground.png")),
  sharp(Buffer.from(monochrome)).png().toFile(path.join(output, "adaptive-monochrome.png")),
  sharp(Buffer.from(mark({ transparent: true }))).resize(600, 600).png().toFile(path.join(output, "splash.png")),
]);

console.log(`Generated VyapaarMate native assets in ${output}`);
