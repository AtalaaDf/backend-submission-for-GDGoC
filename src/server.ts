import app from "./app.js";
import { env } from "./config/env.js";

async function start() {
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });
    app.log.info(`Server running at http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.VERCEL !== "1") {
  start();
}

export default app;
