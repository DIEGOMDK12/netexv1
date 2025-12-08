import { 
  products, orders, orderItems, coupons, settings, resellers, categories, customerUsers, withdrawalRequests, announcementSettings,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Coupon, type InsertCoupon,
  type Settings, type InsertSettings,
  type Reseller, type InsertReseller,
  type Category, type InsertCategory,
  type CustomerUser, type UpsertCustomerUser,
  type WithdrawalRequest, type InsertWithdrawalRequest,
  type AnnouncementSetting, type InsertAnnouncementSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNotNull, inArray, and, sql } from "drizzle-orm";

export interface IStorage {
  getCustomerUser(id: string): Promise<CustomerUser | undefined>;
  upsertCustomerUser(user: UpsertCustomerUser): Promise<CustomerUser>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;

  getCategories(): Promise<Category[]>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;
  getResellerCategories(resellerId: number): Promise<Category[]>;
  reorderCategories(resellerId: number, orderedIds: number[]): Promise<void>;

  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;

  getOrderItems(orderId: number): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: number, data: Partial<OrderItem>): Promise<OrderItem | undefined>;

  getCoupons(): Promise<Coupon[]>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<void>;
  getResellerCoupons(resellerId: number): Promise<Coupon[]>;
  incrementCouponUsage(id: number): Promise<void>;

  getAnnouncementSettings(resellerId?: number): Promise<AnnouncementSetting | undefined>;
  updateAnnouncementSettings(data: InsertAnnouncementSetting): Promise<AnnouncementSetting>;

  getSettings(): Promise<Settings | undefined>;
  updateSettings(data: InsertSettings): Promise<Settings>;

  getReseller(id: number): Promise<Reseller | undefined>;
  getResellerByEmail(email: string): Promise<Reseller | undefined>;
  getResellerBySlug(slug: string): Promise<Reseller | undefined>;
  createReseller(reseller: InsertReseller): Promise<Reseller>;
  updateReseller(id: number, reseller: Partial<InsertReseller>): Promise<Reseller | undefined>;
  deleteReseller(id: number): Promise<void>;
  getResellerProducts(resellerId: number): Promise<Product[]>;
  createResellerProduct(product: InsertProduct & { resellerId: number }): Promise<Product>;
  getResellerOrders(resellerId: number): Promise<any[]>;
  getAllResellers(): Promise<any[]>;

  // Withdrawal requests
  getWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  getWithdrawalRequestsByReseller(resellerId: number): Promise<WithdrawalRequest[]>;
  getWithdrawalRequest(id: number): Promise<WithdrawalRequest | undefined>;
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  updateWithdrawalRequest(id: number, data: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined>;

  // Sanitization
  sanitizeOrphanProducts(): Promise<{ deleted: number; orphanIds: number[] }>;
  getValidProducts(): Promise<Product[]>;
}

export class DatabaseStorage implements IStorage {
  async getCustomerUser(id: string): Promise<CustomerUser | undefined> {
    const [user] = await db.select().from(customerUsers).where(eq(customerUsers.id, id));
    return user;
  }

