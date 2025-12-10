import { 
  products, orders, orderItems, coupons, settings, resellers, categories, customerUsers, withdrawalRequests, announcementSettings, webhooks, chatMessages, reviews, vendorSessions,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Coupon, type InsertCoupon,
  type Settings, type InsertSettings,
  type Reseller, type InsertReseller,
  type Category, type InsertCategory,
  type CustomerUser, type UpsertCustomerUser,
  type WithdrawalRequest, type InsertWithdrawalRequest,
  type AnnouncementSetting, type InsertAnnouncementSetting,
  type Webhook, type InsertWebhook,
  type ChatMessage, type InsertChatMessage,
  type Review, type InsertReview,
  type VendorSession
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNotNull, inArray, and, sql, gt, lt } from "drizzle-orm";

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
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;
  getResellerCategories(resellerId: number): Promise<Category[]>;
  reorderCategories(resellerId: number, orderedIds: number[]): Promise<void>;

  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByBuyerEmail(email: string): Promise<Order[]>;
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
  getResellerByDomain(domain: string): Promise<Reseller | undefined>;
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

  // Webhooks
  getWebhooks(resellerId: number): Promise<Webhook[]>;
  getWebhook(id: number): Promise<Webhook | undefined>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  deleteWebhook(id: number): Promise<void>;
  
  // Marketplace - Products with seller info
  getProductsWithSellers(): Promise<Array<Product & { seller: { id: number; name: string; storeName: string | null; logoUrl: string | null; slug: string } }>>;
  
  // Marketplace - Unique categories (deduplicated by slug)
  getUniqueCategories(): Promise<Category[]>;

  // Chat messages
  getChatMessages(orderId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  markMessagesAsRead(orderId: number, senderType: string): Promise<void>;
  getUnreadMessageCount(orderId: number, forSenderType: string): Promise<number>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getReviewByOrderId(orderId: number): Promise<Review | undefined>;
  getReviewsByCustomerEmail(customerEmail: string): Promise<Review[]>;
  getResellerReviews(resellerId: number): Promise<Review[]>;
  getProductReviews(productId: number): Promise<Review[]>;
  getResellerStats(resellerId: number): Promise<{ averageRating: number; totalReviews: number; positivePercent: number; totalSales: number }>;
  getBatchSellerStats(resellerIds: number[]): Promise<Record<number, { averageRating: number; totalReviews: number }>>;

  // Vendor sessions for persistent authentication
  createVendorSession(token: string, resellerId: number, expiresAt: Date): Promise<VendorSession>;
  getVendorSession(token: string): Promise<VendorSession | undefined>;
  deleteVendorSession(token: string): Promise<void>;
  deleteExpiredVendorSessions(): Promise<void>;
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

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
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

  async getOrdersByBuyerEmail(email: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.email, email)).orderBy(desc(orders.createdAt));
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
    await db.delete(reviews).where(eq(reviews.orderId, id));
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

  async getResellerByDomain(domain: string): Promise<Reseller | undefined> {
    const normalizedDomain = domain.toLowerCase().trim();
    const [reseller] = await db.select().from(resellers).where(eq(resellers.customDomain, normalizedDomain));
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
          name: reseller.name,
          storeName: reseller.storeName,
          slug: reseller.slug,
          email: reseller.email,
          createdAt: reseller.createdAt,
          active: reseller.active,
          isReseller: reseller.isReseller,
          productCount: productList.length,
          subscriptionStatus: reseller.subscriptionStatus,
          subscriptionExpiresAt: reseller.subscriptionExpiresAt,
          documentFrontUrl: reseller.documentFrontUrl,
          documentBackUrl: reseller.documentBackUrl,
          verificationStatus: reseller.verificationStatus,
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

  // Webhook methods
  async getWebhooks(resellerId: number): Promise<Webhook[]> {
    return db.select().from(webhooks).where(eq(webhooks.resellerId, resellerId)).orderBy(desc(webhooks.id));
  }

  async getWebhook(id: number): Promise<Webhook | undefined> {
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return webhook || undefined;
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(webhook).returning();
    return created;
  }

  async deleteWebhook(id: number): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async getProductsWithSellers(): Promise<Array<Product & { seller: { id: number; name: string; storeName: string | null; logoUrl: string | null; slug: string } }>> {
    try {
      console.log("[Storage] getProductsWithSellers: Fetching all active products with seller info using INNER JOIN...");
      
      const result = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          imageUrl: products.imageUrl,
          originalPrice: products.originalPrice,
          currentPrice: products.currentPrice,
          stock: products.stock,
          category: products.category,
          categoryId: products.categoryId,
          instructions: products.instructions,
          warranty: products.warranty,
          deliveryContent: products.deliveryContent,
          active: products.active,
          limitPerUser: products.limitPerUser,
          resellerId: products.resellerId,
          createdAt: products.createdAt,
          sellerId: resellers.id,
          sellerName: resellers.name,
          sellerStoreName: resellers.storeName,
          sellerLogoUrl: resellers.logoUrl,
          sellerSlug: resellers.slug,
        })
        .from(products)
        .innerJoin(resellers, eq(products.resellerId, resellers.id))
        .where(eq(products.active, true))
        .orderBy(desc(products.id));

      console.log(`[Storage] getProductsWithSellers: Found ${result.length} products with valid sellers`);

      const productsWithSellers = result.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl: row.imageUrl,
        originalPrice: row.originalPrice,
        currentPrice: row.currentPrice,
        stock: row.stock,
        category: row.category,
        categoryId: row.categoryId,
        instructions: row.instructions,
        warranty: row.warranty,
        deliveryContent: row.deliveryContent,
        active: row.active,
        limitPerUser: row.limitPerUser,
        resellerId: row.resellerId,
        createdAt: row.createdAt,
        seller: {
          id: row.sellerId,
          name: row.sellerName,
          storeName: row.sellerStoreName,
          logoUrl: row.sellerLogoUrl,
          slug: row.sellerSlug,
        },
      }));

      console.log(`[Storage] getProductsWithSellers: Returning ${productsWithSellers.length} products with seller info`);
      return productsWithSellers;
    } catch (error: any) {
      console.error("[Storage] getProductsWithSellers ERROR:", error.message, error.stack);
      throw error;
    }
  }

  async getUniqueCategories(): Promise<Category[]> {
    try {
      console.log("[Storage] getUniqueCategories: Fetching unique categories by slug...");
      
      const allCats = await db.select().from(categories).where(eq(categories.active, true)).orderBy(categories.name);
      
      const uniqueBySlug = new Map<string, Category>();
      for (const cat of allCats) {
        if (!uniqueBySlug.has(cat.slug)) {
          uniqueBySlug.set(cat.slug, cat);
        }
      }
      
      const uniqueCats = Array.from(uniqueBySlug.values());
      console.log(`[Storage] getUniqueCategories: Returning ${uniqueCats.length} unique categories`);
      return uniqueCats;
    } catch (error: any) {
      console.error("[Storage] getUniqueCategories ERROR:", error.message, error.stack);
      throw error;
    }
  }

  async getChatMessages(orderId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.orderId, orderId)).orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async markMessagesAsRead(orderId: number, senderType: string): Promise<void> {
    const oppositeType = senderType === "buyer" ? "seller" : "buyer";
    await db.update(chatMessages)
      .set({ read: true })
      .where(and(
        eq(chatMessages.orderId, orderId),
        eq(chatMessages.senderType, oppositeType)
      ));
  }

  async getUnreadMessageCount(orderId: number, forSenderType: string): Promise<number> {
    const oppositeType = forSenderType === "buyer" ? "seller" : "buyer";
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.orderId, orderId),
        eq(chatMessages.senderType, oppositeType),
        eq(chatMessages.read, false)
      ));
    return Number(result[0]?.count || 0);
  }

  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async getReviewByOrderId(orderId: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.orderId, orderId));
    return review || undefined;
  }

  async getReviewsByCustomerEmail(customerEmail: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.customerEmail, customerEmail)).orderBy(desc(reviews.createdAt));
  }

  async getResellerReviews(resellerId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.resellerId, resellerId)).orderBy(desc(reviews.createdAt));
  }

  async getProductReviews(productId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
  }

  async getResellerStats(resellerId: number): Promise<{ averageRating: number; totalReviews: number; positivePercent: number; totalSales: number }> {
    const resellerReviews = await this.getResellerReviews(resellerId);
    const totalReviews = resellerReviews.length;
    
    // Calculate average rating
    const averageRating = totalReviews > 0 
      ? resellerReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews 
      : 0;
    
    // Calculate positive percent (4 or 5 stars)
    const positiveCount = resellerReviews.filter(r => r.rating >= 4).length;
    const positivePercent = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;
    
    // Get total sales (paid orders)
    const paidOrders = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.resellerId, resellerId), eq(orders.status, "paid")));
    const totalSales = Number(paidOrders[0]?.count || 0);
    
    return { averageRating: Math.round(averageRating * 10) / 10, totalReviews, positivePercent, totalSales };
  }

  async getBatchSellerStats(resellerIds: number[]): Promise<Record<number, { averageRating: number; totalReviews: number }>> {
    if (resellerIds.length === 0) return {};
    
    // Get all reviews for the given reseller IDs in a single query
    const allReviews = await db.select()
      .from(reviews)
      .where(sql`${reviews.resellerId} IN (${sql.join(resellerIds.map(id => sql`${id}`), sql`,`)})`);
    
    // Group reviews by reseller ID and calculate stats
    const statsMap: Record<number, { averageRating: number; totalReviews: number }> = {};
    
    // Initialize all reseller IDs with default stats
    for (const id of resellerIds) {
      statsMap[id] = { averageRating: 0, totalReviews: 0 };
    }
    
    // Group reviews by reseller
    const reviewsByReseller = new Map<number, number[]>();
    for (const review of allReviews) {
      const ratings = reviewsByReseller.get(review.resellerId) || [];
      ratings.push(review.rating);
      reviewsByReseller.set(review.resellerId, ratings);
    }
    
    // Calculate stats for each reseller
    for (const [resellerId, ratings] of reviewsByReseller) {
      const totalReviews = ratings.length;
      const averageRating = totalReviews > 0 
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / totalReviews) * 10) / 10
        : 0;
      statsMap[resellerId] = { averageRating, totalReviews };
    }
    
    return statsMap;
  }

  // Vendor sessions for persistent authentication
  async createVendorSession(token: string, resellerId: number, expiresAt: Date): Promise<VendorSession> {
    // Delete any existing sessions for this reseller first
    await db.delete(vendorSessions).where(eq(vendorSessions.resellerId, resellerId));
    
    const [session] = await db.insert(vendorSessions).values({
      token,
      resellerId,
      expiresAt,
    }).returning();
    return session;
  }

  async getVendorSession(token: string): Promise<VendorSession | undefined> {
    const [session] = await db.select()
      .from(vendorSessions)
      .where(and(
        eq(vendorSessions.token, token),
        gt(vendorSessions.expiresAt, new Date())
      ));
    return session || undefined;
  }

  async deleteVendorSession(token: string): Promise<void> {
    await db.delete(vendorSessions).where(eq(vendorSessions.token, token));
  }

  async deleteExpiredVendorSessions(): Promise<void> {
    await db.delete(vendorSessions).where(lt(vendorSessions.expiresAt, new Date()));
  }

}

export const storage = new DatabaseStorage();
