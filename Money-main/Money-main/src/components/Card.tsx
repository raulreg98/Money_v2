import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 ${className}`} style={style}>{children}</div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}

export function StatCard({ label, value, subValue, trend = 'neutral', icon }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <p className="text-white text-2xl font-bold tracking-tight">{value}</p>
      {subValue && <p className={`text-sm mt-1 ${trendColor}`}>{subValue}</p>}
    </Card>
  );
}
