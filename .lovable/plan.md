

# Cargo Management System - Implementation Plan

## Overview
A modern, mobile-first cargo tracking and management web application for a Mongolia-based shipping service. Users can track their shipments from China, and admins can manage cargo registration and handover.

---

## Phase 1: Foundation & Authentication

### 1.1 Database Setup (Supabase)
- **Users/Profiles table** - Phone number, full name (optional)
- **User Roles table** - Secure admin/user role management
- **Delivery Addresses table** - Multiple addresses per user
- **Cargo table** - Track number, phone number, weight, dimensions, status, price, shelf location
- **Notifications table** - News and reminders for users

### 1.2 Authentication
- Registration and login using phone number (email format: phone@cargo.local for Supabase compatibility)
- No SMS verification initially (can be added later)
- Secure session management

---

## Phase 2: User Interface

### 2.1 Home Page / Dashboard
- **Notification Banner** - Display latest news, announcements, and reminders
- **Quick Search** - Search by phone number or tracking number
  - Non-logged-in users: See cargo list with sensitive info hidden
  - Logged-in users: See full cargo details

### 2.2 My Cargo Page (Logged-in users)
- Cargo list table with columns:
  - Sequence number, Track number, Phone number
  - Weight, Size (L×W×H), Status with date, Price
- Checkbox selection for multiple items
- Running total of selected items' prices
- Payment section (placeholder for future Qpay integration)

### 2.3 Profile Page
- Edit phone number and full name
- Manage multiple delivery addresses (add/edit/delete)
- View cargo history (completed shipments)

### 2.4 Tools Section
- **Freight Calculator** - Calculate shipping cost based on:
  - Actual weight (kg)
  - Volumetric weight (L × W × H / 5000)
  - Display which is charged (higher of the two)
- **China Warehouse Info** - Display warehouse address and instructions

---

## Phase 3: Admin Panel

### 3.1 Admin Dashboard
- Overview statistics (pending cargo count, today's registrations)
- Quick access to all admin functions

### 3.2 Cargo Registration
- Step-by-step form:
  1. Enter tracking number
  2. Enter customer phone number
  3. Enter weight and dimensions
  4. Select warehouse shelf location
- Auto-link to existing user or create pending entry

### 3.3 Unassigned Cargo Management
- List of cargo without phone numbers
- Ability to assign phone number later
- Search shows special message for unassigned cargo

### 3.4 Cargo Handover
- Search by phone number
- Filter by status: "Arrived in UB"
- Select items for handover
- Print receipt (basic HTML print, thermal printer support for later)
- Mark as COMPLETED after payment

### 3.5 User & Data Management
- View all users and their cargo
- Edit/delete cargo entries
- Update cargo status manually

---

## Design Approach

### Visual Style
- **Minimal & Clean** - White background, subtle grays, one accent color (blue or green)
- **Mobile-first** - Touch-friendly buttons, full-width cards on mobile
- **Clear typography** - Easy to scan tables and lists
- **Intuitive icons** - Package, truck, warehouse icons for status

### Navigation
- **User side**: Bottom navigation bar (Home, My Cargo, Calculator, Profile)
- **Admin side**: Sidebar navigation with clear sections

---

## Technical Notes
- Supabase for authentication and database
- Row-Level Security (RLS) for data protection
- Secure role management (separate user_roles table)
- Responsive design using Tailwind CSS
- Placeholder payment section ready for Qpay API

---

## Future Enhancements (Not in this phase)
- SMS verification for registration
- Qpay payment integration
- Push notifications
- Thermal printer direct integration
- Delivery tracking updates

