import { createServiceClient } from '@/lib/supabase/service';
import { buildMenuCards } from '@/lib/menu';
import type { MenuItem } from '@/lib/types';
import { POSTerminal } from './POSTerminal';

export const dynamic = 'force-dynamic';

export default async function POSPage() {
  const db = createServiceClient();

  const { data, error } = await db
    .from('menu_items')
    .select('*')
    .eq('available', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0d0d] text-red-400 font-heading text-sm">
        Failed to load menu: {error.message}
      </div>
    );
  }

  const items = (data ?? []) as MenuItem[];
  const cards = buildMenuCards(items);

  return <POSTerminal cards={cards} />;
}
