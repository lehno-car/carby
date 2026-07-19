export type SafeUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  phone: string | null;
  role: "user" | "admin";
};

export type Listing = {
  id: string;
  ownerId: string;
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  make: string;
  model: string;
  generation: string | null;
  year: number;
  manufactureYear: number | null;
  price: number;
  currency: "BYN" | "RUB" | "USD";
  mileage: number;
  bodyType: string;
  fuelType: string;
  transmission: string;
  drivetrain: string;
  engineVolume: string | null;
  horsepower: number | null;
  color: string | null;
  maskedVin: string | null;
  country: string;
  city: string;
  description: string;
  sellerPhone: string | null;
  sellerTelegram: string | null;
  status: "draft" | "pending" | "active" | "rejected" | "sold" | "archived";
  rejectionReason: string | null;
  viewCount: number;
  createdAt: string;
  images: Array<{ id: string; url: string; position: number }>;
  owner?: { username: string | null; firstName: string; phone: string | null };
  catalog?: {
    make: CatalogMake | null;
    model: CatalogModel | null;
    generation: CatalogGeneration | null;
  };
};

export type CatalogMake = {
  id: string;
  name: string;
  slug: string;
  isFeatured: boolean;
  isSpecial: boolean;
  isActive: boolean;
  activeListingCount?: number;
};

export type CatalogModel = {
  id: string;
  makeId: string;
  name: string;
  slug: string;
  isActive: boolean;
  activeListingCount?: number;
};

export type CatalogGeneration = {
  id: string;
  modelId: string;
  name: string;
  code: string | null;
  productionStartYear: number | null;
  productionEndYear: number | null;
  isFacelift: boolean;
  isActive: boolean;
};
