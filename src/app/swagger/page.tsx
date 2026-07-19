"use client";

import { useEffect } from "react";

export default function SwaggerPage() {
  useEffect(() => {
    let active = true;

    void import("swagger-ui-dist").then(({ SwaggerUIBundle }) => {
      if (!active) return;
      SwaggerUIBundle({
        dom_id: "#swagger-ui",
        url: "/api/openapi",
        deepLinking: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
      });
    });

    return () => {
      active = false;
      document.querySelector("#swagger-ui")?.replaceChildren();
    };
  }, []);

  return <div id="swagger-ui" />;
}
