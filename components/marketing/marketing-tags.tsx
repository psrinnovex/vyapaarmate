import Script from "next/script";
import { MarketingRuntime } from "@/components/marketing/marketing-runtime";

const gtmPattern = /^GTM-[A-Z0-9]+$/i;
const gaPattern = /^G-[A-Z0-9]+$/i;

function cleanEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function validId(value: string, pattern: RegExp) {
  return pattern.test(value) ? value : "";
}

export function MarketingTags() {
  const gtmId = validId(cleanEnv("NEXT_PUBLIC_GTM_ID"), gtmPattern);
  const gaMeasurementId = validId(cleanEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID"), gaPattern);
  const mode = gtmId ? "gtm" : gaMeasurementId ? "ga4" : "none";

  if (gtmId) {
    return (
      <>
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmId)});`
          }}
        />
        <noscript>
          <iframe
            title="Google Tag Manager"
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <MarketingRuntime mode={mode} />
      </>
    );
  }

  if (!gaMeasurementId) return <MarketingRuntime mode={mode} />;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaMeasurementId)},{send_page_view:false,anonymize_ip:true});`
        }}
      />
      <MarketingRuntime mode={mode} measurementId={gaMeasurementId} />
    </>
  );
}
