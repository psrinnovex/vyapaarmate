import { forwardRef, type ComponentType } from "react";
import * as Iconsax from "iconsax-react";
import type { IconProps as IconsaxIconProps, Icon as RawIconsaxIcon } from "iconsax-react";

export type IconProps = Omit<IconsaxIconProps, "ref">;
export type Icon = ComponentType<IconProps>;

function withIconDefaults(Component: RawIconsaxIcon, displayName: string): Icon {
  const IconWithDefaults = forwardRef<SVGSVGElement, IconProps>(({ color = "currentColor", size = "1em", ...props }, ref) => (
    <Component ref={ref} color={color} size={size} {...props} />
  ));

  IconWithDefaults.displayName = displayName;
  return IconWithDefaults;
}

// iconsax-react relies on defaultProps, which React 19 does not apply here.
export const Activity = withIconDefaults(Iconsax.Activity, "Activity");
export const ArrowRight = withIconDefaults(Iconsax.ArrowRight, "ArrowRight");
export const BagTick = withIconDefaults(Iconsax.BagTick, "BagTick");
export const BoxTick = withIconDefaults(Iconsax.BoxTick, "BoxTick");
export const CalendarTick = withIconDefaults(Iconsax.CalendarTick, "CalendarTick");
export const CallCalling = withIconDefaults(Iconsax.CallCalling, "CallCalling");
export const Card = withIconDefaults(Iconsax.Card, "Card");
export const Category = withIconDefaults(Iconsax.Category, "Category");
export const Chart2 = withIconDefaults(Iconsax.Chart2, "Chart2");
export const ChartSuccess = withIconDefaults(Iconsax.ChartSuccess, "ChartSuccess");
export const Cup = withIconDefaults(Iconsax.Cup, "Cup");
export const DirectboxNotif = withIconDefaults(Iconsax.DirectboxNotif, "DirectboxNotif");
export const Element3 = withIconDefaults(Iconsax.Element3, "Element3");
export const Global = withIconDefaults(Iconsax.Global, "Global");
export const Gps = withIconDefaults(Iconsax.Gps, "Gps");
export const Location = withIconDefaults(Iconsax.Location, "Location");
export const Logout = withIconDefaults(Iconsax.Logout, "Logout");
export const MagicStar = withIconDefaults(Iconsax.MagicStar, "MagicStar");
export const MenuBoard = withIconDefaults(Iconsax.MenuBoard, "MenuBoard");
export const MessageText = withIconDefaults(Iconsax.MessageText, "MessageText");
export const MessageTick = withIconDefaults(Iconsax.MessageTick, "MessageTick");
export const Messages2 = withIconDefaults(Iconsax.Messages2, "Messages2");
export const Money = withIconDefaults(Iconsax.Money, "Money");
export const Monitor = withIconDefaults(Iconsax.Monitor, "Monitor");
export const NotificationBing = withIconDefaults(Iconsax.NotificationBing, "NotificationBing");
export const People = withIconDefaults(Iconsax.People, "People");
export const Profile2User = withIconDefaults(Iconsax.Profile2User, "Profile2User");
export const ReceiptText = withIconDefaults(Iconsax.ReceiptText, "ReceiptText");
export const Routing = withIconDefaults(Iconsax.Routing, "Routing");
export const Scissor = withIconDefaults(Iconsax.Scissor, "Scissor");
export const SearchNormal1 = withIconDefaults(Iconsax.SearchNormal1, "SearchNormal1");
export const Send2 = withIconDefaults(Iconsax.Send2, "Send2");
export const Setting2 = withIconDefaults(Iconsax.Setting2, "Setting2");
export const ShieldTick = withIconDefaults(Iconsax.ShieldTick, "ShieldTick");
export const Shop = withIconDefaults(Iconsax.Shop, "Shop");
export const ShoppingBag = withIconDefaults(Iconsax.ShoppingBag, "ShoppingBag");
export const Sms = withIconDefaults(Iconsax.Sms, "Sms");
export const TaskSquare = withIconDefaults(Iconsax.TaskSquare, "TaskSquare");
export const TickCircle = withIconDefaults(Iconsax.TickCircle, "TickCircle");
export const WalletMoney = withIconDefaults(Iconsax.WalletMoney, "WalletMoney");
export const Whatsapp = withIconDefaults(Iconsax.Whatsapp, "Whatsapp");
