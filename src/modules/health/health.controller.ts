import { FastifyReply, FastifyRequest } from "fastify";

export async function getHealthHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getReadyHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send({
    data: {
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    },
  });
}