  async upsertCustomerUser(userData: UpsertCustomerUser): Promise<CustomerUser> {
    const [user] = await db
      .insert(customerUsers)
      .values(userData)
      .onConflictDoUpdate({
        target: customerUsers.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.id));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.name);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const slug = category.slug || category.name.toLowerCase().replace(/\s+/g, "-");
    const [created] = await db.insert(categories).values({ ...category, slug }).returning();
    return created;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getResellerCategories(resellerId: number): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.resellerId, resellerId)).orderBy(categories.displayOrder);
  }

  async reorderCategories(resellerId: number, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(categories)
        .set({ displayOrder: i })
        .where(eq(categories.id, orderedIds[i]));
    }
  }

  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set(order).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [created] = await db.insert(orderItems).values(item).returning();
    return created;
  }

  async updateOrderItem(id: number, data: Partial<OrderItem>): Promise<OrderItem | undefined> {
    const [updated] = await db.update(orderItems).set(data).where(eq(orderItems.id, id)).returning();
    return updated || undefined;
  }

  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.id));
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon || undefined;
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values(coupon).returning();
    return created;
  }

  async updateCoupon(id: number, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set(coupon).where(eq(coupons.id, id)).returning();
    return updated || undefined;
  }

  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async getResellerCoupons(resellerId: number): Promise<Coupon[]> {
    return db.select().from(coupons).where(eq(coupons.resellerId, resellerId)).orderBy(desc(coupons.id));
  }

  async incrementCouponUsage(id: number): Promise<void> {
    await db.update(coupons).set({
      usedCount: sql`${coupons.usedCount} + 1`
    }).where(eq(coupons.id, id));
  }

  async getAnnouncementSettings(resellerId?: number): Promise<AnnouncementSetting | undefined> {
    if (resellerId) {
      const [setting] = await db.select().from(announcementSettings).where(eq(announcementSettings.resellerId, resellerId));
      return setting || undefined;
    }
    const [setting] = await db.select().from(announcementSettings);
    return setting || undefined;
  }

  async updateAnnouncementSettings(data: InsertAnnouncementSetting): Promise<AnnouncementSetting> {
    const existing = await this.getAnnouncementSettings(data.resellerId ?? undefined);
    
    if (existing) {
      const [updated] = await db.update(announcementSettings).set(data).where(eq(announcementSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(announcementSettings).values(data).returning();
      return created;
    }
  }

  async getSettings(): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings);
    return setting || undefined;
  }

  async updateSettings(data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    
    if (existing) {
      const [updated] = await db.update(settings).set(data).where(eq(settings.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(data).returning();
      return created;
    }
  }

  async getReseller(id: number): Promise<Reseller | undefined> {
    const [reseller] = await db.select().from(resellers).where(eq(resellers.id, id));
    return reseller;
  }

  async getResellerByEmail(email: string): Promise<Reseller | undefined> {
    const [reseller] = await db.select().from(resellers).where(eq(resellers.email, email));
    return reseller;
  }

  async getResellerBySlug(slug: string): Promise<Reseller | undefined> {
    const [reseller] = await db.select().from(resellers).where(eq(resellers.slug, slug));
    return reseller;
  }

  async createReseller(reseller: InsertReseller): Promise<Reseller> {
    const [created] = await db.insert(resellers).values(reseller).returning();
    return created;
  }

  async updateReseller(id: number, reseller: Partial<InsertReseller>): Promise<Reseller | undefined> {
    const [updated] = await db.update(resellers).set(reseller).where(eq(resellers.id, id)).returning();
    return updated || undefined;
  }

  async deleteReseller(id: number): Promise<void> {
    await db.delete(resellers).where(eq(resellers.id, id));
  }

  async getResellerProducts(resellerId: number): Promise<typeof products.$inferSelect[]> {
    return db.select().from(products).where(eq(products.resellerId, resellerId)).orderBy(desc(products.createdAt));
  }

  async createResellerProduct(product: InsertProduct & { resellerId: number }): Promise<typeof products.$inferSelect> {
    const { resellerId, ...productData } = product;
    const [created] = await db.insert(products).values({ ...productData, resellerId }).returning();
    return created;
  }

  async getResellerOrders(resellerId: number): Promise<any[]> {
    // LEFT JOIN orders with orderItems and products to include product names
    const result = await db
      .select({
        order: orders,
        items: orderItems,
        product: products,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orders.resellerId, resellerId))
      .orderBy(desc(orders.createdAt));
    
    // Group items by order ID to reconstruct the data structure
    const ordersMap = new Map<number, any>();
    
    for (const row of result) {
      if (!ordersMap.has(row.order.id)) {
        ordersMap.set(row.order.id, {
          ...row.order,
          items: [],
        });
      }
      
      if (row.items && row.product) {
        ordersMap.get(row.order.id)!.items.push({
          ...row.items,
          product: row.product,
        });
      }
    }
    
    return Array.from(ordersMap.values());
  }

  async getAllResellers(): Promise<any[]> {
    console.log("[🔴 getAllResellers] Fetching all resellers from database...");
    const allResellers = await db.select().from(resellers)
      .where(eq(resellers.isReseller, true))
      .orderBy(desc(resellers.createdAt));
    
    console.log(`[🔴 getAllResellers] Found ${allResellers.length} resellers`);
    
    // Get product counts for each reseller
    const resellersWithCounts = await Promise.all(
      allResellers.map(async (reseller) => {
        const productList = await db
          .select()
          .from(products)
          .where(eq(products.resellerId, reseller.id));
        
        console.log(`[🔴 getAllResellers] Reseller ${reseller.id}:`, {
          storeName: reseller.storeName,
          subscriptionStatus: reseller.subscriptionStatus,
          subscriptionExpiresAt: reseller.subscriptionExpiresAt,
        });
        
        return {
          id: reseller.id,
          storeName: reseller.storeName,
          email: reseller.email,
          createdAt: reseller.createdAt,
          active: reseller.active,
          isReseller: reseller.isReseller,
          productCount: productList.length,
          subscriptionStatus: reseller.subscriptionStatus,
          subscriptionExpiresAt: reseller.subscriptionExpiresAt,
        };
      })
    );
    
    console.log("[🔴 getAllResellers] ✅ Retornando resellers com dados de subscription");
    return resellersWithCounts;
  }

  // Withdrawal requests methods
  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
  }

  async getWithdrawalRequestsByReseller(resellerId: number): Promise<WithdrawalRequest[]> {
    return db.select().from(withdrawalRequests)
      .where(eq(withdrawalRequests.resellerId, resellerId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getWithdrawalRequest(id: number): Promise<WithdrawalRequest | undefined> {
    const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return request || undefined;
  }

  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [created] = await db.insert(withdrawalRequests).values(request).returning();
    return created;
  }

  async updateWithdrawalRequest(id: number, data: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined> {
    const [updated] = await db.update(withdrawalRequests).set(data).where(eq(withdrawalRequests.id, id)).returning();
    return updated || undefined;
  }

  async sanitizeOrphanProducts(): Promise<{ deleted: number; orphanIds: number[] }> {
    console.log("[Sanitize] Starting orphan product cleanup...");
    
    const allResellerIds = await db.select({ id: resellers.id }).from(resellers);
    const validResellerIds = allResellerIds.map(r => r.id);
    console.log("[Sanitize] Valid reseller IDs:", validResellerIds);

    const allProducts = await db.select({ id: products.id, resellerId: products.resellerId, name: products.name }).from(products);
    
    const orphanProducts = allProducts.filter(p => {
      if (p.resellerId === null || p.resellerId === undefined) {
        return true;
      }
      if (!validResellerIds.includes(p.resellerId)) {
        return true;
      }
      return false;
    });

    const orphanIds = orphanProducts.map(p => p.id);
    console.log("[Sanitize] Orphan products found:", orphanIds.length, orphanProducts);

    if (orphanIds.length > 0) {
      await db.delete(products).where(inArray(products.id, orphanIds));
      console.log("[Sanitize] Deleted", orphanIds.length, "orphan products");
    }

    return { deleted: orphanIds.length, orphanIds };
  }

  async getValidProducts(): Promise<Product[]> {
    const allResellerIds = await db.select({ id: resellers.id }).from(resellers);
    const validResellerIds = allResellerIds.map(r => r.id);

    if (validResellerIds.length === 0) {
      return [];
    }

    const validProducts = await db.select().from(products)
      .where(and(
        isNotNull(products.resellerId),
        inArray(products.resellerId, validResellerIds),
        eq(products.active, true)
      ))
      .orderBy(desc(products.id));

    return validProducts;
  }
}

export const storage = new DatabaseStorage();
