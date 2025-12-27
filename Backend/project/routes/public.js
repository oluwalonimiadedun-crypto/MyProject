// project/routes/public.js
const db = require("../connectors/db");
const crypto = require("crypto");

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function attachPublicRoutes(app) {
  // Health check
  app.get("/", (req, res) => {
    res.json({ message: "Backend running successfully" });
  });

  // Register user (create account)
  app.post("/api/v1/user", async (req, res) => {
    try {
      const { name, email, password, birthDate, role } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email, password are required" });
      }

      const exists = await db("FoodTruck.Users").where({ email }).first();
      if (exists) return res.status(409).json({ error: "Email already exists" });

      const insertData = {
        name,
        email,
        password, // (simple for milestone)
        role: role || "customer",
        birthDate: birthDate || null,
      };

      const rows = await db("FoodTruck.Users")
        .insert(insertData)
        .returning(["userId", "name", "email", "role", "birthDate", "createdAt"]);

      res.status(201).json(rows[0]);
    } catch (e) {
      console.error("POST /api/v1/user error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ✅ LOGIN (this is what you are missing)
  app.post("/api/v1/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
      }

      const user = await db("FoodTruck.Users").where({ email }).first();
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = makeToken();

      await db("FoodTruck.Sessions").insert({
        userId: user.userId,
        token,
      });

      res.cookie("session_token", token, {
        httpOnly: true,
        sameSite: "lax",
      });

      res.json({ message: "Login success" });
    } catch (e) {
      console.error("POST /api/v1/auth/login error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Logout
  app.post("/api/v1/auth/logout", async (req, res) => {
    try {
      const token = req.cookies?.session_token;
      if (token) await db("FoodTruck.Sessions").where({ token }).del();
      res.clearCookie("session_token");
      res.json({ message: "Logged out" });
    } catch (e) {
      console.error("POST /api/v1/auth/logout error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

module.exports = { attachPublicRoutes };
