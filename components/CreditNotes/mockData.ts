export type CreditNoteStatus = 'Requested' | 'Chasing' | 'Overdue' | 'Received' | 'Applied';
export type CreditNoteReason = 'Short delivery' | 'Damaged goods' | 'Price variance' | 'Returned goods';
export type ChaseMethod = 'Email' | 'Phone call' | 'Supplier portal';

export interface ChaseEvent {
  id: string;
  date: string;
  type: 'raised' | 'chased' | 'escalated' | 'received' | 'applied';
  method?: ChaseMethod;
  note?: string;
  by: string;
}

export interface CreditNote {
  id: string;
  ref: string;
  supplier: string;
  raisedDate: string;
  daysOutstanding: number;
  amount: number;
  reason: CreditNoteReason;
  status: CreditNoteStatus;
  originRef: string;
  originType: 'GRN' | 'Invoice';
  originDate: string;
  supplierRef?: string;
  linkedInvoice?: string;
  chaseHistory: ChaseEvent[];
}

export const MOCK_CREDIT_NOTES: CreditNote[] = [
  {
    id: 'cn-1',
    ref: 'CN-008',
    supplier: 'Bidfood',
    raisedDate: '14 Mar 2026',
    daysOutstanding: 21,
    amount: 54.00,
    reason: 'Short delivery',
    status: 'Overdue',
    originRef: 'GRN-1231',
    originType: 'GRN',
    originDate: '14 Mar 2026',
    chaseHistory: [
      {
        id: 'ce-1',
        date: '14 Mar 2026 · 09:12',
        type: 'raised',
        note: 'Short delivery — 6 units of Espresso Blend 1kg missing from delivery.',
        by: 'Sarah T.',
      },
      {
        id: 'ce-2',
        date: '18 Mar 2026 · 11:30',
        type: 'chased',
        method: 'Email',
        note: 'Sent follow-up email to accounts@bidfood.co.uk',
        by: 'Sarah T.',
      },
      {
        id: 'ce-3',
        date: '25 Mar 2026 · 14:00',
        type: 'chased',
        method: 'Phone call',
        note: 'Spoke to Bidfood accounts — they said it would be processed this week.',
        by: 'Sarah T.',
      },
    ],
  },
  {
    id: 'cn-2',
    ref: 'CN-009',
    supplier: 'Fresh Direct',
    raisedDate: '20 Mar 2026',
    daysOutstanding: 15,
    amount: 28.80,
    reason: 'Damaged goods',
    status: 'Chasing',
    originRef: 'GRN-1236',
    originType: 'GRN',
    originDate: '20 Mar 2026',
    chaseHistory: [
      {
        id: 'ce-4',
        date: '20 Mar 2026 · 10:05',
        type: 'raised',
        note: 'Cherry tomatoes 500g — 8 punnets arrived damaged/crushed.',
        by: 'James R.',
      },
      {
        id: 'ce-5',
        date: '27 Mar 2026 · 09:00',
        type: 'chased',
        method: 'Email',
        note: 'Chased Fresh Direct via email — no response yet.',
        by: 'James R.',
      },
    ],
  },
  {
    id: 'cn-3',
    ref: 'CN-010',
    supplier: 'Bidfood',
    raisedDate: '26 Mar 2026',
    daysOutstanding: 9,
    amount: 23.40,
    reason: 'Price variance',
    status: 'Chasing',
    originRef: 'INV-4401',
    originType: 'Invoice',
    originDate: '26 Mar 2026',
    chaseHistory: [
      {
        id: 'ce-6',
        date: '26 Mar 2026 · 15:20',
        type: 'raised',
        note: 'Full cream milk 2L invoiced at £4.50 vs agreed £4.20 — 18 units = £5.40 overcharge. Espresso blend invoiced at £19.20 vs agreed £18.00.',
        by: 'Sarah T.',
      },
      {
        id: 'ce-7',
        date: '1 Apr 2026 · 10:45',
        type: 'chased',
        method: 'Supplier portal',
        note: 'Logged dispute on Bidfood supplier portal.',
        by: 'Sarah T.',
      },
    ],
  },
  {
    id: 'cn-4',
    ref: 'CN-007',
    supplier: 'Metro',
    raisedDate: '7 Mar 2026',
    daysOutstanding: 28,
    amount: 48.00,
    reason: 'Returned goods',
    status: 'Received',
    supplierRef: 'METRO-CN-2241',
    linkedInvoice: 'INV-4415',
    originRef: 'GRN-1218',
    originType: 'GRN',
    originDate: '7 Mar 2026',
    chaseHistory: [
      {
        id: 'ce-8',
        date: '7 Mar 2026 · 08:30',
        type: 'raised',
        note: 'Returned 4 cases of takeaway cups (wrong size delivered).',
        by: 'James R.',
      },
      {
        id: 'ce-9',
        date: '14 Mar 2026 · 09:00',
        type: 'chased',
        method: 'Email',
        note: 'Emailed accounts@metro.co.uk requesting credit note.',
        by: 'James R.',
      },
      {
        id: 'ce-10',
        date: '20 Mar 2026 · 11:15',
        type: 'chased',
        method: 'Phone call',
        note: 'Called Metro accounts. Confirmed they have the return logged.',
        by: 'Sarah T.',
      },
      {
        id: 'ce-11',
        date: '4 Apr 2026 · 09:00',
        type: 'received',
        note: 'Credit note METRO-CN-2241 received for £48.00.',
        by: 'System',
      },
    ],
  },
  {
    id: 'cn-5',
    ref: 'CN-006',
    supplier: 'Urban Fresh',
    raisedDate: '1 Mar 2026',
    daysOutstanding: 34,
    amount: 32.00,
    reason: 'Short delivery',
    status: 'Applied',
    supplierRef: 'UF-CN-0094',
    linkedInvoice: 'INV-4388',
    originRef: 'GRN-1209',
    originType: 'GRN',
    originDate: '1 Mar 2026',
    chaseHistory: [
      {
        id: 'ce-12',
        date: '1 Mar 2026 · 07:50',
        type: 'raised',
        note: 'Spinach 1kg — 4 bags missing from delivery.',
        by: 'James R.',
      },
      {
        id: 'ce-13',
        date: '8 Mar 2026 · 10:00',
        type: 'chased',
        method: 'Email',
        note: 'Emailed Urban Fresh accounts.',
        by: 'James R.',
      },
      {
        id: 'ce-14',
        date: '15 Mar 2026 · 14:30',
        type: 'received',
        note: 'Credit note UF-CN-0094 received for £32.00.',
        by: 'System',
      },
      {
        id: 'ce-15',
        date: '4 Apr 2026 · 09:00',
        type: 'applied',
        note: 'Applied to INV-4388. Invoice balance adjusted.',
        by: 'Sarah T.',
      },
    ],
  },
  {
    id: 'cn-6',
    ref: 'CN-011',
    supplier: 'Fresh Direct',
    raisedDate: '2 Apr 2026',
    daysOutstanding: 2,
    amount: 16.80,
    reason: 'Price variance',
    status: 'Requested',
    originRef: 'INV-4418',
    originType: 'Invoice',
    originDate: '1 Apr 2026',
    chaseHistory: [
      {
        id: 'ce-16',
        date: '2 Apr 2026 · 11:30',
        type: 'raised',
        note: 'Baby spinach and cherry tomatoes invoiced above agreed price. Total overcharge £4.20.',
        by: 'Sarah T.',
      },
    ],
  },
  {
    id: 'cn-7',
    ref: 'CN-012',
    supplier: 'Bidfood',
    raisedDate: '4 Apr 2026',
    daysOutstanding: 0,
    amount: 16.80,
    reason: 'Short delivery',
    status: 'Received',
    supplierRef: 'BIDFOOD-CN-3302',
    linkedInvoice: 'INV-4432',
    originRef: 'GRN-1248',
    originType: 'GRN',
    originDate: '4 Apr 2026',
    chaseHistory: [
      {
        id: 'ce-17',
        date: '4 Apr 2026 · 14:10',
        type: 'raised',
        note: 'Dairy delivery short — 4 of 30 milk 2L not received. £16.80 credit requested.',
        by: 'Ravi P.',
      },
      {
        id: 'ce-18',
        date: '5 Apr 2026 · 09:00',
        type: 'received',
        note: 'Credit note BIDFOOD-CN-3302 received for £16.80.',
        by: 'System',
      },
    ],
  },
];

export function getCreditNotesForInvoice(invoiceNumber: string): CreditNote[] {
  return MOCK_CREDIT_NOTES.filter(cn => cn.linkedInvoice === invoiceNumber);
}

export function pendingChaseCount(): number {
  return MOCK_CREDIT_NOTES.filter(
    (cn) => cn.status === 'Requested' || cn.status === 'Chasing' || cn.status === 'Overdue',
  ).length;
}

export function overdueCount(): number {
  return MOCK_CREDIT_NOTES.filter((cn) => cn.status === 'Overdue').length;
}

export function totalOutstanding(): number {
  return MOCK_CREDIT_NOTES.filter(
    (cn) => cn.status === 'Requested' || cn.status === 'Chasing' || cn.status === 'Overdue',
  ).reduce((sum, cn) => sum + cn.amount, 0);
}
