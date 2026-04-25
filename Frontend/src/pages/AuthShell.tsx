import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const AuthShell = ({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12 sm:px-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_15px_45px_rgba(12,42,83,0.09)]">
        <div className="mb-6">
          <div className="mb-2 flex justify-center">
            <img
              alt="EngiCost logo"
              className="h-24 w-auto object-contain"
              src="/EngLogo.png"
            />
          </div>
          <h2 className="text-center text-2xl font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {children}

        {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
      </section>
    </div>
  );
};
