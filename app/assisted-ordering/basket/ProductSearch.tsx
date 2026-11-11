'use client';

import { useId, useState } from 'react';
import { Search, X } from 'lucide-react';
import s from './basket.module.css';
import { Button } from './ui';
import { formatMoney } from './format';
import type { CatalogueProduct, SupplierSummary } from './types';

export function ProductSearch({
  title,
  placeholder,
  products,
  suppliers,
  inBasket,
  onAdd,
  onClose,
  showAllWhenEmpty,
  autoFocus,
  label = 'Search products',
}: {
  title?: string;
  placeholder: string;
  products: CatalogueProduct[];
  suppliers: SupplierSummary[];
  inBasket: (productId: string) => boolean;
  onAdd: (item: CatalogueProduct) => void;
  onClose?: () => void;
  showAllWhenEmpty?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? products.filter((p) => p.name.toLowerCase().includes(trimmed))
    : showAllWhenEmpty ? products : [];

  return (
    <div>
      {title && (
        <div className={s.cardSearchHead}>
          <h3 className={s.cardSearchTitle}>{title}</h3>
          {onClose && (
            <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
      <div className={s.search}>
        <Search size={16} className={s.searchIcon} aria-hidden />
        <label htmlFor={inputId} className={s.srOnly}>{label}</label>
        <input
          id={inputId}
          className={s.searchInput}
          type="search"
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {matches.length > 0 && (
        <ul className={s.results}>
          {matches.slice(0, 8).map((item) => {
            const supplier = suppliers.find((sup) => sup.id === item.supplierId);
            const added = inBasket(item.productId);
            return (
              <li key={item.productId} className={s.result}>
                <div style={{ minWidth: 0 }}>
                  <div className={s.resultName}>{item.name}</div>
                  <div className={s.resultMeta}>
                    {supplier?.name} · {formatMoney(item.unitPrice, supplier?.currency)} per {item.orderUnit}
                  </div>
                </div>
                <Button size="sm" onClick={() => onAdd(item)} disabled={added} aria-label={added ? `${item.name} is in your basket` : `Add ${item.name}`}>
                  {added ? 'In basket' : 'Add'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {trimmed && matches.length === 0 && <p className={s.emptyResult}>Nothing matches &ldquo;{query.trim()}&rdquo;.</p>}
    </div>
  );
}
