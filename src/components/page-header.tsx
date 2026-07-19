import { CarFront } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="brand">
        <span className="brand-mark">
          <CarFront size={24} />
        </span>
        <div>
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h1>{title}</h1>
        </div>
      </div>
      {action}
    </header>
  );
}
