import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

const start = async () => {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors);
  await app.register(helmet);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  try {
    await app.listen({
      port: 3001,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
