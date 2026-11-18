import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Boxes, Edit3, Plus, Search, X } from './Icons';
import { api } from '../api';
import { formatCurrency, getStockBadgeClasses } from '../utils/format';
import { PRODUCT_CATEGORIES, type CatalogItem, type StockStatus } from '../../shared/types';

const FALLBACK_IMAGE = '/images/products/placeholder.svg';

interface InventoryViewProps {
  catalog: CatalogItem[];
  onRefresh: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

const STATUS_PRIORITY: Record<StockStatus, number> = {
  'Out of Stock': 0,
  'Low Stock': 1,
  'In Stock': 2,
};

export function InventoryView({ catalog, onRefresh, onNotify }: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<string>(PRODUCT_CATEGORIES[3]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{
    productId: number;
    field: 'price' | 'quantity';
    value: string;
  } | null>(null);

  // Sort low/out-of-stock SKUs to the top by default (P1.4)
  const filtered = catalog
    .filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.product_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || item.stock_status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      const prioDiff = STATUS_PRIORITY[a.stock_status] - STATUS_PRIORITY[b.stock_status];
      return prioDiff !== 0 ? prioDiff : a.product_id - b.product_id;
    });

  const inStockCount = catalog.filter((i) => i.stock_status === 'In Stock').length;
  const lowStockCount = catalog.filter((i) => i.stock_status === 'Low Stock').length;
  const outStockCount = catalog.filter((i) => i.stock_status === 'Out of Stock').length;

  function openAddModal() {
    setEditingItem(null);
    setNameInput('');
    setDescInput('');
    setCategoryInput(PRODUCT_CATEGORIES[3]);
    setImageUrlInput('');
    setPriceInput('');
    setQtyInput('15');
    setModalOpen(true);
  }

