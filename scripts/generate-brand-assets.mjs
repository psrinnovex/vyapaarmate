import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Preserve the supplied artwork. These are size/format variants for delivery.
await mkdir("public/brand", { recursive: true });
await mkdir("public/icons", { recursive: true });
for (const surface of ["light", "dark"]) {
  await sharp(`assets/brand/mark-on-${surface}.png`)
    .resize(256, 256).webp({ quality: 90 })
    .toFile(`public/brand/mark-on-${surface}.webp`);
}

async function icon(size, { surface = "light", maskable = false } = {}) {
  const contentSize = Math.round(size * (maskable ? 0.56 : 0.9));
  const mark = await sharp(`assets/brand/mark-on-${surface}.png`)
    .resize(contentSize, contentSize).png().toBuffer();
  return sharp({ create: {
    width: size, height: size, channels: 4,
    background: surface === "light" ? "#f8fbf7" : "#10261d"
  } }).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
}

for (const size of [192, 512]) {
  await writeFile(`public/icons/icon-${size}.png`, await icon(size));
}
await writeFile("public/icons/apple-touch-icon.png", await icon(180));
await writeFile("public/icons/icon-maskable-512.png", await icon(512, { maskable: true }));
const small = await icon(64);
const dark = await icon(64, { surface: "dark" });
await writeFile("public/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.dark{display:none}@media(prefers-color-scheme:dark){.light{display:none}.dark{display:block}}</style><image class="light" width="64" height="64" href="data:image/png;base64,${small.toString("base64")}"/><image class="dark" width="64" height="64" href="data:image/png;base64,${dark.toString("base64")}"/></svg>\n`);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 64;
header[7] = 64;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(small.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("public/favicon.ico", Buffer.concat([header, small]));
console.log("Generated theme-aware web marks, favicon, and install icons.");
