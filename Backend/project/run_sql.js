const fs = require("fs");
const path = require("path");
const db = require("./connectors/db");

function splitSql(sqlText) {
  // remove line comments "-- ..."
  const noComments = sqlText
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/g, ""))
    .join("\n");

  // split by semicolon
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    // ignore BEGIN/COMMIT if they exist in the file
    .filter((s) => !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(s));
}

(async () => {
  try {
    const sqlPath = path.join(__dirname, "connectors", "scripts.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const statements = splitSql(sql);
    console.log(`Found ${statements.length} SQL statements...`);

    await db.transaction(async (trx) => {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await trx.raw(stmt);
        } catch (err) {
          console.error(`\n❌ Statement ${i + 1} failed:\n${stmt}\n`);
          throw err;
        }
      }
    });

    console.log("✅ scripts.sql executed successfully");
  } catch (e) {
    console.error("❌ Failed (full error):", e);
  } finally {
    await db.destroy();
  }
})();
