# Moodboard Studio

## Overview
Moodboard Studio is a professional, studio-grade web application designed for architecture and interior design studios. Its primary purpose is to transform design inspirations, such as those found on Pinterest, into polished, client-ready design presentations. Key capabilities include AI-powered description generation, automatic color palette extraction, and professional PDF export functionalities. The project aims to provide a sophisticated tool for design professionals, enhancing their presentation workflow and market presence.

## User Preferences
- **Design**: Orange theme, Montserrat font, glassmorphism style with larger rounded corners
- **Color Palette**: Orange primary with warm neutrals
- **Priority**: Frontend quality and visual polish is the primary evaluation criteria
- **Approach**: Design-first, build frontend before backend implementation

## System Architecture
The application is built with a clear separation between frontend and backend.

**UI/UX Decisions:**
- **Design System:** Utilizes Montserrat font, an orange primary color (hsl 24 85% 52%), and extensive glassmorphism effects with `rounded-xl` elements across the application.
- **Theming:** Supports both dark and light modes.
- **Responsiveness:** Designed with mobile-first principles, ensuring adaptive layouts for various screen sizes, including responsive headers and toolbars.
- **Canvas:** Features a paper-proportioned canvas (A4/A3/A2, portrait/landscape) with dynamic image layouts using CSS grid for fixed aspect ratios and CSS columns (masonry) for original layouts. Images feature consistent 4px border-radius and dynamic drop shadows.
- **Interactivity:**
    - **Unlimited Undo/Redo:** Full pin state snapshot history is maintained for comprehensive undo/redo functionality.
    - **Sidebar:** Collapsible sidebar with smooth transitions, integrating all project settings for auto-save on blur.
    - **Dashboard:** Features project grouping by category, enhanced search, sorting options, and visually rich project card thumbnails with full-bleed images and frosted glassmorphism metadata.
    - **PDF Export:** Client-side PDF export using `jspdf` and `html2canvas`, mirroring canvas features and cover page designs.

**Technical Implementations:**
- **Project Creation Wizard:** A 4-step wizard guides users through paper size, orientation, image format, and project naming.
- **Image Handling:**
    - **Pinterest Import:** Scrapes Pinterest boards, extracts images, and dedupes them, with asynchronous background importing and progress polling. Uses longer delays between requests (1.5-2.7s base) and patient retry logic (up to 60s backoff on rate limits, 30 total rate limit tolerance, 12 empty page tolerance) to maximize image extraction from large boards.
    - **Image Descriptions:** Supports manual input and AI generation, with dynamic text color adaptation based on canvas background luminance.
    - **Approval Status:** Pins can be marked as approved/rejected.
- **Image Lightbox:** Click-to-enlarge image preview with next/prev navigation using book page-flip CSS animation. Supports keyboard navigation (Arrow keys, Escape). Component: `client/src/components/image-lightbox.tsx`.
- **AI Integration:** Uses OpenAI GPT-4o-mini for generating project and pin-level descriptions. Pin descriptions focus on physical details (lighting quality, materials, form/shape) rather than abstract concepts, and align with user-provided keywords. AI output is stored in `descriptionAi`/`descriptionFinal` without overwriting user's `descriptionCustomInput`.
- **Admin Panel:** A comprehensive control panel at `/admin` for managing users, finance, affiliates, database exports, and application settings (chat widget, payment gateway). This panel has its own independent, cookie-based authentication.
- **Affiliate System:** Supports both admin-generated and user self-service affiliate codes. Users can access `/affiliate` to generate their own code, copy referral links, view stats (clicks/signups/conversions), and share via WhatsApp/email. Admin panel controls affiliate fee percentage and banner management. Landing page features 3 auto-sliding promo banners (student discount, speed deal, AI description) with student code input.
- **Payment Infrastructure:** Full 12Pay integration: `POST /api/payment/create` builds a payment request using admin-configured server key, creates a transaction record, and returns a payment URL for redirect. `POST /api/payment/webhook` verifies SHA512 signature, updates transaction status, and upgrades user subscription tier on success. Admin panel settings include Server Key, Client Key, and environment toggle (Sandbox/Production). Users can upgrade directly from the dashboard via an Upgrade dialog showing Lite (Rp 88K) and Pro (Rp 176K) plans. Payment result (`?payment=success/failed`) handled on return to dashboard.

**Feature Specifications:**
- **Project Management:** Dashboard for creating, managing, sharing, and exporting projects.
- **Pin Management:** Editor for adding, deleting, reordering, shuffling, and describing pins.
- **Client & Studio Info:** Comprehensive settings for studio details, client information, and project descriptions.
- **Share Functionality:** Generate shareable links with WhatsApp/email integration and a public share preview page.
- **Subscription Tiers:** Implemented for Free Trial, Studio Lite, and Studio Pro, defining project limits and watermarking.

## External Dependencies
- **Frontend Framework:** React
- **Build Tool:** Vite
- **Styling:** TailwindCSS, shadcn/ui
- **Routing:** wouter
- **State Management:** TanStack React Query
- **Backend Framework:** Express.js
- **Database:** PostgreSQL (managed with Drizzle ORM)
- **Authentication:** Replit-managed Clerk with cookie-based web sessions and a local user bridge
- **Artificial Intelligence:** OpenAI (GPT-4o-mini)
- **PDF Generation:** jspdf, html2canvas
- **Object Storage:** Google Cloud Storage (GCS) for logo uploads
- **Chat Widget:** chatvice.app (integrated via admin settings)