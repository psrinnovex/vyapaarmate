import { resolveTxt } from "node:dns/promises";

const requestedOrigin = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://www.vyapaarmate.com";

let origin;
try {
  origin = new URL(requestedOrigin).origin;
} catch {
  console.error("ERROR: Pass a valid HTTPS origin, for example https://www.vyapaarmate.com.");
  process.exit(1);
}

const errors = [];
const warnings = [];
const passed = [];

async function read(path) {
  const response = await fetch(new URL(path, origin), {
    headers: { "user-agent": "VyapaarMate production SEO audit" },
    redirect: "follow"
  });
  const body = await response.text();

  if (!response.ok) errors.push(`${path} returned HTTP ${response.status}.`);
  return { response, body };
}

function expect(body, pattern, success, failure) {
  if (pattern.test(body)) passed.push(success);
  else errors.push(failure);
}

const [{ body: home }, { body: robots }, { body: sitemap }] = await Promise.all([
  read("/"),
  read("/robots.txt"),
  read("/sitemap.xml")
]);
let dnsRecords = [];
try {
  dnsRecords = (await resolveTxt(new URL(origin).hostname)).map((parts) => parts.join(""));
} catch {
  warnings.push("Could not read public DNS TXT records during this audit.");
}

const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

expect(
  home,
  new RegExp(`<link rel="canonical" href="${escapedOrigin}/?"`),
  "Homepage canonical URL is correct.",
  "Homepage canonical URL is missing or points to another origin."
);
expect(home, /<meta name="robots" content="index, follow"/, "Homepage is indexable.", "Homepage is not indexable.");
expect(home, /<meta property="og:image" content="https:\/\//, "Open Graph image is configured.", "Open Graph image is missing.");
expect(home, /<meta name="twitter:card" content="summary_large_image"/, "Twitter large-card metadata is configured.", "Twitter large-card metadata is missing.");
expect(home, /"@type":"Organization"/, "Organization structured data is present.", "Organization structured data is missing.");
expect(home, /"@type":"WebPage"/, "WebPage structured data is present.", "WebPage structured data is missing.");
expect(home, /"@type":"SoftwareApplication"/, "SoftwareApplication structured data is present.", "SoftwareApplication structured data is missing.");
expect(home, /"@type":"FAQPage"/, "FAQ structured data is present.", "FAQ structured data is missing.");
expect(
  robots,
  new RegExp(`Sitemap: ${escapedOrigin}/sitemap\\.xml`),
  "robots.txt advertises the production sitemap.",
  "robots.txt does not advertise the expected production sitemap."
);
for (const privatePath of ["/admin", "/dashboard", "/user", "/support", "/api/"]) {
  expect(
    robots,
    new RegExp(`Disallow: ${privatePath.replace("/", "\\/")}`),
    `robots.txt blocks ${privatePath}.`,
    `robots.txt does not block ${privatePath}.`
  );
}
expect(
  sitemap,
  new RegExp(`<loc>${escapedOrigin}/</loc>`),
  "Sitemap contains the production homepage.",
  "Sitemap does not contain the production homepage."
);
expect(sitemap, /<image:image>/, "Sitemap includes image entries.", "Sitemap image entries are missing.");

if (/localhost|127\.0\.0\.1/.test(`${home}${robots}${sitemap}`)) {
  errors.push("Production SEO output contains a localhost URL.");
} else {
  passed.push("Production SEO output contains no localhost URLs.");
}

if (/\/b\/(sri-sai-tiffins|fresh-bowl-cloud-kitchen|sweet-cravings-home-bakery)/.test(sitemap)) {
  errors.push("Production sitemap contains demo business URLs.");
} else {
  passed.push("Production sitemap does not contain demo business URLs.");
}

if (/google-site-verification/.test(home)) {
  passed.push("Google HTML verification tag is present.");
} else if (dnsRecords.some((record) => record.startsWith("google-site-verification="))) {
  passed.push("Google Search Console DNS verification record is present.");
} else {
  warnings.push("No Google HTML or DNS verification record was found.");
}
if (!/msvalidate\.01/.test(home)) {
  warnings.push("No Bing HTML verification tag found. Importing the verified Google property is recommended.");
}
if (!/googletagmanager\.com\/(gtag\/js|gtm\.js)/.test(home)) {
  warnings.push("GA4/GTM is not rendered. Add NEXT_PUBLIC_GA_MEASUREMENT_ID or NEXT_PUBLIC_GTM_ID in Vercel and redeploy.");
}

for (const item of passed) console.log(`PASS: ${item}`);
for (const item of warnings) console.warn(`WARNING: ${item}`);
for (const item of errors) console.error(`ERROR: ${item}`);

if (errors.length) process.exitCode = 1;
else console.log(`SEO audit passed for ${origin}.`);
