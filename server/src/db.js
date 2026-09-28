import pg from "pg";

/**
 * Prediction log backed by Postgres. Returns null when no database is
 * configured so the API still serves predictions without one.
 */
export const createLogStore = (env = process.env) => {
  const configured = env.DATABASE_URL || env.PG_HOST;
  if (!configured) return null;

  const pool = new pg.Pool(
    env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : {
          user: env.PG_USER,
          host: env.PG_HOST,
          database: env.PG_DATABASE,
          password: env.PG_PASSWORD,
          port: Number(env.PG_PORT) || 5432,
        },
  );
  // An idle client dropping must not take the API down with it.
  pool.on("error", (error) => console.error("Postgres pool error:", error));

  return {
    async add(input, result) {
      await pool.query(
        `INSERT INTO analyzer_log
           (bed, bath, acre_lot, house_size, city, state, zip_code,
            predicted_price, price_low, price_high, location_match, model_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          input.bed,
          input.bath,
          input.acre_lot ?? null,
          input.house_size,
          input.city ?? null,
          input.state ?? null,
          input.zip_code ?? null,
          result.estimate,
          result.low,
          result.high,
          result.location.matched,
          result.model_version,
        ],
      );
    },

    async list(limit = 100) {
      const { rows } = await pool.query(
        "SELECT * FROM analyzer_log ORDER BY created_at DESC LIMIT $1",
        [limit],
      );
      return rows;
    },

    close: () => pool.end(),
  };
};