  function openEditModal(item: CatalogItem) {
    setEditingItem(item);
    setNameInput(item.product_name);
    setDescInput(item.description);
    setCategoryInput(item.category);
    setImageUrlInput(item.image_url || '');
    setPriceInput(String(item.price));
    setQtyInput(String(item.quantity));
    setModalOpen(true);
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onNotify('Image file must be 2 MB or smaller.', 'error');
      e.target.value = '';
      return;
    }
    setUploadingImage(true);
    try {
      const { image_url } = await api.uploadProductImage(file);
      setImageUrlInput(image_url);
      onNotify('Product image uploaded.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Image upload failed.', 'error');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handleAdjust(productId: number, delta: number) {
    try {
      await api.adjustStock(productId, delta);
      await onRefresh();
      onNotify(`Stock updated (${delta > 0 ? `+${delta}` : delta}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Stock adjustment failed.', 'error');
    }
  }

  async function commitInlineEdit(item: CatalogItem) {
    if (!inlineEdit || inlineEdit.productId !== item.product_id) return;
    const rawVal = Number(inlineEdit.value);
    const field = inlineEdit.field;
    setInlineEdit(null);

    if (!Number.isFinite(rawVal) || rawVal < 0 || (field === 'quantity' && !Number.isInteger(rawVal))) {
      onNotify(
        field === 'quantity'
          ? 'Stock quantity must be a non-negative integer.'
          : 'Price must be a non-negative number.',
        'error'
      );
      return;
    }

    const nextPrice = field === 'price' ? Number(rawVal.toFixed(2)) : item.price;
    const nextQty = field === 'quantity' ? rawVal : item.quantity;
    if (nextPrice === item.price && nextQty === item.quantity) return;

    try {
      await api.updateProduct(item.product_id, {
        product_name: item.product_name,
        description: item.description,
        price: nextPrice,
        quantity: nextQty,
        category: item.category,
        image_url: item.image_url,
      });
      await onRefresh();
      onNotify(`Updated ${field} for "${item.product_name}".`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Inline update failed.', 'error');
    }
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        product_name: nameInput,
        description: descInput,
        price: Number(priceInput),
        quantity: Number(qtyInput),
        category: categoryInput,
        image_url: imageUrlInput.trim() || null,
      };
      if (editingItem) {
        await api.updateProduct(editingItem.product_id, payload);
        onNotify(`Updated "${nameInput}".`);
      } else {
        await api.createProduct(payload);
        onNotify(`Added "${nameInput}" to catalog & inventory.`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save product.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Inventory &amp; Catalog Management</h2>
            <p className="text-xs text-slate-500">
              Low-stock alerts appear first. Click any price or quantity to edit inline.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add New Product
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total SKUs</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-slate-900">{catalog.length}</p>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 shadow-xs">
          <span className="text-xs font-medium text-brand-700">In Stock (&gt;10)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-800">{inStockCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
          <span className="text-xs font-medium text-amber-700">Low Stock (1–10)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-amber-800">{lowStockCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs">
          <span className="text-xs font-medium text-rose-700">Out of Stock (0)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-rose-800">{outStockCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter inventory items..."
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear inventory filter"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Filter inventory by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="ALL">All Categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {['ALL', 'In Stock', 'Low Stock', 'Out of Stock'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status === 'ALL' ? 'All SKUs' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map((item) => (
            <div key={item.product_id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <img
                    src={item.image_url || FALLBACK_IMAGE}
                    alt={item.product_name}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                    }}
                    className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-brand-50 object-cover"
                  />
                  <div>
                    <p className="font-bold text-slate-900">{item.product_name}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">{item.category}</p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-brand-700 tabular-nums">
                      {formatCurrency(item.price)} · Qty {item.quantity}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStockBadgeClasses(
                    item.stock_status
                  )}`}
                >
                  {item.stock_status}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={item.quantity <= 0}
                    onClick={() => void handleAdjust(item.product_id, -1)}
                    className="min-h-11 min-w-11 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAdjust(item.product_id, 1)}
                    className="min-h-11 min-w-11 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-700"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAdjust(item.product_id, 10)}
                    className="min-h-11 min-w-11 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 font-mono text-xs font-semibold text-brand-700"
                  >
                    +10
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table with Inline Price & Quantity Editing */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock Qty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Quick Adjust &amp; Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const editingPrice =
                  inlineEdit?.productId === item.product_id && inlineEdit.field === 'price';
                const editingQty =
                  inlineEdit?.productId === item.product_id && inlineEdit.field === 'quantity';

                return (
                  <tr key={item.product_id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url || FALLBACK_IMAGE}
                          alt={item.product_name}
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMAGE;
                          }}
                          className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-brand-50 object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{item.product_name}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                            {item.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {editingPrice ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus
                          aria-label={`Edit price for ${item.product_name}`}
                          value={inlineEdit.value}
                          onChange={(e) =>
                            setInlineEdit({ ...inlineEdit, value: e.target.value })
                          }
                          onBlur={() => void commitInlineEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitInlineEdit(item);
                            if (e.key === 'Escape') setInlineEdit(null);
                          }}
                          className="w-24 rounded-lg border border-brand-500 px-2 py-1 text-right font-mono text-xs outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          title="Click to edit price inline"
                          onClick={() =>
                            setInlineEdit({
                              productId: item.product_id,
                              field: 'price',
                              value: String(item.price),
                            })
                          }
                          className="rounded px-1.5 py-0.5 hover:bg-brand-50 hover:text-brand-700"
                        >
                          {formatCurrency(item.price)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {editingQty ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          aria-label={`Edit quantity for ${item.product_name}`}
                          value={inlineEdit.value}
                          onChange={(e) =>
                            setInlineEdit({ ...inlineEdit, value: e.target.value })
                          }
                          onBlur={() => void commitInlineEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitInlineEdit(item);
                            if (e.key === 'Escape') setInlineEdit(null);
                          }}
                          className="w-20 rounded-lg border border-brand-500 px-2 py-1 text-right font-mono text-xs outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          title="Click to edit quantity inline"
                          onClick={() =>
                            setInlineEdit({
                              productId: item.product_id,
                              field: 'quantity',
                              value: String(item.quantity),
                            })
                          }
                          className="rounded px-1.5 py-0.5 hover:bg-brand-50 hover:text-brand-700"
                        >
                          {item.quantity}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStockBadgeClasses(
                          item.stock_status
                        )}`}
                      >
                        {item.stock_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={item.quantity <= 0}
                          onClick={() => void handleAdjust(item.product_id, -1)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAdjust(item.product_id, 1)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAdjust(item.product_id, 10)}
                          className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? `Edit Product #${editingItem.product_id}` : 'Add New Product'}
              </h3>
              <button
                type="button"
                aria-label="Close product form"
                onClick={() => setModalOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Price (PHP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="product-category-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Category
                </label>
                <select
                  id="product-category-select"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <label
                  htmlFor="product-image-upload"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Product Image (PNG, JPEG, WebP, SVG · Max 2MB)
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={imageUrlInput.trim() || FALLBACK_IMAGE}
                    alt={nameInput || 'Product preview'}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                    }}
                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      id="product-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploadingImage}
                      onChange={(e) => void handleImageUpload(e)}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-700"
                    />
                    <input
                      type="text"
                      aria-label="Image URL"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="/images/products/product-1.svg or https://..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
