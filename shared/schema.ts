import { pgTable, text, integer, boolean, timestamp, decimal, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Customer users table for Replit Auth (Google login etc)
export const customerUsers = pgTable("customer_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertCustomerUser = typeof customerUsers.$inferInsert;
export type CustomerUser = typeof customerUsers.$inferSelect;

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  resellerId: integer("reseller_id"),
  icon: text("icon").default("folder"),
  displayOrder: integer("display_order").default(0),
  subcategories: text("subcategories").array().default([]),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const resellers = pgTable("resellers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  customDomain: text("custom_domain").unique(),
  storeName: text("store_name"),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color").default("#8B5CF6"),
  backgroundColor: text("background_color").default("#121212"),
  buttonColor: text("button_color").default("#8B5CF6"),
  cardBorderColor: text("card_border_color").default("#374151"),
  textColor: text("text_color").default("#FFFFFF"),
  cardBackgroundColor: text("card_background_color").default("#1A1A2E"),
  secondaryColor: text("secondary_color").default("#6366F1"),
  backgroundImageUrl: text("background_image_url"),
  buttonRadius: integer("button_radius"),
  paymentClientId: text("payment_client_id"),
  paymentClientSecret: text("payment_client_secret"),
  pixKey: text("pix_key"),
  phone: text("phone"),
  cpf: text("cpf"),
  mpAccessToken: text("mp_access_token"),
  pagseguroToken: text("pagseguro_token"),
  pagseguroEmail: text("pagseguro_email"),
  pagseguroSandbox: boolean("pagseguro_sandbox").default(true),
  pagseguroAccessToken: text("pagseguro_access_token"),
  pagseguroRefreshToken: text("pagseguro_refresh_token"),
  pagseguroTokenExpiresAt: timestamp("pagseguro_token_expires_at"),
  pagseguroAccountId: text("pagseguro_account_id"),
  pagseguroConnected: boolean("pagseguro_connected").default(false),
  preferredPaymentMethod: text("preferred_payment_method").default("pagseguro"),
  commissionPercent: integer("commission_percent").default(10),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).default("0"),
  totalCommission: decimal("total_commission", { precision: 12, scale: 2 }).default("0"),
  walletBalance: decimal("wallet_balance", { precision: 12, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  isReseller: boolean("is_reseller").default(true),
  subscriptionStatus: text("subscription_status").default("pending"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  supportEmail: text("support_email"),
  whatsappContact: text("whatsapp_contact"),
  footerDescription: text("footer_description"),
  faviconUrl: text("favicon_url"),
  ogImageUrl: text("og_image_url"),
  storeDescription: text("store_description"),
  documentFrontUrl: text("document_front_url"),
  documentBackUrl: text("document_back_url"),
  verificationStatus: text("verification_status").default("pending"),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),
});

// Webhooks table for purchase notifications
export const webhooks = pgTable("webhooks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  resellerId: integer("reseller_id").notNull(),
  name: text("name").notNull().default("Webhook"),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  slug: text("slug"),
  description: text("description"),
  imageUrl: text("image_url"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  stock: text("stock").notNull().default(""),
  category: text("category").default("Outros"),
  categoryId: integer("category_id"),
  subcategory: text("subcategory"),
  instructions: text("instructions"),
  warranty: text("warranty"),
  deliveryContent: text("delivery_content"),
  active: boolean("active").notNull().default(true),
  limitPerUser: boolean("limit_per_user").default(false),
  resellerId: integer("reseller_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp"),
  customerCpf: text("customer_cpf"),
  customerName: text("customer_name"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("pix_auto"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  comissaoPlataforma: decimal("comissao_plataforma", { precision: 10, scale: 2 }),
  valorRevendedor: decimal("valor_revendedor", { precision: 10, scale: 2 }),
  pixCode: text("pix_code"),
  pixQrCode: text("pix_qr_code"),
  pagseguroOrderId: text("pagseguro_order_id"),
  abacatepayBillingId: text("abacatepay_billing_id"),
  deliveredContent: text("delivered_content"),
  couponCode: text("coupon_code"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  imei: text("imei"),
  resellerId: integer("reseller_id"),
  whatsappDeliveryLink: text("whatsapp_delivery_link"),
  viewedByBuyer: boolean("viewed_by_buyer").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  deliveredContent: text("delivered_content"),
  redeemedAt: timestamp("redeemed_at"),
});

export const coupons = pgTable("coupons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
  discountPercent: integer("discount_percent").notNull().default(0),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  resellerId: integer("reseller_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcementSettings = pgTable("announcement_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  resellerId: integer("reseller_id"),
  enabled: boolean("enabled").notNull().default(false),
  text: text("text").notNull().default(""),
  backgroundColor: text("background_color").notNull().default("#9333EA"),
  textColor: text("text_color").notNull().default("#FFFFFF"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  storeName: text("store_name").notNull().default("NexStore"),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color").notNull().default("#3B82F6"),
  textColor: text("text_color").notNull().default("#FFFFFF"),
  pagseguroToken: text("pagseguro_token"),
  pagseguroEmail: text("pagseguro_email"),
  pagseguroSandbox: boolean("pagseguro_sandbox").default(true),
  pagseguroApiUrl: text("pagseguro_api_url"),
  pagseguroClientId: text("pagseguro_client_id"),
  pagseguroAppAccountId: text("pagseguro_app_account_id"),
  pixKey: text("pix_key").default(""),
  adminPixKey: text("admin_pix_key").default("973.182.722-68"),
  resellerPixKey: text("reseller_pix_key").default(""),
  supportEmail: text("support_email").default("suporte@nexstore.com"),
  whatsappContact: text("whatsapp_contact").default("5585988007000"),
  resellerWhatsapp: text("reseller_whatsapp").default(""),
});

export const insertProductSchema = createInsertSchema(products);
export const insertOrderSchema = createInsertSchema(orders);
export const insertOrderItemSchema = createInsertSchema(orderItems);

// @ts-expect-error drizzle-zod omit type inference issue
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usedCount: true });

export const insertSettingsSchema = createInsertSchema(settings);

// @ts-expect-error drizzle-zod omit type inference issue
export const insertAnnouncementSettingsSchema = createInsertSchema(announcementSettings).omit({ id: true, createdAt: true });

export const insertResellersSchema = createInsertSchema(resellers);

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export type AnnouncementSetting = typeof announcementSettings.$inferSelect;
export type InsertAnnouncementSetting = z.infer<typeof insertAnnouncementSettingsSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type Reseller = typeof resellers.$inferSelect;
export type InsertReseller = z.infer<typeof insertResellersSchema>;

export type Category = typeof categories.$inferSelect;
export const insertCategorySchema = createInsertSchema(categories);
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// Tabela de solicitações de retirada de saldo
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  resellerId: integer("reseller_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  pixKey: text("pix_key").notNull(),
  pixKeyType: text("pix_key_type").notNull().default("cpf"),
  pixHolderName: text("pix_holder_name"),
  withdrawalFee: decimal("withdrawal_fee", { precision: 10, scale: 2 }).default("0.80"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference issue
export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({ id: true, createdAt: true });

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// Webhook types
// @ts-expect-error drizzle-zod omit type inference issue
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ id: true, createdAt: true });
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

// Chat messages table for buyer-seller communication
export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderType: text("sender_type").notNull(),
  senderName: text("sender_name"),
  message: text("message"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference issue
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Reviews table for seller ratings
export const reviews = pgTable("reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().unique(),
  resellerId: integer("reseller_id").notNull(),
  productId: integer("product_id"),
  productName: text("product_name"),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference issue
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
