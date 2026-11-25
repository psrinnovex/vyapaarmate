import { Image } from "expo-image";
import type { ImageStyle, StyleProp } from "react-native";

/**
 * 3D clay illustrations shared with the website (rendered from the same artwork as PNGs).
 * Static requires keep them bundled with the app.
 */
export const illustrationSources = {
  shop: require("../../assets/illustrations/shop.png"),
  phone: require("../../assets/illustrations/phone.png"),
  upi: require("../../assets/illustrations/upi.png"),
  tiffin: require("../../assets/illustrations/tiffin.png"),
  bowl: require("../../assets/illustrations/bowl.png"),
  cake: require("../../assets/illustrations/cake.png"),
  juice: require("../../assets/illustrations/juice.png"),
  salon: require("../../assets/illustrations/salon.png"),
  grocery: require("../../assets/illustrations/grocery.png"),
  chart: require("../../assets/illustrations/chart.png"),
  customers: require("../../assets/illustrations/customers.png"),
  bell: require("../../assets/illustrations/bell.png"),
  calendar: require("../../assets/illustrations/calendar.png"),
  empty: require("../../assets/illustrations/empty.png"),
  success: require("../../assets/illustrations/success.png"),
  shield: require("../../assets/illustrations/shield.png"),
  bag: require("../../assets/illustrations/bag.png"),
  rocket: require("../../assets/illustrations/rocket.png"),
} as const;

export type IllustrationName = keyof typeof illustrationSources;

export function Illustration({
  name,
  size = 96,
  style,
}: {
  name: IllustrationName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessible={false}
      source={illustrationSources[name]}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      transition={150}
    />
  );
}

/** Picks a fitting illustration for a business type (used where a business has no logo). */
export function illustrationForBusinessType(businessType: string | null | undefined): IllustrationName {
  const type = (businessType ?? "").toLowerCase();
  if (type.includes("tiffin")) return "tiffin";
  if (type.includes("bakery") || type.includes("sweet") || type.includes("cake")) return "cake";
  if (type.includes("juice") || type.includes("cafe") || type.includes("coffee")) return "juice";
  if (type.includes("salon") || type.includes("spa") || type.includes("beauty")) return "salon";
  if (type.includes("grocery") || type.includes("kirana") || type.includes("pharmacy") || type.includes("store")) return "grocery";
  if (type.includes("restaurant") || type.includes("kitchen") || type.includes("catering") || type.includes("food") || type.includes("hotel")) return "bowl";
  if (type.includes("laundry") || type.includes("tailor") || type.includes("service") || type.includes("fitness") || type.includes("yoga")) return "calendar";
  return "bag";
}
