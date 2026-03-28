"use client";

interface Props {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function DashboardCard({ title, className = "", children }: Props) {
  return (
    <div
      className={`rounded-2xl bg-[#1a1a1a] border border-white/5 shadow-md p-5 flex flex-col gap-3 ${className}`}
    >
      <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}
