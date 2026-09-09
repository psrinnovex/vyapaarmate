import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      "node_modules/**",
      "apps/mobile/**",
      ".npm-cache/**",
      "coverage/**",
      "dist/**",
      "package-lock.json",
      "*.tsbuildinfo"
    ]
  },
  ...nextVitals,
  ...nextTypescript
];

export default config;
