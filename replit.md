# Digital Products Sales Platform

## Overview
This is a full-stack e-commerce platform designed for selling digital products with instant delivery. It features a dark-themed storefront with customizable branding, shopping cart functionality, PIX payment integration, coupon management, and an admin dashboard for comprehensive product and order management. The platform aims to provide a modern, robust solution for digital product sales.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript, using Vite for building.
- **Routing:** Wouter for client-side navigation.
- **Data Fetching:** TanStack Query for server state management and data fetching.
- **UI/Styling:** shadcn/ui components built on Radix UI, styled with Tailwind CSS (custom dark theme, GGMAX aesthetic).
- **Design Principles:** Mobile-first, responsive grid layouts (2, 3, 4 columns), DM Sans font, product cards with persistent buy buttons, real-time cart updates with slide-out panel.
- **State Management:** React Context API for global state (cart, settings) with local storage persistence for cart data.

### Backend
- **Framework:** Express.js with TypeScript, using Node's native `http` module.
- **API Design:** RESTful endpoints under `/api`, token-based authentication for admin routes (in-memory token storage), custom logging middleware.
- **Authentication:** Stateless authentication with tokens (cleared on server restart), single admin user system.
- **Core Features:** Separation of public and sensitive settings, robust webhook handling for payment confirmations.

### Database
- **ORM:** Drizzle ORM for type-safe queries.
- **Database:** PostgreSQL (via Neon's serverless driver).
- **Schema:** Includes `products`, `categories`, `orders`, `orderItems`, `coupons`, `settings`, and `resellers` tables. Employs `drizzle-zod` for validation.
- **Data Handling:** `Decimal` type for monetary values, `IStorage` interface for database operations, auto-incrementing integer primary keys.
- **Category System:** Immutable 5-category structure (Games, Steam, Streaming & TV, Cursos & Tutoriais, Outros) with predefined subcategories, seeded on server startup.

### System Design
- **Multi-vendor Support:** Designed for multiple vendors (resellers) with individual store branding, custom domains, favicons, OG images, and descriptions.
- **Admin Control:** Admin can manage resellers, products, and orders.
- **Image Handling:** Replit Object Storage integration for persistent uploads with fallback to local storage; robust error handling with placeholders; path traversal security vulnerability addressed.
- **Dynamic Content:** Dynamic meta tag injection for SEO and social sharing based on reseller settings.
- **Category Management:** Drag-and-drop reordering for categories.
- **Email Delivery:** Resend integration for transactional emails (order delivery, notifications).
- **Dynamic Products (Variants):** Products can have multiple pricing options (variants) with independent names, prices, and stock. The product display price shows "A partir de R$" with the lowest variant price until customer selects a specific option. Validation requires at least 1 variant with name and price for dynamic products.

## External Dependencies

- **Payment Gateways:**
    - **AbacatePay:** Primary PIX payment integration with dedicated root `/webhook` endpoint for payment confirmation, auto-delivery, and reseller wallet updates.
    - **Stripe:** For card and boleto payments, integrated with Stripe Checkout and webhooks.
    - **PagSeguro:** Legacy PIX payment integration.
- **Email Service:** Resend for automated email delivery of digital products and notifications.
- **Font Hosting:** Google Fonts CDN for DM Sans.
- **Image Storage:** Replit Object Storage for persistent file uploads.