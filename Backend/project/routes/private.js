// project/routes/private.js
const db = require("../connectors/db");

function attachPrivateRoutes(app) {
  app.get("/api/v1/private/me", async (req, res) => {
    try {
      if (!req.userId) return res.status(401).json({ error: "Not authenticated" });

      const user = await db("FoodTruck.Users")
        .select("userId", "name", "email", "role", "birthDate", "createdAt")
        .where({ userId: req.userId })
        .first();

      if (!user) return res.status(404).json({ error: "User not found" });

      res.json(user);
    } catch (e) {
      console.error("GET /api/v1/private/me error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

module.exports = { attachPrivateRoutes };
