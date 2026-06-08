import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminShell } from '@/components/admin/AdminShell';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireAdmin();
  const db = createServiceClient();

  // Last 30 days daily data
  const from30 = new Date();
  from30.setDate(from30.getDate() - 29);
  from30.setHours(0, 0, 0, 0);

  // Last 12 months data
  const from12 = new Date();
  from12.setMonth(from12.getMonth() - 11);
  from12.setDate(1);
  from12.setHours(0, 0, 0, 0);

  const [{ data: dailyRaw }, { data: monthlyRaw }] = await Promise.all([
    db.from('orders').select('total, created_at').gte('created_at', from30.toISOString()),
    db.from('orders').select('total, created_at').gte('created_at', from12.toISOString()),
  ]);

  // Build daily rows
  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(from30);
    d.setDate(from30.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { revenue: 0, orders: 0 };
  }
  for (const o of dailyRaw ?? []) {
    const key = o.created_at.slice(0, 10);
    if (dailyMap[key]) { dailyMap[key].revenue += o.total ?? 0; dailyMap[key].orders += 1; }
  }
  const dailyRows = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
    revenue: v.revenue,
    orders: v.orders,
  }));

  // Build monthly rows
  const monthlyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(from12);
    d.setMonth(from12.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = { revenue: 0, orders: 0 };
  }
  for (const o of monthlyRaw ?? []) {
    const key = o.created_at.slice(0, 7);
    if (monthlyMap[key]) { monthlyMap[key].revenue += o.total ?? 0; monthlyMap[key].orders += 1; }
  }
  const monthlyRows = Object.entries(monthlyMap).map(([month, v]) => ({
    month,
    label: new Date(month + '-01').toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }),
    revenue: v.revenue,
    orders: v.orders,
  }));

  // Summary stats
  const totalRevenueToday = dailyRows.at(-1)?.revenue ?? 0;
  const totalOrdersToday  = dailyRows.at(-1)?.orders ?? 0;
  const totalRevenue30    = dailyRows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders30     = dailyRows.reduce((s, r) => s + r.orders, 0);
  const thisMonth         = monthlyRows.at(-1);
  const lastMonth         = monthlyRows.at(-2);

  return (
    <AdminShell>
      <ReportsClient
        dailyRows={dailyRows}
        monthlyRows={monthlyRows}
        stats={{ totalRevenueToday, totalOrdersToday, totalRevenue30, totalOrders30, thisMonth, lastMonth }}
      />
    </AdminShell>
  );
}
