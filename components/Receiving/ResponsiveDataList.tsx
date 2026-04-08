'use client';

import { ReactNode, useId } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  mobileRole?: 'title' | 'subtitle' | 'badge' | 'hidden';
  render: (row: T, index: number) => ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyText?: string;
}

export default function ResponsiveDataList<T>({ columns, data, getRowKey, emptyText }: Props<T>) {
  const uid = useId();

  if (data.length === 0) {
    return (
      <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)', fontSize: '14px' }}>
        {emptyText ?? 'No items'}
      </p>
    );
  }

  return (
    <>
      <style>{`
        .rdl-table-${uid.replace(/:/g, '')} { display: table; }
        .rdl-cards-${uid.replace(/:/g, '')} { display: none; }
        @media (max-width: 700px) {
          .rdl-table-${uid.replace(/:/g, '')} { display: none !important; }
          .rdl-cards-${uid.replace(/:/g, '')} { display: flex !important; }
        }
      `}</style>

      {/* Desktop table */}
      <table
        className={`rdl-table-${uid.replace(/:/g, '')}`}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-primary)',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: '12px', fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-secondary)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={getRowKey(row)}>
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    verticalAlign: 'middle',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div
        className={`rdl-cards-${uid.replace(/:/g, '')}`}
        style={{ flexDirection: 'column', gap: '10px' }}
      >
        {data.map((row, i) => {
          const titleCol = columns.find(c => c.mobileRole === 'title');
          const subtitleCol = columns.find(c => c.mobileRole === 'subtitle');
          const badgeCol = columns.find(c => c.mobileRole === 'badge');
          const restCols = columns.filter(c => c.mobileRole !== 'title' && c.mobileRole !== 'subtitle' && c.mobileRole !== 'badge' && c.mobileRole !== 'hidden');

          return (
            <div
              key={getRowKey(row)}
              style={{
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  {titleCol && <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{titleCol.render(row, i)}</div>}
                  {subtitleCol && <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{subtitleCol.render(row, i)}</div>}
                </div>
                {badgeCol && <div>{badgeCol.render(row, i)}</div>}
              </div>
              {restCols.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px', fontSize: '12px', fontWeight: 500 }}>
                  {restCols.map(col => (
                    <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>{col.header}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{col.render(row, i)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
