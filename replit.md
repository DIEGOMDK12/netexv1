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
- **products**: Digital product catalog (name, description, images, pricing, stock as newline-separated text, active flag)
- **orders**: Order records with email, status, payment details (PIX codes, PagSeguro IDs), coupon information
- **orderItems**: Line items linking orders to products with pricing snapshots
- **coupons**: Discount codes with percentage-based discounts and active flags
- **settings**: Single-row configuration (store name, logo, theme colors, PagSeguro token)

**Data Access Pattern**
- DatabaseStorage class implementing IStorage interface
- All database operations return Promise-based results
- Decimal type for monetary values (precision: 10, scale: 2)
- Auto-incrementing integer primary keys

### External Dependencies

**Payment Processing**
- **Stripe Integration** (Render-compatible, standard SDK)
  - Stripe Checkout for card and boleto payments in BRL
  - Standard webhook verification at `/webhook`
  - Routes: `/api/create-checkout-session`
  - Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- PagSeguro integration for PIX payments (Brazilian instant payment system)
- Order creation generates PIX QR codes and payment codes
- Webhook-based payment confirmation
- Payment polling mechanism in checkout flow

**Development Tools**
- Replit-specific plugins for dev banner and cartographer (conditional, production-excluded)
- Runtime error overlay for development

**Build & Deployment**
- esbuild for server bundling with selective dependency bundling (allowlist approach)
- Vite for client-side bundling
- Separate dist folders for client (`dist/public`) and server (`dist/index.cjs`)
- Production mode uses compiled CommonJS server bundle

**Third-Party Services**
- Google Fonts CDN for DM Sans typography
- Image hosting expected via URLs (logoUrl, product imageUrl fields)
- No file upload system visible (images likely managed externally)

**Session Management**
- `connect-pg-simple` and `express-session` packages present but not actively used in visible code
- Current auth uses simple token-based system instead of sessions