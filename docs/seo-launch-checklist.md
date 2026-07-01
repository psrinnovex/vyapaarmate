# VyapaarMate Search and Analytics Launch

The application-side SEO is already deployed at `https://vyapaarmate.com`. The remaining setup uses account-issued values that must come from the site owner's Google and Microsoft accounts.

## 1. Verify Google Search Console

Use a **Domain property** because it covers HTTP/HTTPS and all subdomains.

1. Open `https://search.google.com/search-console` and choose **Add property**.
2. Select **Domain**, enter `vyapaarmate.com`, and copy Google's TXT record value.
3. In Hostinger hPanel, open the domain's DNS Zone Editor.
4. Add a TXT record with host/name `@`, Google's full `google-site-verification=...` value, and the default TTL.
5. Return to Search Console and select **Verify** after DNS propagation.
6. Open **Sitemaps**, enter `sitemap.xml`, and submit it.

Do not put this DNS verification token in Vercel. The TXT record should remain in DNS after verification.

## 2. Configure Bing Webmaster Tools

1. Open `https://www.bing.com/webmasters` and sign in.
2. Use **Import from Google Search Console** after Google verification. This is simpler than maintaining a second verification method.
3. Confirm `https://vyapaarmate.com/sitemap.xml` is listed, or submit it in the Sitemaps section.

If import is unavailable, add `vyapaarmate.com` directly and use Bing's DNS TXT verification option in the same Hostinger DNS Zone Editor.

## 3. Create Direct GA4 Tracking

GTM is unnecessary until the business needs multiple owned marketing tags. Do not add advertising pixels unless the business explicitly chooses paid ads later.

1. Open `https://analytics.google.com` and create a GA4 property for **VyapaarMate**.
2. Create a Web data stream with URL `https://vyapaarmate.com` and stream name `VyapaarMate Production`.
3. Copy the Measurement ID beginning with `G-`.
4. In Vercel, open project **vyapaarmate** > **Settings** > **Environment Variables**.
5. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` with the `G-...` value for **Production**.
6. Redeploy the latest production deployment.
7. Visit the website, then confirm the visit under GA4 **Reports > Realtime**.

The app sends only owned measurement events: `page_view`, `cta_click`, `generate_lead`, registration events, selected subscription plan, and Core Web Vitals. UTM parameters and external referrer host are kept in session storage and attached to these events. The payloads intentionally avoid names, phone numbers, emails, and free-form messages.

## 4. Verify Production

Run:

```bash
npm run seo:check -- https://vyapaarmate.com
```

The audit should pass. Verification-tag warnings are expected when Search Console and Bing use DNS verification.
