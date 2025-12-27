// routes/foodtruck.js
const db = require("../connectors/db");

// -------------------------
// Helpers
// -------------------------
async function getCurrentUser(req) {
  if (!req.userId) return null;
  return db("FoodTruck.Users").where({ userId: req.userId }).first();
}

async function getMyTruck(req) {
  const user = await getCurrentUser(req);
  if (!user) return null;
  if (user.role !== "truckOwner") return null;
  return db("FoodTruck.Trucks").where({ ownerId: user.userId }).first();
}

function requireRole(role) {
  return async (req, res, next) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      if (user.role !== role) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  };
}

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function normalizeInsertedId(insertResult, idField) {
  // knex insert may return: [id] or [{idField: id}]
  if (!Array.isArray(insertResult) || insertResult.length === 0) return null;
  const first = insertResult[0];
  if (first && typeof first === "object") return first[idField];
  return first;
}

// -------------------------
// Main routes
// -------------------------
function attachFoodTruckRoutes(app) {
  // =========================================================
  // MENU ITEM MANAGEMENT (truckOwner)
  // =========================================================

  // POST /api/v1/menuItem/new
  app.post("/api/v1/menuItem/new", requireRole("truckOwner"), async (req, res) => {
    try {
      const { name, price, description, category } = req.body;

      if (!name || price === undefined || !description || !category) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      await db("FoodTruck.MenuItems").insert({
        truckId: truck.truckId,
        name,
        description,
        price,
        category,
        status: "available",
      });

      return res.status(201).json({ message: "menu item was created successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/menuItem/view   (view my menu items)
  app.get("/api/v1/menuItem/view", requireRole("truckOwner"), async (req, res) => {
    try {
      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const items = await db("FoodTruck.MenuItems")
        .where({ truckId: truck.truckId, status: "available" })
        .select("itemId", "truckId", "name", "description", "price", "category", "status", "createdAt")
        .orderBy("itemId", "asc");

      return res.json(items);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/menuItem/view/:itemId
  app.get("/api/v1/menuItem/view/:itemId", requireRole("truckOwner"), async (req, res) => {
    try {
      const itemId = parseIntStrict(req.params.itemId);
      if (!Number.isFinite(itemId)) return res.status(400).json({ error: "Invalid itemId" });

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const item = await db("FoodTruck.MenuItems")
        .where({ itemId, truckId: truck.truckId })
        .first();

      if (!item) return res.status(404).json({ error: "Menu item not found" });

      return res.json(item);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/v1/menuItem/edit/:itemId
  app.put("/api/v1/menuItem/edit/:itemId", requireRole("truckOwner"), async (req, res) => {
    try {
      const itemId = parseIntStrict(req.params.itemId);
      if (!Number.isFinite(itemId)) return res.status(400).json({ error: "Invalid itemId" });

      const { name, price, description, category } = req.body;
      if (name === undefined && price === undefined && description === undefined && category === undefined) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const existing = await db("FoodTruck.MenuItems")
        .where({ itemId, truckId: truck.truckId })
        .first();

      if (!existing) return res.status(404).json({ error: "Menu item not found" });

      await db("FoodTruck.MenuItems")
        .where({ itemId, truckId: truck.truckId })
        .update({
          ...(name !== undefined ? { name } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
        });

      return res.json({ message: "menu item updated successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/v1/menuItem/delete/:itemId  (soft delete => status=unavailable)
  app.delete("/api/v1/menuItem/delete/:itemId", requireRole("truckOwner"), async (req, res) => {
    try {
      const itemId = parseIntStrict(req.params.itemId);
      if (!Number.isFinite(itemId)) return res.status(400).json({ error: "Invalid itemId" });

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const existing = await db("FoodTruck.MenuItems")
        .where({ itemId, truckId: truck.truckId })
        .first();

      if (!existing) return res.status(404).json({ error: "Menu item not found" });

      await db("FoodTruck.MenuItems")
        .where({ itemId, truckId: truck.truckId })
        .update({ status: "unavailable" });

      return res.json({ message: "menu item deleted successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // =========================================================
  // TRUCK MANAGEMENT
  // =========================================================

  // GET /api/v1/trucks/view  (customer)
  app.get("/api/v1/trucks/view", async (req, res) => {
    try {
      // show only available + accepting orders
      const trucks = await db("FoodTruck.Trucks")
        .where({ truckStatus: "available", orderStatus: "available" })
        .select("truckId", "truckName", "truckLogo", "truckStatus", "orderStatus")
        .orderBy("truckId", "asc");

      return res.json(trucks);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/trucks/myTruck  (truckOwner)
  app.get("/api/v1/trucks/myTruck", requireRole("truckOwner"), async (req, res) => {
    try {
      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });
      return res.json(truck);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/v1/trucks/updateOrderStatus  (truckOwner)
  app.put("/api/v1/trucks/updateOrderStatus", requireRole("truckOwner"), async (req, res) => {
    try {
      const { orderStatus } = req.body;
      if (!orderStatus) return res.status(400).json({ error: "Missing orderStatus" });

      const allowed = new Set(["available", "unavailable"]);
      if (!allowed.has(orderStatus)) return res.status(400).json({ error: "Invalid orderStatus" });

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      await db("FoodTruck.Trucks")
        .where({ truckId: truck.truckId })
        .update({ orderStatus });

      return res.json({ message: "truck order status updated successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // =========================================================
  // BROWSE MENU (customer)
  // =========================================================

  // GET /api/v1/menuItem/truck/:truckId
  app.get("/api/v1/menuItem/truck/:truckId", async (req, res) => {
    try {
      const truckId = parseIntStrict(req.params.truckId);
      if (!Number.isFinite(truckId)) return res.status(400).json({ error: "Invalid truckId" });

      const truck = await db("FoodTruck.Trucks").where({ truckId }).first();
      if (!truck) return res.status(404).json({ error: "Truck not found" });
      if (truck.truckStatus !== "available") return res.status(400).json({ error: "Truck not available" });

      const items = await db("FoodTruck.MenuItems")
        .where({ truckId, status: "available" })
        .select("itemId", "truckId", "name", "description", "price", "category", "status", "createdAt")
        .orderBy("itemId", "asc");

      return res.json(items);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/menuItem/truck/:truckId/category/:category
  app.get("/api/v1/menuItem/truck/:truckId/category/:category", async (req, res) => {
    try {
      const truckId = parseIntStrict(req.params.truckId);
      const { category } = req.params;
      if (!Number.isFinite(truckId)) return res.status(400).json({ error: "Invalid truckId" });
      if (!category) return res.status(400).json({ error: "Invalid category" });

      const truck = await db("FoodTruck.Trucks").where({ truckId }).first();
      if (!truck) return res.status(404).json({ error: "Truck not found" });
      if (truck.truckStatus !== "available") return res.status(400).json({ error: "Truck not available" });

      const items = await db("FoodTruck.MenuItems")
        .where({ truckId, category, status: "available" })
        .select("itemId", "truckId", "name", "description", "price", "category", "status", "createdAt")
        .orderBy("itemId", "asc");

      return res.json(items);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // =========================================================
  // CART MANAGEMENT (customer)
  // =========================================================

  // POST /api/v1/cart/new
  app.post("/api/v1/cart/new", requireRole("customer"), async (req, res) => {
    try {
      const { itemId, quantity, price } = req.body;

      const _itemId = parseIntStrict(itemId);
      const _qty = parseIntStrict(quantity);

      if (!Number.isFinite(_itemId) || !Number.isFinite(_qty) || _qty <= 0 || price === undefined) {
        return res.status(400).json({ error: "Invalid cart data" });
      }

      const menuItem = await db("FoodTruck.MenuItems").where({ itemId: _itemId }).first();
      if (!menuItem || menuItem.status !== "available") {
        return res.status(404).json({ error: "Menu item not found" });
      }

      // Enforce: cart must be from ONE truck only
      const existing = await db("FoodTruck.Carts")
        .join("FoodTruck.MenuItems", "FoodTruck.Carts.itemId", "FoodTruck.MenuItems.itemId")
        .where("FoodTruck.Carts.userId", req.userId)
        .select("FoodTruck.MenuItems.truckId");

      if (existing.length > 0) {
        const existingTruckId = existing[0].truckId;
        if (existingTruckId !== menuItem.truckId) {
          return res.status(400).json({ error: "Cannot order from multiple trucks" });
        }
      }

      // If same item already exists in cart => update quantity
      const existingRow = await db("FoodTruck.Carts")
        .where({ userId: req.userId, itemId: _itemId })
        .first();

      if (existingRow) {
        await db("FoodTruck.Carts")
          .where({ cartId: existingRow.cartId, userId: req.userId })
          .update({ quantity: existingRow.quantity + _qty, price });
      } else {
        await db("FoodTruck.Carts").insert({
          userId: req.userId,
          itemId: _itemId,
          quantity: _qty,
          price,
        });
      }

      return res.status(201).json({ message: "item added to cart successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/cart/view
  app.get("/api/v1/cart/view", requireRole("customer"), async (req, res) => {
    try {
      const rows = await db("FoodTruck.Carts")
        .join("FoodTruck.MenuItems", "FoodTruck.Carts.itemId", "FoodTruck.MenuItems.itemId")
        .where("FoodTruck.Carts.userId", req.userId)
        .select(
          "FoodTruck.Carts.cartId",
          "FoodTruck.Carts.userId",
          "FoodTruck.Carts.itemId",
          db.raw('"FoodTruck"."MenuItems"."name" as "itemName"'),
          "FoodTruck.Carts.price",
          "FoodTruck.Carts.quantity"
        )
        .orderBy("FoodTruck.Carts.cartId", "asc");

      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/v1/cart/edit/:cartId
  app.put("/api/v1/cart/edit/:cartId", requireRole("customer"), async (req, res) => {
    try {
      const cartId = parseIntStrict(req.params.cartId);
      const quantity = parseIntStrict(req.body.quantity);

      if (!Number.isFinite(cartId)) return res.status(400).json({ error: "Invalid cartId" });
      if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: "Invalid quantity" });

      const existing = await db("FoodTruck.Carts").where({ cartId, userId: req.userId }).first();
      if (!existing) return res.status(404).json({ error: "Cart item not found" });

      await db("FoodTruck.Carts").where({ cartId, userId: req.userId }).update({ quantity });

      return res.json({ message: "cart updated successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/v1/cart/delete/:cartId
  app.delete("/api/v1/cart/delete/:cartId", requireRole("customer"), async (req, res) => {
    try {
      const cartId = parseIntStrict(req.params.cartId);
      if (!Number.isFinite(cartId)) return res.status(400).json({ error: "Invalid cartId" });

      const existing = await db("FoodTruck.Carts").where({ cartId, userId: req.userId }).first();
      if (!existing) return res.status(404).json({ error: "Cart item not found" });

      await db("FoodTruck.Carts").where({ cartId, userId: req.userId }).del();

      return res.json({ message: "item removed from cart successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // =========================================================
  // ORDER MANAGEMENT
  // =========================================================

  // POST /api/v1/order/new  (customer)
  app.post("/api/v1/order/new", requireRole("customer"), async (req, res) => {
    try {
      const { scheduledPickupTime } = req.body;
      const scheduled = new Date(scheduledPickupTime);

      if (!scheduledPickupTime || !isValidDate(scheduled)) {
        return res.status(400).json({ error: "Invalid scheduledPickupTime" });
      }

      // pull cart rows
      const cartRows = await db("FoodTruck.Carts")
        .join("FoodTruck.MenuItems", "FoodTruck.Carts.itemId", "FoodTruck.MenuItems.itemId")
        .where("FoodTruck.Carts.userId", req.userId)
        .select(
          "FoodTruck.Carts.cartId",
          "FoodTruck.Carts.itemId",
          "FoodTruck.Carts.quantity",
          "FoodTruck.Carts.price",
          "FoodTruck.MenuItems.truckId"
        );

      if (cartRows.length === 0) return res.status(400).json({ error: "Cart is empty" });

      // enforce one truck
      const truckIds = [...new Set(cartRows.map((r) => r.truckId))];
      if (truckIds.length !== 1) return res.status(400).json({ error: "Cannot order from multiple trucks" });

      const truckId = truckIds[0];

      const truck = await db("FoodTruck.Trucks").where({ truckId }).first();
      if (!truck) return res.status(404).json({ error: "Truck not found" });
      if (truck.truckStatus !== "available" || truck.orderStatus !== "available") {
        return res.status(400).json({ error: "Truck not accepting orders" });
      }

      // totalPrice
      const totalPrice = cartRows.reduce(
        (sum, r) => sum + Number(r.price) * Number(r.quantity),
        0
      );

      // estimatedEarliestPickup = scheduledPickupTime - 30 minutes (as in examples)
      const estimatedEarliestPickup = new Date(scheduled.getTime() - 30 * 60 * 1000);

      // create order
      const inserted = await db("FoodTruck.Orders")
        .insert({
          userId: req.userId,
          truckId,
          orderStatus: "pending",
          totalPrice,
          scheduledPickupTime: scheduled.toISOString(),
          estimatedEarliestPickup: estimatedEarliestPickup.toISOString(),
        })
        .returning("orderId");

      const orderId = normalizeInsertedId(inserted, "orderId");
      if (!orderId) return res.status(500).json({ error: "Failed to create order" });

      // create order items
      const orderItems = cartRows.map((r) => ({
        orderId,
        itemId: r.itemId,
        quantity: r.quantity,
        price: r.price,
      }));

      await db("FoodTruck.OrderItems").insert(orderItems);

      // clear cart
      await db("FoodTruck.Carts").where({ userId: req.userId }).del();

      return res.status(201).json({ message: "order placed successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/order/myOrders  (customer)
  app.get("/api/v1/order/myOrders", requireRole("customer"), async (req, res) => {
    try {
      const orders = await db("FoodTruck.Orders")
        .join("FoodTruck.Trucks", "FoodTruck.Orders.truckId", "FoodTruck.Trucks.truckId")
        .where("FoodTruck.Orders.userId", req.userId)
        .select(
          "FoodTruck.Orders.orderId",
          db.raw('"FoodTruck"."Trucks"."truckName" as "truckName"'),
          "FoodTruck.Orders.orderStatus",
          "FoodTruck.Orders.totalPrice",
          "FoodTruck.Orders.scheduledPickupTime",
          "FoodTruck.Orders.estimatedEarliestPickup",
          "FoodTruck.Orders.createdAt"
        )
        .orderBy("FoodTruck.Orders.orderId", "desc");

      return res.json(orders);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/order/details/:orderId  (customer)
  app.get("/api/v1/order/details/:orderId", requireRole("customer"), async (req, res) => {
    try {
      const orderId = parseIntStrict(req.params.orderId);
      if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid orderId" });

      const order = await db("FoodTruck.Orders")
        .join("FoodTruck.Trucks", "FoodTruck.Orders.truckId", "FoodTruck.Trucks.truckId")
        .where({ "FoodTruck.Orders.orderId": orderId, "FoodTruck.Orders.userId": req.userId })
        .select(
          "FoodTruck.Orders.orderId",
          db.raw('"FoodTruck"."Trucks"."truckName" as "truckName"'),
          "FoodTruck.Orders.orderStatus",
          "FoodTruck.Orders.totalPrice",
          "FoodTruck.Orders.scheduledPickupTime",
          "FoodTruck.Orders.estimatedEarliestPickup",
          "FoodTruck.Orders.createdAt"
        )
        .first();

      if (!order) return res.status(404).json({ error: "Order not found" });

      const items = await db("FoodTruck.OrderItems")
        .join("FoodTruck.MenuItems", "FoodTruck.OrderItems.itemId", "FoodTruck.MenuItems.itemId")
        .where("FoodTruck.OrderItems.orderId", orderId)
        .select(
          db.raw('"FoodTruck"."MenuItems"."name" as "itemName"'),
          "FoodTruck.OrderItems.quantity",
          "FoodTruck.OrderItems.price"
        )
        .orderBy("FoodTruck.OrderItems.orderItemId", "asc");

      return res.json({ ...order, items });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/order/truckOrders  (truckOwner)
  app.get("/api/v1/order/truckOrders", requireRole("truckOwner"), async (req, res) => {
    try {
      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const orders = await db("FoodTruck.Orders")
        .join("FoodTruck.Users", "FoodTruck.Orders.userId", "FoodTruck.Users.userId")
        .where("FoodTruck.Orders.truckId", truck.truckId)
        .select(
          "FoodTruck.Orders.orderId",
          "FoodTruck.Orders.userId",
          db.raw('"FoodTruck"."Users"."name" as "customerName"'),
          "FoodTruck.Orders.orderStatus",
          "FoodTruck.Orders.totalPrice",
          "FoodTruck.Orders.scheduledPickupTime",
          "FoodTruck.Orders.estimatedEarliestPickup",
          "FoodTruck.Orders.createdAt"
        )
        .orderBy("FoodTruck.Orders.orderId", "desc");

      return res.json(orders);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/v1/order/updateStatus/:orderId  (truckOwner)
  app.put("/api/v1/order/updateStatus/:orderId", requireRole("truckOwner"), async (req, res) => {
    try {
      const orderId = parseIntStrict(req.params.orderId);
      if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid orderId" });

      const { orderStatus, estimatedEarliestPickup } = req.body;

      const allowed = new Set(["pending", "preparing", "ready", "completed", "cancelled"]);
      if (!orderStatus || !allowed.has(orderStatus)) {
        return res.status(400).json({ error: "Invalid orderStatus" });
      }

      const est = new Date(estimatedEarliestPickup);
      if (!estimatedEarliestPickup || !isValidDate(est)) {
        return res.status(400).json({ error: "Invalid estimatedEarliestPickup" });
      }

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const order = await db("FoodTruck.Orders").where({ orderId, truckId: truck.truckId }).first();
      if (!order) return res.status(404).json({ error: "Order not found" });

      await db("FoodTruck.Orders")
        .where({ orderId, truckId: truck.truckId })
        .update({
          orderStatus,
          estimatedEarliestPickup: est.toISOString(),
        });

      return res.json({ message: "order status updated successfully" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/v1/order/truckOwner/:orderId  (truckOwner order details)
  app.get("/api/v1/order/truckOwner/:orderId", requireRole("truckOwner"), async (req, res) => {
    try {
      const orderId = parseIntStrict(req.params.orderId);
      if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid orderId" });

      const truck = await getMyTruck(req);
      if (!truck) return res.status(404).json({ error: "Truck not found" });

      const order = await db("FoodTruck.Orders")
        .join("FoodTruck.Trucks", "FoodTruck.Orders.truckId", "FoodTruck.Trucks.truckId")
        .where({ "FoodTruck.Orders.orderId": orderId, "FoodTruck.Orders.truckId": truck.truckId })
        .select(
          "FoodTruck.Orders.orderId",
          db.raw('"FoodTruck"."Trucks"."truckName" as "truckName"'),
          "FoodTruck.Orders.orderStatus",
          "FoodTruck.Orders.totalPrice",
          "FoodTruck.Orders.scheduledPickupTime",
          "FoodTruck.Orders.estimatedEarliestPickup",
          "FoodTruck.Orders.createdAt"
        )
        .first();

      if (!order) return res.status(404).json({ error: "Order not found" });

      const items = await db("FoodTruck.OrderItems")
        .join("FoodTruck.MenuItems", "FoodTruck.OrderItems.itemId", "FoodTruck.MenuItems.itemId")
        .where("FoodTruck.OrderItems.orderId", orderId)
        .select(
          db.raw('"FoodTruck"."MenuItems"."name" as "itemName"'),
          "FoodTruck.OrderItems.quantity",
          "FoodTruck.OrderItems.price"
        )
        .orderBy("FoodTruck.OrderItems.orderItemId", "asc");

      return res.json({ ...order, items });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { attachFoodTruckRoutes };
