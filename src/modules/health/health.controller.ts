import { FastifyReply, FastifyRequest } from "fastify";
import { checkDatabaseConnection } from "../../db/client.js";

export async function getHealthHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getReadyHandler(_request: FastifyRequest, reply: FastifyReply) {
  const isDbConnected = await checkDatabaseConnection();

  if (!isDbConnected) {
    return reply.status(503).send({
      data: {
        status: "not_ready",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
    });
  }

  return reply.status(200).send({
    data: {
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    },
  });
}
