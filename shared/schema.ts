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
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const resellers = pgTable("resellers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  customDomain: text("custom_domain"),
  storeName: text("store_name"),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color").default("#3B82F6"),
  backgroundColor: text("background_color"),
  buttonColor: text("button_color").default("#3B82F6"),
  cardBorderColor: text("card_border_color").default("#374151"),
  backgroundImageUrl: text("background_image_url"),
  buttonRadius: integer("button_radius"),
  paymentClientId: text("payment_client_id"),
  paymentClientSecret: text("payment_client_secret"),
  pixKey: text("pix_key"),
  phone: text("phone"),
  cpf: text("cpf"),
  mpAccessToken: text("mp_access_token"),
  commissionPercent: integer("commission_percent").default(10),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).default("0"),
  totalCommission: decimal("total_commission", { precision: 12, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  isReseller: boolean("is_reseller").default(true),
  subscriptionStatus: text("subscription_status").default("pending"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  supportEmail: text("support_email"),
  whatsappContact: text("whatsapp_contact"),
  footerDescription: text("footer_description"),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  stock: text("stock").notNull().default(""),
  category: text("category").default("Outros"),
  categoryId: integer("category_id"),
  instructions: text("instructions"),
  warranty: text("warranty"),
  deliveryContent: text("delivery_content"),
  active: boolean("active").notNull().default(true),
  resellerId: integer("reseller_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("pix_auto"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  pixCode: text("pix_code"),
  pixQrCode: text("pix_qr_code"),
  pagseguroOrderId: text("pagseguro_order_id"),
  deliveredContent: text("delivered_content"),
  couponCode: text("coupon_code"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  imei: text("imei"),
  resellerId: integer("reseller_id"),
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
  discountPercent: integer("discount_percent").notNull(),
  active: boolean("active").notNull().default(true),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  storeName: text("store_name").notNull().default("Digital Store"),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color").notNull().default("#3B82F6"),
  textColor: text("text_color").notNull().default("#FFFFFF"),
  pagseguroToken: text("pagseguro_token"),
  pagseguroEmail: text("pagseguro_email"),
  pagseguroSandbox: boolean("pagseguro_sandbox").default(true),
  pagseguroApiUrl: text("pagseguro_api_url"),
  pixKey: text("pix_key").default(""),
  adminPixKey: text("admin_pix_key").default("973.182.722-68"),
  resellerPixKey: text("reseller_pix_key").default(""),
  supportEmail: text("support_email").default("support@goldstore.com"),
  whatsappContact: text("whatsapp_contact").default("5585988007000"),
  resellerWhatsapp: text("reseller_whatsapp").default(""),
});

export const insertProductSchema = createInsertSchema(products, {
  id: z.number().optional(),
});
export const insertOrderSchema = createInsertSchema(orders, {
  id: z.number().optional(),
  createdAt: z.date().optional(),
});
export const insertOrderItemSchema = createInsertSchema(orderItems, {
  id: z.number().optional(),
});
export const insertCouponSchema = createInsertSchema(coupons, {
  id: z.number().optional(),
});
export const insertSettingsSchema = createInsertSchema(settings, {
  id: z.number().optional(),
});

export const insertResellersSchema = createInsertSchema(resellers, {
  createdAt: z.date().optional(),
  pixKey: z.string().optional().default(""),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  mpAccessToken: z.string().optional().default(""),
  customDomain: z.string().optional(),
  storeName: z.string().optional(),
  logoUrl: z.string().optional(),
  themeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  buttonRadius: z.number().optional(),
  subscriptionStatus: z.string().optional().default("pending"),
  subscriptionExpiresAt: z.date().optional(),
  supportEmail: z.string().optional(),
  whatsappContact: z.string().optional(),
  footerDescription: z.string().optional(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type Reseller = typeof resellers.$inferSelect;
export type InsertReseller = z.infer<typeof insertResellersSchema>;

export type Category = typeof categories.$inferSelect;
export const insertCategorySchema = createInsertSchema(categories, {
  id: z.number().optional(),
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
