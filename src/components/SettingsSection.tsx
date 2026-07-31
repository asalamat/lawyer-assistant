import type { ReactNode } from "react";
import type { SVGProps } from "react";

export default function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-accent" />
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      {description && <p className="-mt-2 text-sm text-muted">{description}</p>}
      {children}
    </section>
  );
}
