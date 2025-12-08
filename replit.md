# Digital Products Sales Platform

## Overview

This is a full-stack e-commerce platform for selling digital products with instant delivery. The application features a dark-themed storefront with customizable branding, shopping cart functionality, PIX payment integration via PagSeguro, coupon management, and an admin dashboard for product and order management.

The platform is built with a modern TypeScript stack using React on the frontend and Express on the backend, with PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and data fetching

**UI Component Library**
- shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with a custom dark theme configuration
- Design system follows "GGMAX aesthetic" with emphasis on dark e-commerce presentation
- Responsive grid layouts: 2 columns (mobile), 3 columns (tablet), 4 columns (desktop)

**State Management**
- React Context API for global store state (cart, settings)
- Local storage persistence for cart data
- TanStack Query for server-side state caching and synchronization

**Key Design Decisions**
- Dark theme as default (#121212 base, #1E1E1E cards) with user-customizable theme and text colors
- Mobile-first responsive design with critical 2-column product grid requirement
- DM Sans as primary font via Google Fonts CDN
- Product cards with always-visible buy buttons (no hover states)
- Real-time cart updates with slide-out panel UI

### Backend Architecture

**Server Framework**
- Express.js with TypeScript
- HTTP server using Node's native `http` module
- Custom logging middleware for request tracking
- JSON body parsing with raw body preservation for webhook validation

**API Design**
- RESTful endpoints under `/api` prefix
- Token-based authentication for admin routes
- In-memory token storage using Set data structure
- Hardcoded admin credentials (username: "Diegomdk", password: "506731Diego#")

**Route Organization**
- Public routes: `/api/products`, `/api/settings`
- Protected admin routes: `/api/admin/*`
- Authentication via Bearer token in Authorization header
- Simple token generation using crypto.randomBytes

**Key Backend Decisions**
- Stateless authentication (tokens stored in-memory, cleared on server restart)
- Single admin user system (no multi-user support)
- Separation of public settings (exposed to frontend) from sensitive settings (PagSeguro token)

### Database Layer

**ORM & Database**
- Drizzle ORM for type-safe database queries
- PostgreSQL via Neon's serverless driver with WebSocket support
- Schema-first approach with `drizzle-zod` for validation

**Database Schema**
- **products**: Digital product catalog (name, slug, description, images, pricing, stock as newline-separated license keys, categoryId, active flag, limitPerUser toggle)
- **categories**: Vendor-specific product categories (name, slug, icon, resellerId for vendor isolation)
- **orders**: Order records with email, status, payment details (PIX codes, PagSeguro IDs), coupon information
- **orderItems**: Line items linking orders to products with pricing snapshots
- **coupons**: Discount codes with percentage-based discounts and active flags
- **settings**: Single-row configuration (store name, logo, theme colors, PagSeguro token)
- **resellers**: Multi-vendor support with individual store branding and subscription management

**Data Access Pattern**
- DatabaseStorage class implementing IStorage interface
- All database operations return Promise-based results
- Decimal type for monetary values (precision: 10, scale: 2)
- Auto-incrementing integer primary keys

### External Dependencies

**Payment Processing**
- **AbacatePay Integration** (Primary PIX Payment Gateway)
  - PIX QR Code generation via AbacatePay API
  - **Main Webhook Endpoint**: `POST /webhook` (root path, NOT under /api)
    - Production URL: `https://goldnetsteam.shop/webhook`
    - CORS configured for external AbacatePay requests
    - Handles `billing.paid` event for payment confirmation
    - Auto-delivery: Removes key from stock and saves to order
    - Updates order status to `paid`
    - Sends delivery email automatically
    - Updates reseller wallet balance
  - Environment variables: `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`
- **Stripe Integration** (Render-compatible, standard SDK)
  - Stripe Checkout for card and boleto payments in BRL
  - Standard webhook verification at `/webhook`
  - Routes: `/api/create-checkout-session`
  - Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- PagSeguro integration for PIX payments (Brazilian instant payment system)
- Order creation generates PIX QR codes and payment codes
- Legacy webhooks at `/api/webhook/abacatepay` and `/api/webhooks/abacatepay`
- Payment polling mechanism in checkout flow

**Development Tools**
- Replit-specific plugins for dev banner and cartographer (conditional, production-excluded)
- Runtime error overlay for development

**Build & Deployment**
- esbuild for server bundling with selective dependency bundling (allowlist approach)
- Vite for client-side bundling
- Separate dist folders for client (`dist/public`) and server (`dist/index.cjs`)
- Production mode uses compiled CommonJS server bundle

**Email Delivery**
- Resend integration for automatic email delivery of digital products
- Environment variable: `RESEND_API_KEY`
- Email sent automatically when order is approved (admin, vendor, or webhook)
- HTML email template with dark theme matching store aesthetic
- All user-generated content is HTML-escaped for security

**Third-Party Services**
- Google Fonts CDN for DM Sans typography
- Image hosting expected via URLs (logoUrl, product imageUrl fields)
- Resend for transactional email delivery

**Session Management**
- `connect-pg-simple` and `express-session` packages present but not actively used in visible code
- Current auth uses simple token-based system instead of sessions

## Recent Changes

**December 8, 2024 - Resend Delivery Email Feature**
- Added "Reenviar E-mail de Entrega" button on /pedidos page for paid orders
- New API endpoint: POST /api/orders/:id/resend-email
  - Validates order exists and status is "paid"
  - Verifies requester email matches order email for security
  - Retrieves order items and builds product names
  - Fetches store name from reseller or global settings
  - Calls sendDeliveryEmail to resend the delivery content
  - Returns success/error messages in Portuguese
- Frontend updates (my-orders.tsx):
  - Button only visible for paid orders with delivered content
  - Loading state with spinner during email resend
  - Toast notifications for success/error feedback
  - Uses TanStack Query mutation with apiRequest

**December 8, 2024 - Custom Domain System (White Label)**
- Resellers can now configure their own domain (e.g., meusite.com) to serve their store
- Schema: Added `.unique()` constraint to `customDomain` field in resellers table for fast lookups
- Storage: Added `getResellerByDomain(domain)` function for domain-based reseller lookup
- Frontend (vendor-settings.tsx):
  - New "Dominio Personalizado" card with Globe icon
  - Input for custom domain with automatic normalization (removes http://, www, trailing slashes)
  - Clear Cloudflare CNAME instructions:
    1. Create CNAME record pointing to `goldnetsteam.shop`
    2. Set proxy mode (orange cloud)
    3. Save domain in settings
  - Copy button for CNAME target
  - DNS propagation warning (up to 24 hours)
- Backend (server/index.ts):
  - Middleware runs BEFORE all routes
  - Detects custom domains (excludes goldnetsteam.shop, localhost, replit.dev)
  - Looks up reseller by domain using `storage.getResellerByDomain()`
  - Rewrites URL to `/loja/[slug]` to serve correct store transparently
  - Injects reseller info into request as `req.customDomainReseller`
- API Endpoint: `GET /api/domain/lookup?domain=example.com`
  - Returns `{ isCustomDomain: true/false, reseller: {...} }`
  - Used by frontend to detect custom domain context

**December 8, 2024 - AbacatePay Webhook at /webhook (Root Path)**
- Created dedicated webhook endpoint at `POST /webhook` (NOT under /api prefix)
- Production URL: `https://goldnetsteam.shop/webhook`
- CORS configured to accept external requests from AbacatePay
- Debug logging at start: `console.log('Webhook recebido em /webhook:', req.body.event)`
- Handles `billing.paid` event with full delivery logic:
  - Locates order by billing_id, metadata.order_id, or externalId
  - Updates status to 'paid'
  - Executes FIFO stock delivery (removes keys from stock)
  - Saves delivered content to order
  - Updates reseller wallet balance
  - Sends delivery email
- Always returns HTTP 200 to AbacatePay (prevents retry loops)

**December 8, 2024 - Per-Reseller Customization (Favicon, OG-Image, Description)**
- Added 3 new fields to resellers table: `faviconUrl`, `ogImageUrl`, `storeDescription`
- Each reseller store now displays its own favicon and og-image (WhatsApp/Facebook previews)
- Dynamic meta tag injection in reseller-store.tsx - automatically updates title, description, og:image, favicon
- Vendor settings UI panel now includes:
  - Textarea for custom store description (appears in Google Search & social sharing)
  - Input/Upload button for favicon (shows preview as 8x8px icon)
  - Input/Upload button for og-image (shows preview as 16x16px thumbnail)
- API endpoints updated: GET/PUT /api/vendor/profile include customization fields
- Upload integration with /api/upload endpoint (supports both vendors and admins)
- Backend validates and stores URLs/uploads securely with vendor authentication check

**December 2024 - Drag-and-Drop Category Ordering**
- Implemented drag-and-drop category reordering using @dnd-kit library
- SortableCategoryItem component with GripVertical drag handle
- POST /api/vendor/categories/reorder endpoint persists displayOrder in database
- Optimistic UI updates with automatic rollback on error
- Categories use displayOrder field for persistent ordering

**December 2024 - Product Image Display Fix**
- All product images use object-fit: contain with bg-gray-900 background
- Prevents image cropping and shows full images properly
- Applied to: product cards, product details, vendor management, reseller store

**December 8, 2024 - Fixed Categories and Subcategories System**
- Implemented immutable 5-category structure for the GGMAX marketplace
- Categories are seeded on every server startup via upsert logic in server/index.ts
- Fixed categories with their subcategories:
  1. Games: [Contas, Itens, Moedas, Servicos, Outros]
  2. Steam: [Chaves (Keys), Contas, Gift Cards, Jogos, Saldo]
  3. Streaming & TV: [Netflix, Disney+, Prime Video, Spotify, IPTV, Outros]
  4. Cursos & Tutoriais: [Marketing, Programacao, Metodos, E-books, Mentoria]
  5. Outros: [Diversos, Vouchers, Promocoes]
- API endpoints filter categories by slug allowlist: games, steam, streaming-tv, cursos-tutoriais, outros
- Vendors/admins can only select from predefined categories and subcategories via dropdown menus
- No ability to create, edit, or delete categories - only selection from fixed list
- Home page displays only the 5 fixed categories with proper icons and images

**December 8, 2024 - Image Persistence & Error Handling**
- Implemented Replit Object Storage integration for persistent file uploads in production
  - Uses @replit/object-storage package with lazy initialization
  - Falls back to local /uploads directory when Object Storage is not configured
  - Upload endpoint saves to both Object Storage (when available) and local storage
- Added robust image error handling across all product displays:
  - Product cards, product details, and home page ProductCardMini
  - Shows Package icon placeholder when images fail to load
  - Uses React state to track image loading errors
- Fixed critical path traversal security vulnerability:
  - Both /uploads/:filename and /api/images/:filename endpoints now validate filenames
  - Blocks requests containing '..', '/', or '\\' characters
  - Uses path.resolve() to verify resolved paths stay within uploads directory
- Note: Object Storage requires bucket configuration in Replit for production persistence