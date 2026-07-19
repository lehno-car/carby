export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Carby Diagnostics API",
    version: "1.0.0",
    description:
      "Безопасная диагностика подключения Carby к PostgreSQL. Ответы не содержат DATABASE_URL или паролей.",
  },
  servers: [{ url: "/", description: "Текущий Railway-домен" }],
  tags: [
    { name: "Database", description: "Проверка PostgreSQL и обязательных таблиц" },
    { name: "Telegram", description: "Проверка бота и webhook без раскрытия токена" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Database"],
        summary: "Быстрая проверка соединения",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "PostgreSQL отвечает на SELECT 1",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/HealthResult" } },
            },
          },
          "503": {
            description: "PostgreSQL недоступен",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DiagnosticError" } },
            },
          },
        },
      },
    },
    "/api/diagnostics/database": {
      get: {
        tags: ["Database"],
        summary: "Проверить соединение, таблицы и чтение rate_limit_entries",
        operationId: "getDatabaseDiagnostic",
        responses: {
          "200": {
            description: "Соединение и схема исправны",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DatabaseReadResult" } },
            },
          },
          "503": {
            description: "Ошибка соединения, схемы или чтения",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DiagnosticError" } },
            },
          },
        },
      },
      post: {
        tags: ["Database"],
        summary: "Проверить INSERT и ON CONFLICT UPDATE в rate_limit_entries",
        description: "Создаёт временную диагностическую строку и удаляет её после проверки.",
        operationId: "runDatabaseWriteDiagnostic",
        responses: {
          "200": {
            description: "Запись и обновление работают",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DatabaseWriteResult" } },
            },
          },
          "503": {
            description: "Ошибка записи с безопасным сообщением PostgreSQL",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DiagnosticError" } },
            },
          },
        },
      },
    },
    "/api/diagnostics/telegram": {
      get: {
        tags: ["Telegram"],
        summary: "Проверить bot token, username и webhook",
        operationId: "getTelegramDiagnostic",
        responses: {
          "200": {
            description: "Бот доступен, username и webhook совпадают с настройками",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TelegramResult" } },
            },
          },
          "503": {
            description: "Telegram настроен некорректно или недоступен",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DiagnosticError" } },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResult: {
        type: "object",
        properties: {
          status: { type: "string", examples: ["ok"] },
          database: { type: "string", examples: ["ok"] },
          latencyMs: { type: "integer", examples: [25] },
        },
      },
      DatabaseReadResult: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "degraded"] },
          connection: { type: "string", enum: ["ok"] },
          serverTime: { type: ["string", "null"], format: "date-time" },
          tables: { type: "object", additionalProperties: { type: "boolean" } },
          missingTables: { type: "array", items: { type: "string" } },
          rateLimitRows: { type: "integer" },
          latencyMs: { type: "integer" },
        },
      },
      DatabaseWriteResult: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok"] },
          connection: { type: "string", enum: ["ok"] },
          insert: { type: "string", enum: ["ok"] },
          conflictUpdate: { type: "string", enum: ["ok"] },
          cleanup: { type: "string", enum: ["scheduled"] },
          latencyMs: { type: "integer" },
        },
      },
      TelegramResult: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "error"] },
          bot: {
            type: "object",
            properties: {
              id: { type: "integer" },
              username: { type: "string" },
              configuredUsername: { type: "string" },
              usernameMatches: { type: "boolean" },
            },
          },
          webhook: {
            type: "object",
            properties: {
              url: { type: "string", format: "uri" },
              expectedUrl: { type: "string", format: "uri" },
              matches: { type: "boolean" },
              pendingUpdates: { type: "integer" },
              allowedUpdates: { type: "array", items: { type: "string" } },
              lastErrorAt: { type: ["string", "null"], format: "date-time" },
              lastError: { type: ["string", "null"] },
            },
          },
        },
      },
      DiagnosticError: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["error"] },
          connection: { type: "string", enum: ["ok", "error"] },
          stage: {
            type: "string",
            enum: [
              "connection",
              "schema",
              "rate_limit_read",
              "rate_limit_insert",
              "rate_limit_update",
            ],
          },
          error: { type: "string" },
          postgresCode: { type: "string" },
          requestId: { type: "string", format: "uuid" },
          latencyMs: { type: "integer" },
        },
      },
    },
  },
} as const;
