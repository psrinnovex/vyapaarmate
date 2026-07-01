export const MENU_ITEM_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MENU_ITEM_IMAGE_MAX_STORED_BYTES = 500 * 1024;
export const MENU_ITEM_IMAGE_MAX_DIMENSION = 1280;

type MenuItemImageReference = {
  id: string;
  imageUrl: string | null;
  image?: { updatedAt: Date | string } | null;
};

export function getMenuItemImageUrl(item: MenuItemImageReference) {
  if (item.image) {
    const version = new Date(item.image.updatedAt).getTime();
    return `/api/menu-images/${encodeURIComponent(item.id)}?v=${version}`;
  }

  return item.imageUrl;
}
