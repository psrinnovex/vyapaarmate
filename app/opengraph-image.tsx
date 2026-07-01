import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = "VyapaarMate direct local commerce dashboard";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#eef4f8",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
          padding: 64
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "2px solid #dbe5ec",
            borderRadius: 36,
            background: "#ffffff",
            padding: 56
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 82,
                height: 82,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 22,
                background: "#0f172a",
                color: "#ffffff",
                fontSize: 32,
                fontWeight: 800
              }}
            >
              VM
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 800 }}>{siteConfig.name}</div>
              <div style={{ color: "#10b981", fontSize: 22, fontWeight: 700 }}>PSHR INNOVEX PRIVATE LIMITED</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ maxWidth: 880, fontSize: 74, lineHeight: 0.96, fontWeight: 900 }}>
              Direct local commerce for Indian businesses
            </div>
            <div style={{ maxWidth: 900, color: "#475569", fontSize: 30, lineHeight: 1.35, fontWeight: 600 }}>
              Website orders, bookings, UPI QR payments, WhatsApp updates, CRM, campaigns, and owner dashboards.
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, color: "#0f172a", fontSize: 22, fontWeight: 800 }}>
            {["WhatsApp orders", "UPI QR", "CRM", "Campaigns", "Reports"].map((label) => (
              <div
                key={label}
                style={{
                  border: "1px solid #dbe5ec",
                  borderRadius: 999,
                  background: "#f8fafc",
                  padding: "12px 18px"
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
