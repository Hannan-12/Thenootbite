'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { formatPKR } from '@/lib/format';

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cup'];

type MenuItem = {
  id: string; sku: string; name: string; category: string;
  price: number; description: string | null; image_url: string | null;
  available: boolean; deal_price: number | null; deal_label: string | null;
};

interface Ingredient { id: string; name: string; unit: string; }
interface RecipeLine { id: string; quantity: number; ingredient_id: string; ingredients: Ingredient; }

const inputClass = 'w-full bg-[#1a1a1a] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#E4002B]/50 transition-colors rounded-sm';
const labelClass = 'font-heading text-xs tracking-widest text-white/40 block mb-2';

export function MenuItemEditor({ item }: { item: MenuItem }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName]             = useState(item.name);
  const [price, setPrice]           = useState(String(item.price));
  const [description, setDesc]      = useState(item.description ?? '');
  const [imageUrl, setImageUrl]     = useState(item.image_url ?? '');
  const [isDeal, setIsDeal]         = useState(!!item.deal_price);
  const [dealPrice, setDealPrice]   = useState(String(item.deal_price ?? ''));
  const [dealLabel, setDealLabel]   = useState(item.deal_label ?? '');
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<string | null>(null);
  const [toastType, setToastType]   = useState<'success' | 'error'>('success');

  // Recipe state
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [recipe, setRecipe]                 = useState<RecipeLine[]>([]);
  const [recipeLoaded, setRecipeLoaded]     = useState(false);
  const [showRecipe, setShowRecipe]         = useState(false);
  const [addIngId, setAddIngId]             = useState('');
  const [addQty, setAddQty]                 = useState('');
  const [addIngLoading, setAddIngLoading]   = useState(false);
  // New ingredient inline
  const [showNewIng, setShowNewIng]         = useState(false);
  const [newIngName, setNewIngName]         = useState('');
  const [newIngUnit, setNewIngUnit]         = useState('g');
  const [newIngLoading, setNewIngLoading]   = useState(false);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${item.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, file, { upsert: true });

    if (error) {
      showToast('Image upload failed: ' + error.message, 'error');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
    showToast('Image uploaded');
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        price: parseInt(price) || item.price,
        description: description.trim() || null,
        image_url: imageUrl || null,
        deal_price: isDeal && dealPrice ? parseInt(dealPrice) : null,
        deal_label: isDeal && dealLabel.trim() ? dealLabel.trim() : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('Saved successfully');
      router.refresh();
    } else {
      showToast('Save failed', 'error');
    }
  }

  async function loadRecipe() {
    if (recipeLoaded) return;
    const [ingRes, recipeRes] = await Promise.all([
      fetch('/api/admin/ingredients'),
      fetch(`/api/admin/recipes?menu_item_id=${item.id}`),
    ]);
    if (ingRes.ok) setAllIngredients(await ingRes.json());
    if (recipeRes.ok) setRecipe(await recipeRes.json());
    setRecipeLoaded(true);
  }

  async function toggleRecipe() {
    if (!recipeLoaded) await loadRecipe();
    setShowRecipe(v => !v);
  }

  async function addToRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!addIngId || !addQty) return;
    setAddIngLoading(true);
    const res = await fetch('/api/admin/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_item_id: item.id, ingredient_id: addIngId, quantity: parseFloat(addQty) }),
    });
    const data = await res.json();
    setAddIngLoading(false);
    if (!res.ok) { showToast(data.detail ?? 'Failed', 'error'); return; }
    setRecipe(prev => {
      const exists = prev.find(r => r.ingredient_id === addIngId);
      return exists ? prev.map(r => r.ingredient_id === addIngId ? data : r) : [...prev, data];
    });
    setAddIngId(''); setAddQty('');
  }

  async function removeFromRecipe(recipeId: string) {
    const res = await fetch(`/api/admin/recipes/${recipeId}`, { method: 'DELETE' });
    if (res.ok) setRecipe(prev => prev.filter(r => r.id !== recipeId));
  }

  async function updateQty(recipeId: string, quantity: number) {
    await fetch(`/api/admin/recipes/${recipeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    setRecipe(prev => prev.map(r => r.id === recipeId ? { ...r, quantity } : r));
  }

  async function createIngredient(e: React.FormEvent) {
    e.preventDefault();
    if (!newIngName.trim()) return;
    setNewIngLoading(true);
    const res = await fetch('/api/admin/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newIngName.trim(), unit: newIngUnit }),
    });
    const data = await res.json();
    setNewIngLoading(false);
    if (!res.ok) { showToast(data.detail ?? 'Failed', 'error'); return; }
    setAllIngredients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setAddIngId(data.id);
    setNewIngName(''); setNewIngUnit('g');
    setShowNewIng(false);
    showToast(`"${data.name}" created`);
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 font-heading text-xs tracking-widest px-4 py-2 rounded-sm shadow-lg ${
          toastType === 'success' ? 'bg-[#E4002B] text-white' : 'bg-yellow-500 text-black'
        }`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/menu')}
          className="font-heading text-xs tracking-widest text-white/30 hover:text-white transition-colors mb-4 block"
        >
          ← MENU
        </button>
        <p className="font-heading text-xs tracking-[0.4em] text-[#E4002B] mb-1">{item.category.toUpperCase()}</p>
        <h1 className="font-heading text-3xl text-white">{item.name}</h1>
        <p className="text-white/20 text-xs mt-1 font-heading tracking-wider">SKU: {item.sku}</p>
      </div>

      {/* Image */}
      <div className="mb-6">
        <p className={labelClass}>ITEM IMAGE</p>
        <div className="relative aspect-video bg-[#1a1a1a] border border-white/10 rounded-sm overflow-hidden mb-3">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 font-heading text-xs tracking-wider">
              NO IMAGE
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="font-heading text-xs tracking-widest px-4 py-2.5 border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors rounded-sm disabled:opacity-40"
        >
          {uploading ? 'UPLOADING…' : 'UPLOAD IMAGE'}
        </button>
        {imageUrl && (
          <button
            onClick={() => setImageUrl('')}
            className="ml-3 font-heading text-xs tracking-widest text-white/20 hover:text-red-400 transition-colors"
          >
            REMOVE
          </button>
        )}
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className={labelClass}>ITEM NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
      </div>

      {/* Price */}
      <div className="mb-4">
        <label className={labelClass}>PRICE (PKR)</label>
        <input
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className={inputClass}
          min={0}
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className={labelClass}>DESCRIPTION</label>
        <textarea
          value={description}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          placeholder="Optional description…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Deal toggle */}
      <div className="mb-6 border border-white/5 rounded-sm bg-[#111111] px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="font-heading text-sm text-white tracking-wider">MARK AS DEAL</p>
            <p className="text-white/30 text-xs mt-0.5">Show this item with a special deal price on the homepage.</p>
          </div>
          <button
            onClick={() => setIsDeal(!isDeal)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isDeal ? 'bg-[#E4002B]' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${isDeal ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {isDeal && (
          <div className="mt-4 space-y-3 pt-4 border-t border-white/5">
            <div>
              <label className={labelClass}>DEAL PRICE (PKR)</label>
              <input
                type="number"
                value={dealPrice}
                onChange={e => setDealPrice(e.target.value)}
                placeholder={`Less than ${formatPKR(parseInt(price) || item.price)}`}
                className={inputClass}
                min={0}
              />
            </div>
            <div>
              <label className={labelClass}>DEAL LABEL</label>
              <input
                value={dealLabel}
                onChange={e => setDealLabel(e.target.value)}
                placeholder="e.g. 30% OFF, DEAL OF THE DAY"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#E4002B] text-white font-heading text-sm py-4 tracking-widest hover:bg-white hover:text-[#0d0d0d] transition-colors duration-200 disabled:opacity-50 rounded-sm"
      >
        {saving ? 'SAVING…' : 'SAVE CHANGES →'}
      </button>

      {/* ── Recipe Section ── */}
      <div className="mt-6 border border-white/5 rounded-sm overflow-hidden">
        <button
          onClick={toggleRecipe}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="font-heading text-sm text-white tracking-wider">RECIPE</span>
            {recipe.length > 0 && (
              <span className="font-heading text-[10px] tracking-widest px-2 py-0.5 border border-white/10 text-white/30 rounded-sm">
                {recipe.length} INGREDIENT{recipe.length !== 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <span className="font-heading text-xs text-white/30">{showRecipe ? '▲' : '▼'}</span>
        </button>

        {showRecipe && (
          <div className="border-t border-white/5">
            {/* Existing recipe lines */}
            {recipe.length > 0 && (
              <div className="divide-y divide-white/5">
                {recipe.map(line => (
                  <div key={line.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-heading text-xs text-white">{line.ingredients.name}</p>
                      <p className="font-heading text-[10px] text-white/30 mt-0.5 uppercase">{line.ingredients.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={line.quantity}
                        onBlur={e => {
                          const val = parseFloat(e.target.value);
                          if (val > 0 && val !== line.quantity) updateQty(line.id, val);
                        }}
                        className="w-20 bg-[#1a1a1a] border border-white/10 px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                      />
                      <button
                        onClick={() => removeFromRecipe(line.id)}
                        className="font-heading text-[10px] text-white/20 hover:text-red-400 px-2 py-1 border border-transparent hover:border-red-500/20 rounded-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add ingredient form */}
            <div className="px-5 py-4 bg-[#0d0d0d] border-t border-white/5">
              <p className="font-heading text-[10px] tracking-widest text-white/30 mb-3">ADD INGREDIENT</p>
              <form onSubmit={addToRecipe} className="flex gap-2">
                <select
                  value={addIngId}
                  onChange={e => setAddIngId(e.target.value)}
                  required
                  className="flex-1 bg-[#1a1a1a] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body cursor-pointer"
                >
                  <option value="">Select ingredient…</option>
                  {allIngredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  placeholder="Qty"
                  required
                  className="w-20 bg-[#1a1a1a] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                />
                <button
                  type="submit"
                  disabled={addIngLoading}
                  className="font-heading text-[10px] tracking-widest px-4 py-2 bg-[#E4002B] text-white hover:bg-red-700 disabled:opacity-50 rounded-sm transition-colors flex-shrink-0"
                >
                  {addIngLoading ? '…' : 'ADD'}
                </button>
              </form>

              {/* Create new ingredient inline */}
              <button
                onClick={() => setShowNewIng(v => !v)}
                className="mt-2 font-heading text-[10px] tracking-widest text-white/20 hover:text-white transition-colors"
              >
                {showNewIng ? '− cancel' : '+ new ingredient'}
              </button>

              {showNewIng && (
                <form onSubmit={createIngredient} className="mt-2 flex gap-2">
                  <input
                    value={newIngName}
                    onChange={e => setNewIngName(e.target.value)}
                    placeholder="Ingredient name"
                    required
                    className="flex-1 bg-[#1a1a1a] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body"
                  />
                  <select
                    value={newIngUnit}
                    onChange={e => setNewIngUnit(e.target.value)}
                    className="w-20 bg-[#1a1a1a] border border-white/10 px-2 py-2 text-xs text-white focus:outline-none focus:border-[#E4002B]/40 rounded-sm font-body cursor-pointer"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    type="submit"
                    disabled={newIngLoading}
                    className="font-heading text-[10px] tracking-widest px-4 py-2 border border-white/10 text-white/40 hover:text-white hover:border-white/30 disabled:opacity-50 rounded-sm transition-colors flex-shrink-0"
                  >
                    {newIngLoading ? '…' : 'CREATE'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
