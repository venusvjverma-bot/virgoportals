export type Role = 'admin' | 'host' | 'no-portal';

export interface Session {
  userId: string;
  email: string;
  role: Role;
}

export interface ModelConfig {
  provider: string;
  apiKey: string;
  model: string;
  endpoint: string;
  reasoningEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
}

export interface ModelState {
  provider: string;
  model: string;
  endpoint: string;
  hasApiKey: boolean;
  reasoningEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
}

export interface AdminModels {
  chatModel: ModelState;
  imageModel: ModelState;
}

export type HostStatus = 'Active' | 'Blocked';

export interface Host {
  id: string;
  restaurant: string;
  email: string;
  city: string;
  signupDate: string;
  dishes: number;
  status: HostStatus;
  welcomeText: string;
  botPrompt: string;
  visitorLink: string;
}
export interface RestaurantPortal {
  id: string;
  ownerEmail: string;
  name: string;
  city: string;
  welcome: string;
  systemPrompt: string;
  status: HostStatus;
  createdAt: string;
  timezone: string;
  currency: string;
  /** Optional invoicing details. Null until the host provides them. */
  businessName: string | null;
  businessAddress: string | null;
}

export type ServingUnit = 'cl' | 'ml' | 'oz';

export interface DishServingOption {
  id: string;
  dishId: string;
  label: string;
  price: string;
  quantity: number | null;
  unit: ServingUnit | null;
  sortOrder: number;
  isActive: boolean;
}

export interface DishVariant {
  id: string;
  dishId: string;
  name: string;
  additionalPrice: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DishRemovableIngredient {
  id: string;
  dishId: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  ingredients: string;
  allergy: string;
  price: string;
  imageUrl: string | null;
  sortOrder: number;
  category: string;
  section: string;
  serving: string;
  abv: string;
  available: boolean;
  departmentId: string | null;
  eventId: string | null;
  servingOptions: DishServingOption[];
  variants: DishVariant[];
  removableIngredients: DishRemovableIngredient[];
}

export interface Department {
  id: string;
  restaurantId: string;
  name: string;
  isDefault: boolean;
  openTime: string | null;
  closeTime: string | null;
  systemPrompt: string;
  isActive: boolean;
  archived: boolean;
  chatBackgroundAssetId: string | null;
  printerEnabled: boolean;
  printerName: string | null;
  printerConnection: 'wifi' | 'lan' | null;
  printerIp: string | null;
  printerPort: number | null;
  tableServiceEnabled: boolean;
  tableServiceCharge: number;
  roomServiceEnabled: boolean;
  roomServiceCharge: number;
  createdAt: string;
}

export interface EventItem {
  id: string;
  restaurantId: string;
  name: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  systemPrompt: string;
  status: 'upcoming' | 'active' | 'ended' | 'archived';
  chatBackgroundAssetId: string | null;
  tableServiceEnabled: boolean;
  tableServiceCharge: number;
  roomServiceEnabled: boolean;
  roomServiceCharge: number;
  createdAt: string;
}

export type ResourceType = 'department' | 'event' | 'restaurant';

export interface PublicResource {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  openTime: string | null;
  closeTime: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  restaurantId: string;
  restaurantName: string;
  city: string;
  welcome: string;
  systemPrompt: string;
  timezone: string;
  currency: string;
  chatBackgroundPath: string | null;
  tableServiceEnabled: boolean;
  tableServiceCharge: number;
  roomServiceEnabled: boolean;
  roomServiceCharge: number;
}

export interface UsageRow {
  id: string;
  host: string;
  uploads: number;
  images: number;
  messages: number;
}

export type AdminView = 'home' | 'hosts' | 'credits' | 'subscriptions' | 'chat' | 'image' | 'bot' | 'usage' | 'theme';
export type HostView =
  | 'dashboard'
  | 'subscription'
  | 'departments'
  | 'events'
  | 'orders'
  | 'reports'
  | 'order-detail'
  | 'department-detail'
  | 'event-detail';

export type ResourceView = 'details' | 'menu' | 'bot' | 'qr' | 'theme' | 'printer';

export type OrderStatus = 'new' | 'accepted' | 'completed' | 'cancelled';

export type TipOption = 'none' | '5' | '10' | '13' | '20' | 'custom';

export type PaymentMethod = 'pay_to_staff' | 'pay_online';

export interface OrderComboSelection {
  groupId: string;
  dishName: string;
  servingLabel: string | null;
  removedIngredients: string;
  upgradeMinor: number;
}

export interface BasketComboSelection {
  groupId: string;
  dishId: string;
  dishName: string;
  servingOptionId: string | null;
  servingLabel: string | null;
  upgradeMinor: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  dishId: string | null;
  comboId: string | null;
  selections: OrderComboSelection[] | null;
  name: string;
  priceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  servingLabel: string | null;
  variantName: string | null;
  variantAdditionalMinor: number | null;
  removedIngredients: string;
  additionalRequest: string;
  addOns: { name: string; priceMinor: number }[];
}

export interface DepartmentSession {
  id: string;
  departmentId: string;
  startedAt: string;
  closedAt: string | null;
}

export interface SessionOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalMinor: number;
  currency: string;
  createdAt: string;
}

export interface DepartmentSessionReport extends DepartmentSession {
  departmentName: string;
  currency: string;
  orders: SessionOrder[];
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  departmentId: string | null;
  eventId: string | null;
  resourceType: ResourceType;
  resourceName: string;
  restaurantName: string;
  status: OrderStatus;
  paymentStatus: string;
  serviceType: 'table' | 'room' | null;
  serviceLocation: string | null;
  serviceChargeMinor: number;
  subtotalMinor: number;
  tipOption: TipOption;
  tipMinor: number;
  totalMinor: number;
  currency: string;
  itemCount: number;
  mobileNumber: string | null;
  createdAt: string;
  statusUpdatedAt: string;
  items: OrderItem[];
}

export interface BasketItem {
  dishId: string;
  name: string;
  price: string;
  imageUrl: string | null;
  section?: string | null;
  quantity: number;
  servingOptionId?: string | null;
  servingLabel?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  variantAdditionalPrice?: string | null;
  addOns?: AddOnOption[];
  removedIngredientIds?: string[];
  removedIngredientLabels?: string[];
  additionalRequest?: string | null;
  comboId?: string | null;
  comboSelections?: BasketComboSelection[];
}

export interface AddOnOption {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  category: string;
}

export interface ConfirmedOrderRef {
  orderId: string;
  orderNumber: string;
}

export interface ComboGroup {
  id: string;
  comboId: string;
  section: string;
  category: string;
  requiredCount: number;
  sortOrder: number;
}

export interface Combo {
  id: string;
  restaurantId: string;
  departmentId: string | null;
  eventId: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  price: string;
  sortOrder: number;
  isActive: boolean;
  groups: ComboGroup[];
}

export interface VisitorComboGroup {
  id: string;
  section: string;
  category: string;
  requiredCount: number;
  dishes: Dish[];
}

export interface VisitorCombo {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: string;
  groups: VisitorComboGroup[];
}

export interface CreditHost {
  restaurantId: string;
  email: string;
  name: string;
  city: string;
  status: HostStatus;
  balance: number;
  llmActive: boolean;
}

export interface CreditAdjustment {
  id: string;
  operation: string;
  amount: number;
  previousBalance: number;
  resultingBalance: number;
  createdAt: string;
}
