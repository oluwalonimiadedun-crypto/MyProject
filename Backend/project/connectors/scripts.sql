-- Food Truck Milestone DB Schema
-- IMPORTANT: we use "double quotes" to keep the exact names:
-- "FoodTruck"."Users" etc (matches Knex calls like db("FoodTruck.Users"))

BEGIN;

CREATE SCHEMA IF NOT EXISTS "FoodTruck";

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."Users" (
  "userId"     SERIAL PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "email"      TEXT NOT NULL UNIQUE,
  "password"   TEXT NOT NULL,
  "birthDate"  DATE NOT NULL,
  "role"       TEXT NOT NULL CHECK ("role" IN ('customer', 'truckOwner')),
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- TRUCKS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."Trucks" (
  "truckId"     SERIAL PRIMARY KEY,
  "ownerId"     INT NOT NULL REFERENCES "FoodTruck"."Users"("userId") ON DELETE CASCADE,
  "truckName"   TEXT NOT NULL,
  "truckLogo"   TEXT,
  "truckStatus" TEXT NOT NULL DEFAULT 'available' CHECK ("truckStatus" IN ('available','unavailable')),
  "orderStatus" TEXT NOT NULL DEFAULT 'available' CHECK ("orderStatus" IN ('available','unavailable')),
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- MENU ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."MenuItems" (
  "itemId"      SERIAL PRIMARY KEY,
  "truckId"     INT NOT NULL REFERENCES "FoodTruck"."Trucks"("truckId") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "price"       NUMERIC(10,2) NOT NULL CHECK ("price" >= 0),
  "category"    TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'available' CHECK ("status" IN ('available','unavailable')),
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- CARTS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."Carts" (
  "cartId"    SERIAL PRIMARY KEY,
  "userId"    INT NOT NULL REFERENCES "FoodTruck"."Users"("userId") ON DELETE CASCADE,
  "itemId"    INT NOT NULL REFERENCES "FoodTruck"."MenuItems"("itemId") ON DELETE CASCADE,
  "quantity"  INT NOT NULL CHECK ("quantity" > 0),
  "price"     NUMERIC(10,2) NOT NULL CHECK ("price" >= 0), -- unit price stored at add-to-cart time
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- ORDERS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."Orders" (
  "orderId"               SERIAL PRIMARY KEY,
  "userId"                INT NOT NULL REFERENCES "FoodTruck"."Users"("userId") ON DELETE CASCADE,
  "truckId"               INT NOT NULL REFERENCES "FoodTruck"."Trucks"("truckId") ON DELETE CASCADE,
  "orderStatus"           TEXT NOT NULL DEFAULT 'pending'
                           CHECK ("orderStatus" IN ('pending','preparing','ready','completed','cancelled')),
  "totalPrice"            NUMERIC(10,2) NOT NULL CHECK ("totalPrice" >= 0),
  "scheduledPickupTime"   TIMESTAMP NULL,
  "estimatedEarliestPickup" TIMESTAMP NULL,
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."OrderItems" (
  "orderItemId" SERIAL PRIMARY KEY,
  "orderId"     INT NOT NULL REFERENCES "FoodTruck"."Orders"("orderId") ON DELETE CASCADE,
  "itemId"      INT NOT NULL REFERENCES "FoodTruck"."MenuItems"("itemId") ON DELETE RESTRICT,
  "quantity"    INT NOT NULL CHECK ("quantity" > 0),
  "price"       NUMERIC(10,2) NOT NULL CHECK ("price" >= 0) -- unit price at order time
);

-- =========================
-- SESSIONS
-- =========================
CREATE TABLE IF NOT EXISTS "FoodTruck"."Sessions" (
  "sessionId"  SERIAL PRIMARY KEY,
  "userId"     INT NOT NULL REFERENCES "FoodTruck"."Users"("userId") ON DELETE CASCADE,
  "token"      TEXT NOT NULL UNIQUE,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt"  TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '5 hours')
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "idx_sessions_token" ON "FoodTruck"."Sessions"("token");
CREATE INDEX IF NOT EXISTS "idx_menuitems_truck" ON "FoodTruck"."MenuItems"("truckId");
CREATE INDEX IF NOT EXISTS "idx_orders_truck" ON "FoodTruck"."Orders"("truckId");
CREATE INDEX IF NOT EXISTS "idx_carts_user" ON "FoodTruck"."Carts"("userId");

COMMIT;
