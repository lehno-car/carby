import type { Metadata } from "next";
import "swagger-ui-dist/swagger-ui.css";

export const metadata: Metadata = {
  title: "Carby API — Swagger",
};

export default function SwaggerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        overflow: "auto",
        background: "#ffffff",
      }}
    >
      {children}
    </div>
  );
}
