import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://park_plaza:Dariva2026Develop@127.0.0.1:5432/park_plaza',
});

async function main() {
  try {
    const res = await pool.query(
      'select "id", "property_id", "reservation_id", "reference", "status", "created_at", "updated_at" from "contracts" where "contracts"."property_id" = $1 order by "contracts"."created_at" desc limit $2',
      ['709c9100-9382-4a14-a22e-7c00aa54b185', 50]
    );
    console.log('Postgres Query Success! Rows count:', res.rows.length);
  } catch (err) {
    console.error('Postgres error:', err);
  } finally {
    await pool.end();
  }
}

main();
