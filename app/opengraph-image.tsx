import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { launchMarket, launchOffer } from "@/lib/launch-policy";

export const alt = `VyapaarMate ${launchMarket.displayName} launch for local businesses`;
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

// Marigold Bazaar palette (see the VyapaarMate design system).
const ink = "#0b0d0b";
const green = "#1ec926";
const greenDeep = "#0b7a10";
const marigold = "#f2a20c";
const marigoldSoft = "#fdebc4";
const ivory = "#faf7f0";
const sand = "#e6dfcf";

export default async function OpenGraphImage() {
  const [logo, poppinsBold, interSemiBold] = await Promise.all([
    readFile(join(process.cwd(), "public/icons/icon-192.png")),
    readFile(join(process.cwd(), "app/fonts/Poppins-Bold.woff")),
    readFile(join(process.cwd(), "app/fonts/Inter-SemiBold.woff"))
  ]);
  const chips = [launchOffer.publiclyAdvertised ? "80% launch discount" : "Monthly plans", "UPI QR", "WhatsApp updates", "Bookings", "CRM"];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ivory, color: ink, fontFamily: "Inter", padding: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 660, paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* next/og renders this server-side PNG directly. */}
            <img alt="" width={64} height={64} style={{ borderRadius: 18 }} src={`data:image/png;base64,${logo.toString("base64")}`} />
            <div style={{ display: "flex", fontFamily: "Poppins", fontSize: 34 }}>
              <span>Vyapaar</span>
              <span style={{ color: greenDeep }}>Mate</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 10,
                background: marigold,
                color: ink,
                fontSize: 18,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                padding: "10px 18px 10px 16px",
                borderRadius: 10,
                transform: "rotate(-2deg)"
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 9, background: ivory }} />
              Now onboarding · {launchMarket.displayName}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontFamily: "Poppins", fontSize: 82, lineHeight: 1, letterSpacing: -3 }}>
              <span>Take orders.</span>
              <div style={{ display: "flex", marginTop: 6 }}>
                <span>Get paid.&nbsp;</span>
                <span style={{ background: `linear-gradient(180deg, transparent 56%, ${marigoldSoft} 56%, ${marigoldSoft} 94%, transparent 94%)` }}>Grow.</span>
              </div>
            </div>
            <div style={{ marginTop: 22, fontSize: 26, lineHeight: 1.4, color: "#4b4a43" }}>
              Your own shop link, UPI payments and WhatsApp updates in one simple app.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {chips.map((label) => (
              <div key={label} style={{ display: "flex", border: `1px solid ${sand}`, borderRadius: 999, background: "#ffffff", padding: "9px 16px", fontSize: 18 }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* A shopfront: green-and-white awning over a black storefront with a paid order ticket. */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 36, overflow: "hidden", background: ink, boxShadow: "0 40px 70px -34px rgba(84,58,18,0.48)" }}>
          <div style={{ display: "flex", height: 44 }}>
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                style={{ flex: 1, height: 44, background: index % 2 === 0 ? green : "#ffffff", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "34px 34px 36px", color: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: "#b3ada1" }}>
              <div style={{ width: 12, height: 12, borderRadius: 12, background: green }} />
              Lakshmi Tiffins · Open now
            </div>
            <div style={{ display: "flex", marginTop: 14, fontFamily: "Poppins", fontSize: 40, letterSpacing: -1 }}>New order #VM-2051</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", borderRadius: 26, background: "#ffffff", color: ink, padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#625f57" }}>
                <span>2 × Idli Vada</span>
                <span>₹120</span>
              </div>
              <div style={{ display: "flex", borderTop: `2px dashed ${sand}`, margin: "16px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Poppins", fontSize: 38 }}>₹120.00</span>
                <span style={{ display: "flex", borderRadius: 14, background: green, color: ink, padding: "10px 16px", fontSize: 20, boxShadow: `0 4px 0 ${greenDeep}` }}>Paid by UPI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Poppins", data: poppinsBold, weight: 700, style: "normal" },
        { name: "Inter", data: interSemiBold, weight: 600, style: "normal" }
      ]
    }
  );
}
