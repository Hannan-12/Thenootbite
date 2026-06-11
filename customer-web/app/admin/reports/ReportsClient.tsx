'use client';

import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

type DayRow   = { date: string; label: string; revenue: number; orders: number };
type MonthRow = { month: string; label: string; revenue: number; orders: number };
type TopItem  = { name: string; qty: number; revenue: number };
type Stats    = {
  totalRevenueToday: number; totalOrdersToday: number;
  totalRevenue30: number;    totalOrders30: number;
  thisMonth?: MonthRow;      lastMonth?: MonthRow;
};

function formatPKR(n: number) { return 'Rs. ' + n.toLocaleString('en-PK'); }

function pct(a: number, b: number) {
  if (!b) return null;
  const diff = ((a - b) / b) * 100;
  return { val: Math.abs(diff).toFixed(1), up: diff >= 0 };
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 2,
  fontFamily: 'var(--font-heading, sans-serif)',
  fontSize: 11,
  color: '#fff',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1">
      <p className="text-white/40 text-[10px] tracking-widest mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-xs font-heading tracking-wider">
          {p.dataKey === 'revenue' ? formatPKR(p.value) : `${p.value} orders`}
        </p>
      ))}
    </div>
  );
}

function downloadCSV(rows: Array<{ label: string; revenue: number; orders: number }>, filename: string) {
  const header = 'Period,Orders,Revenue (PKR),Avg Order (PKR)';
  const lines = rows.map(r => {
    const avg = r.orders ? Math.round(r.revenue / r.orders) : 0;
    return `"${r.label}",${r.orders},${r.revenue},${avg}`;
  });
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadItemsCSV(items: TopItem[]) {
  const header = 'Item,Qty Sold,Revenue (PKR)';
  const lines  = items.map(i => `"${i.name}",${i.qty},${i.revenue}`);
  const csv    = [header, ...lines].join('\n');
  const blob   = new Blob([csv], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = 'top-items.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({ dailyRows, monthlyRows, topItems, stats }: {
  dailyRows: DayRow[];
  monthlyRows: MonthRow[];
  topItems: TopItem[];
  stats: Stats;
}) {
  const [tab, setTab]       = useState<'daily' | 'monthly'>('daily');
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');

  const revChange = pct(stats.thisMonth?.revenue ?? 0, stats.lastMonth?.revenue ?? 0);
  const ordChange = pct(stats.thisMonth?.orders  ?? 0, stats.lastMonth?.orders  ?? 0);

  const rows: Array<{ label: string; revenue: number; orders: number }> =
    tab === 'daily' ? dailyRows : monthlyRows;

  const best = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
  const avg  = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.revenue, 0) / (rows.filter(r => r.orders > 0).length || 1))
    : 0;

  const maxQty = topItems[0]?.qty ?? 1;

  return (
    <div className="px-4 sm:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">ANALYTICS</p>
          <h1 className="font-heading text-3xl text-white">SALES REPORTS</h1>
          <p className="text-white/30 text-xs mt-1">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => downloadCSV(tab === 'daily' ? dailyRows : monthlyRows, `${tab}-report.csv`)}
          className="font-heading text-xs tracking-widest px-4 py-2 border border-white/10 text-white/40 hover:text-white hover:border-white/30 rounded-sm transition-colors"
        >
          ↓ EXPORT CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">TODAY REVENUE</p>
          <p className="font-heading text-2xl text-white">{formatPKR(stats.totalRevenueToday)}</p>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">TODAY ORDERS</p>
          <p className="font-heading text-2xl text-white">{stats.totalOrdersToday}</p>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">30-DAY REVENUE</p>
          <p className="font-heading text-2xl text-white">{formatPKR(stats.totalRevenue30)}</p>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">30-DAY ORDERS</p>
          <p className="font-heading text-2xl text-white">{stats.totalOrders30}</p>
        </div>
      </div>

      {/* Month vs last month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#E4002B]/20 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-1">THIS MONTH REVENUE</p>
          <p className="font-heading text-3xl text-white mb-1">{formatPKR(stats.thisMonth?.revenue ?? 0)}</p>
          {revChange && (
            <p className={`font-heading text-xs tracking-wider ${revChange.up ? 'text-green-400' : 'text-red-400'}`}>
              {revChange.up ? '▲' : '▼'} {revChange.val}% vs last month
            </p>
          )}
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-1">THIS MONTH ORDERS</p>
          <p className="font-heading text-3xl text-white mb-1">{stats.thisMonth?.orders ?? 0}</p>
          {ordChange && (
            <p className={`font-heading text-xs tracking-wider ${ordChange.up ? 'text-green-400' : 'text-red-400'}`}>
              {ordChange.up ? '▲' : '▼'} {ordChange.val}% vs last month
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111] border border-white/5 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {(['daily', 'monthly'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`font-heading text-xs tracking-widest px-3 py-1.5 rounded-sm border transition-colors duration-150 ${
                  tab === t ? 'bg-[#E4002B] border-[#E4002B] text-white' : 'border-white/10 text-white/30 hover:text-white'
                }`}>
                {t === 'daily' ? 'LAST 30 DAYS' : 'LAST 12 MONTHS'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['revenue', 'orders'] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className={`font-heading text-xs tracking-widest px-3 py-1.5 rounded-sm border transition-colors duration-150 ${
                  metric === m ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/20 hover:text-white'
                }`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <ResponsiveContainer width="100%" height={300}>
            {metric === 'revenue' ? (
              <AreaChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#E4002B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E4002B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-heading)' }} tickLine={false} axisLine={false} interval={tab === 'daily' ? 4 : 0}/>
                <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-heading)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip />}/>
                <Area type="monotone" dataKey="revenue" stroke="#E4002B" strokeWidth={2} fill="url(#revGrad)"/>
              </AreaChart>
            ) : (
              <BarChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-heading)' }} tickLine={false} axisLine={false} interval={tab === 'daily' ? 4 : 0}/>
                <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-heading)' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<CustomTooltip />}/>
                <Bar dataKey="orders" fill="#E4002B" radius={[2, 2, 0, 0]} maxBarSize={24}/>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">
            BEST {tab === 'daily' ? 'DAY' : 'MONTH'}
          </p>
          <p className="font-heading text-lg text-white">{best?.label ?? '—'}</p>
          <p className="font-heading text-xs text-[#E4002B] mt-1">{best ? formatPKR(best.revenue) : ''}</p>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">AVG DAILY REVENUE</p>
          <p className="font-heading text-lg text-white">{formatPKR(avg)}</p>
          <p className="font-heading text-xs text-white/20 mt-1">on active days only</p>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-sm px-5 py-5">
          <p className="font-heading text-[10px] tracking-widest text-white/30 mb-2">LAST MONTH REVENUE</p>
          <p className="font-heading text-lg text-white">{formatPKR(stats.lastMonth?.revenue ?? 0)}</p>
          <p className="font-heading text-xs text-white/20 mt-1">{stats.lastMonth?.orders ?? 0} orders</p>
        </div>
      </div>

      {/* Top 10 items */}
      <div className="bg-[#111] border border-white/5 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-heading text-xs tracking-widest text-white/60">TOP 10 ITEMS — LAST 30 DAYS</h2>
          <button
            onClick={() => downloadItemsCSV(topItems)}
            className="font-heading text-[10px] tracking-widest text-white/20 hover:text-white transition-colors"
          >
            ↓ CSV
          </button>
        </div>
        {topItems.length === 0 ? (
          <div className="px-5 py-12 text-center text-white/20 font-heading text-xs tracking-wider">
            NO ORDERS IN LAST 30 DAYS
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-4 px-5 py-3">
                <span className="font-heading text-xs text-white/20 w-5 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm text-white truncate">{item.name}</p>
                  <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E4002B] rounded-full"
                      style={{ width: `${Math.round((item.qty / maxQty) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-heading text-sm text-white">{item.qty} sold</p>
                  <p className="font-heading text-xs text-white/30">{formatPKR(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-[#111] border border-white/5 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-heading text-xs tracking-widest text-white/60">MONTHLY BREAKDOWN</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-heading">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 tracking-widest text-white/30">MONTH</th>
                <th className="text-right px-5 py-3 tracking-widest text-white/30">ORDERS</th>
                <th className="text-right px-5 py-3 tracking-widest text-white/30">REVENUE</th>
                <th className="text-right px-5 py-3 tracking-widest text-white/30">AVG ORDER</th>
                <th className="text-right px-5 py-3 tracking-widest text-white/30">VS PREV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...monthlyRows].reverse().map((row, i, arr) => {
                const prev = arr[i + 1];
                const change = prev ? pct(row.revenue, prev.revenue) : null;
                const avgOrder = row.orders ? Math.round(row.revenue / row.orders) : 0;
                return (
                  <tr key={row.month} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white tracking-wider">{row.label}</td>
                    <td className="px-5 py-3 text-right text-white/60">{row.orders}</td>
                    <td className="px-5 py-3 text-right text-white">{formatPKR(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-white/40">{avgOrder ? formatPKR(avgOrder) : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {change ? (
                        <span className={change.up ? 'text-green-400' : 'text-red-400'}>
                          {change.up ? '▲' : '▼'} {change.val}%
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
