# Design Guidelines: Digital Products Sales Platform

## Design Approach
**Reference-Based Approach:** Dark e-commerce platforms with emphasis on product presentation and conversion optimization. Drawing inspiration from modern digital marketplaces with GGMAX aesthetic - deep dark backgrounds, vibrant accent colors, and clean product-focused layouts.

## Core Design Elements

### A. Typography
- **Primary Font:** Inter or DM Sans via Google Fonts CDN
- **Headings:** Font weight 700, sizes: text-2xl (mobile) to text-4xl (desktop)
- **Product Names:** Font weight 600, text-lg to text-xl
- **Body Text:** Font weight 400, text-sm to text-base
- **Price Display:** Font weight 700 for current price, font weight 400 with line-through for original price
- **User-Customizable:** All text colors must be editable from admin settings

### B. Color System
- **Base Background:** #121212 (deep dark mode)
- **Card Background:** #1E1E1E to #242424 (slightly lighter than base)
- **Customizable Theme Color:** Default #3B82F6 (blue), user-editable for buttons/highlights/CTAs
- **Customizable Text Color:** Default #FFFFFF, user-editable for all text elements
- **Borders:** rgba(255, 255, 255, 0.1) for subtle separation
- **Success States:** #10B981 (green) for payment confirmation
- **Error States:** #EF4444 (red) for validation errors

### C. Layout System
- **Spacing Units:** Tailwind units of 2, 4, 6, and 8 (p-2, m-4, gap-6, etc.)
- **Mobile Product Grid:** 2-column layout (grid-cols-2) - CRITICAL requirement
- **Tablet:** 3-column layout (md:grid-cols-3)
- **Desktop:** 4-column layout (lg:grid-cols-4)
- **Container Max-Width:** max-w-7xl with px-4 padding
- **Card Spacing:** gap-4 on mobile, gap-6 on desktop

### D. Component Library

#### Product Cards
- **Structure:** Compact, rounded corners (rounded-xl)
- **Image:** Aspect ratio 1:1, object-cover, rounded-t-xl
- **Content Padding:** p-4
- **Price Display:** 
  - Original price: text-sm, line-through, opacity-60
  - Current price: text-xl, font-bold, theme color
- **Buy Button:** ALWAYS VISIBLE at card bottom (not on hover)
  - Compact height (h-10), full width
  - Rounded corners (rounded-lg)
  - Theme color background
  - No hover transformations, only opacity change

#### Navigation Header
- **Height:** h-16 on mobile, h-20 on desktop
- **Logo:** User-uploaded image, max height h-12
- **Cart Icon:** Fixed position on right with badge counter
- **Background:** Slightly lighter than base (#1A1A1A) with bottom border

#### Shopping Cart
- **Style:** Slide-in panel from right side
- **Width:** full on mobile, max-w-md on desktop
- **Item Display:** List with small thumbnail, name, price, quantity controls
- **Compact Layout:** py-2 per item, minimal spacing

#### Checkout Flow
- **Email Input:** Single field, no password required
- **Coupon Field:** Below cart summary, inline with apply button
- **Payment Method:** PIX only, display QR code and code prominently
- **Modal Size:** max-w-lg on desktop, full-screen on mobile

#### Delivery Modal (Post-Payment)
- **Trigger:** Immediately when payment status = "PAID"
- **Style:** Centered modal with semi-transparent dark backdrop
- **Content:** Large text area showing purchased item/code
- **Background:** #1E1E1E with rounded-2xl, p-8
- **Close Button:** Prominent X in top-right corner

#### Admin Panel
- **Layout:** Sidebar navigation (w-64 on desktop, collapsible on mobile)
- **Sections:** Products, Orders, Settings tabs
- **Forms:** Vertical layout with labels above inputs
- **Settings Panel:**
  - Color pickers for theme color and text color
  - Text input for store name
  - URL input for logo
  - Textarea for PagSeguro API credentials
- **Data Tables:** Striped rows, compact padding, scrollable on mobile

#### Form Elements
- **Inputs:** h-10, rounded-lg, border with rgba(255,255,255,0.1)
- **Focus State:** Border with theme color, no ring
- **Textareas:** min-h-32 for stock management field
- **Buttons:** Compact (h-10), rounded-lg, no oversized elements
- **Labels:** text-sm, mb-2, customizable text color

### E. Visual Treatments
- **Elevation:** Subtle box-shadow on cards: `0 2px 8px rgba(0,0,0,0.3)`
- **Borders:** 1px solid rgba(255,255,255,0.1) for separation
- **Hover States:** Opacity change (opacity-90) only, no transformations
- **Loading States:** Pulse animation on skeleton screens
- **Transitions:** Short duration (150ms) for all interactive elements

### F. Responsive Breakpoints
- **Mobile:** Base styles, 2-column product grid
- **Tablet (md: 768px):** 3-column grid, expanded header
- **Desktop (lg: 1024px):** 4-column grid, sidebar admin panel

## Images
**Product Images:** User-uploaded via URL, displayed in 1:1 aspect ratio cards with rounded tops
**Logo:** User-uploaded via URL in admin settings, displayed in header
**No Hero Image:** This is a product catalog platform focused on grid-based browsing

## Accessibility
- Maintain WCAG AA contrast ratios against dark backgrounds
- Ensure customizable text colors meet contrast requirements
- Touch targets minimum 44x44px on mobile
- Focus indicators visible on all interactive elements