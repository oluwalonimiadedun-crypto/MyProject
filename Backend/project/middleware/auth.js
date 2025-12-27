// project/middleware/auth.js
const db = require("../connectors/db");

async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.session_token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await db("FoodTruck.Sessions as s")
      .join("FoodTruck.Users as u", "u.userId", "s.userId")
      .select("u.userId", "u.role")
      .where("s.token", token)
      .first();

    if (!session) return res.status(401).json({ error: "Not authenticated" });

    req.userId = session.userId;
    req.userRole = session.role;
    next();
  } catch (e) {
    console.error("authMiddleware error:", e);
    res.status(500).json({ error: "Server error" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.userRole) return res.status(401).json({ error: "Not authenticated" });
    if (req.userRole !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

module.exports = { authMiddleware, requireRole };
