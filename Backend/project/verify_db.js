const db = require("./connectors/db");

(async () => {
  try {
    const r = await db.raw(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema = 'FoodTruck'
      order by table_name
    `);
    console.table(r.rows);
  } catch (e) {
    console.error("DB verify failed:", e);
  } finally {
    await db.destroy();
  }
})();
