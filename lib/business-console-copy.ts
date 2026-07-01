import {
  isCateringBusinessType,
  isFoodBusinessType,
  isHomeServiceBusinessType,
  isLaundryBusinessType,
  isRetailBusinessType,
  isSalonBusinessType,
  isStudioBusinessType,
  isTailoringBusinessType
} from "@/lib/business-rules";

export type BusinessConsoleCopy = {
  catalogNavLabel: string;
  catalogTitle: string;
  catalogBody: string;
  categorySingular: string;
  categoryPlural: string;
  itemSingular: string;
  itemPlural: string;
  addItemLabel: string;
  searchPlaceholder: string;
  emptyCatalogMessage: string;
  topItemsTitle: string;
  transactionSingular: string;
  transactionPlural: string;
  newTransactionsTitle: string;
  recentTransactionsTitle: string;
  customerSingular: string;
  customerPlural: string;
  minimumValueLabel: string;
  serviceFeeLabel: string;
};

const foodCopy: BusinessConsoleCopy = {
  catalogNavLabel: "Menu",
  catalogTitle: "Menu Management",
  catalogBody: "Create categories, add menu items, configure food markers, mark best sellers, and control availability.",
  categorySingular: "Category",
  categoryPlural: "Categories",
  itemSingular: "Item",
  itemPlural: "Items",
  addItemLabel: "Add Item",
  searchPlaceholder: "Search menu items",
  emptyCatalogMessage: "No menu items yet.",
  topItemsTitle: "Top selling items",
  transactionSingular: "Order",
  transactionPlural: "Orders",
  newTransactionsTitle: "New orders",
  recentTransactionsTitle: "Recent orders",
  customerSingular: "Customer",
  customerPlural: "Customers",
  minimumValueLabel: "Minimum order value",
  serviceFeeLabel: "Order service fee"
};

function serviceCopy(overrides: Partial<BusinessConsoleCopy> = {}): BusinessConsoleCopy {
  return {
    catalogNavLabel: "Services",
    catalogTitle: "Service Management",
    catalogBody: "Create service categories, add services, set pricing, mark popular options, and control availability.",
    categorySingular: "Service category",
    categoryPlural: "Service categories",
    itemSingular: "Service",
    itemPlural: "Services",
    addItemLabel: "Add Service",
    searchPlaceholder: "Search services",
    emptyCatalogMessage: "No services yet.",
    topItemsTitle: "Top services",
    transactionSingular: "Booking",
    transactionPlural: "Bookings",
    newTransactionsTitle: "New bookings",
    recentTransactionsTitle: "Recent bookings",
    customerSingular: "Client",
    customerPlural: "Clients",
    minimumValueLabel: "Minimum booking value",
    serviceFeeLabel: "Service visit fee",
    ...overrides
  };
}

