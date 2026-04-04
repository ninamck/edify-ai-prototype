'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import CreditNoteList from '@/components/CreditNotes/CreditNoteList';
import CreditNoteDetail from '@/components/CreditNotes/CreditNoteDetail';

export default function CreditNotesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {selectedId && (
          <div
            onClick={() => setSelectedId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(34,68,68,0.18)',
              backdropFilter: 'blur(2px)',
              zIndex: 199,
            }}
          />
        )}
      </AnimatePresence>

      <div style={{ padding: '28px 24px 48px', maxWidth: '1040px', margin: '0 auto' }}>
        <CreditNoteList onView={(id) => setSelectedId(id)} />
      </div>

      {/* Detail slide-in panel */}
      <AnimatePresence>
        {selectedId && (
          <CreditNoteDetail
            key={selectedId}
            creditNoteId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
