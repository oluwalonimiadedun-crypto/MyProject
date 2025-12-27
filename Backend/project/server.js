require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { attachPublicRoutes } = require("./routes/public");
const { attachPrivateRoutes } = require("./routes/private");
const { attachFoodTruckRoutes } = require("./routes/foodtruck"); // if you have it
const { authMiddleware } = require("./middleware/auth");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// public
attachPublicRoutes(app);

// everything below needs login
app.use(authMiddleware);

attachPrivateRoutes(app);

// if your foodtruck routes should be protected:
if (typeof attachFoodTruckRoutes === "function") {
  attachFoodTruckRoutes(app);
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