export function getBusinessConsoleCopy(businessType: string): BusinessConsoleCopy {
  if (isCateringBusinessType(businessType)) {
    return serviceCopy({
      catalogNavLabel: "Packages",
      catalogTitle: "Catering Package Management",
      catalogBody: "Create package categories, add catering packages, set event pricing, mark popular packages, and control availability.",
      categorySingular: "Package category",
      categoryPlural: "Package categories",
      itemSingular: "Package",
      itemPlural: "Packages",
      addItemLabel: "Add Package",
      searchPlaceholder: "Search packages",
      emptyCatalogMessage: "No packages yet.",
      topItemsTitle: "Top catering packages",
      transactionSingular: "Booking",
      transactionPlural: "Bookings",
      newTransactionsTitle: "New bookings",
      recentTransactionsTitle: "Recent bookings",
      customerSingular: "Client",
      customerPlural: "Clients",
      minimumValueLabel: "Minimum booking value",
      serviceFeeLabel: "Event service fee"
    });
  }

  if (isFoodBusinessType(businessType)) return foodCopy;

  if (isRetailBusinessType(businessType)) {
    return serviceCopy({
      catalogNavLabel: "Catalog",
      catalogTitle: "Catalog Management",
      catalogBody: "Create product categories, add products, set pricing, mark popular products, and control availability.",
      categorySingular: "Product category",
      categoryPlural: "Product categories",
      itemSingular: "Product",
      itemPlural: "Products",
      addItemLabel: "Add Product",
      searchPlaceholder: "Search products",
      emptyCatalogMessage: "No products yet.",
      topItemsTitle: "Top products",
      transactionSingular: "Order",
      transactionPlural: "Orders",
      newTransactionsTitle: "New orders",
      recentTransactionsTitle: "Recent orders",
      customerSingular: "Customer",
      customerPlural: "Customers",
      minimumValueLabel: "Minimum order value",
      serviceFeeLabel: "Delivery fee"
    });
  }

  if (isSalonBusinessType(businessType)) {
    return serviceCopy({
      catalogNavLabel: "Services",
      catalogTitle: "Salon Service Management",
      catalogBody: "Create service categories, add salon and spa services, set pricing, mark popular options, and control availability.",
      categorySingular: "Service category",
      categoryPlural: "Service categories",
      itemSingular: "Service",
      itemPlural: "Services",
      addItemLabel: "Add Service",
      searchPlaceholder: "Search services",
      emptyCatalogMessage: "No services yet.",
      topItemsTitle: "Top services",
      transactionSingular: "Appointment",
      transactionPlural: "Appointments",
      newTransactionsTitle: "New appointments",
      recentTransactionsTitle: "Recent appointments",
      customerSingular: "Client",
      customerPlural: "Clients",
      minimumValueLabel: "Minimum appointment value",
      serviceFeeLabel: "Home service fee"
    });
  }

  if (isStudioBusinessType(businessType)) {
    return serviceCopy({
      catalogNavLabel: "Classes",
      catalogTitle: "Class Management",
      catalogBody: "Create class categories, add sessions, set pricing, mark popular classes, and control availability.",
      categorySingular: "Class category",
      categoryPlural: "Class categories",
      itemSingular: "Class",
      itemPlural: "Classes",
      addItemLabel: "Add Class",
      searchPlaceholder: "Search classes",
      emptyCatalogMessage: "No classes yet.",
      topItemsTitle: "Top classes",
      customerSingular: "Member",
      customerPlural: "Members",
      serviceFeeLabel: "Session fee"
    });
  }

  if (isTailoringBusinessType(businessType)) {
    return serviceCopy({
      catalogTitle: "Tailoring Service Management",
      transactionSingular: "Order",
      transactionPlural: "Orders",
      newTransactionsTitle: "New orders",
      recentTransactionsTitle: "Recent orders",
      serviceFeeLabel: "Visit fee"
    });
  }

  if (isLaundryBusinessType(businessType)) {
    return serviceCopy({
      catalogTitle: "Laundry Service Management",
      catalogBody: "Create laundry categories, add services, set pricing, mark popular options, and control availability.",
      transactionSingular: "Laundry Order",
      transactionPlural: "Laundry Orders",
      newTransactionsTitle: "New laundry orders",
      recentTransactionsTitle: "Recent laundry orders",
      customerSingular: "Customer",
      customerPlural: "Customers",
      minimumValueLabel: "Minimum laundry order value",
      serviceFeeLabel: "Pickup or delivery fee"
    });
  }

  if (isHomeServiceBusinessType(businessType)) {
    return serviceCopy({
      catalogTitle: "Home Service Management",
      catalogBody: "Create service categories, add home visit services, set pricing, mark popular services, and control availability.",
      transactionSingular: "Service Request",
      transactionPlural: "Service Requests",
      newTransactionsTitle: "New service requests",
      recentTransactionsTitle: "Recent service requests",
      minimumValueLabel: "Minimum service request value",
      serviceFeeLabel: "Visit fee"
    });
  }

  return serviceCopy();
}
