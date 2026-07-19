declare module "swagger-ui-dist" {
  type SwaggerOptions = {
    dom_id: string;
    url: string;
    deepLinking?: boolean;
    displayRequestDuration?: boolean;
    tryItOutEnabled?: boolean;
    presets?: unknown[];
    layout?: string;
  };

  type SwaggerUI = ((options: SwaggerOptions) => unknown) & {
    presets: { apis: unknown };
  };

  export const SwaggerUIBundle: SwaggerUI;
}
