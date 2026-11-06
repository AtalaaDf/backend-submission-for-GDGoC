import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export function registerSwagger(app: FastifyInstance): void {
  app.register(swagger, {
    openapi: {
      info: {
        title: "GDGoC UNSRI API",
        description: "REST API GDGoC UNSRI Core Team & Member Management",
        version: "1.0.0",
      },
      servers: [
        {
          url: "/api/v1",
          description: "API v1 base path",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT Bearer token",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
