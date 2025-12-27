require("dotenv").config();
const knex = require("knex");

const db = knex({
  client: "pg",
  connection: {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "postgres",
  },
});

module.exports = db;
