/**
 * companyDirectory — fixture data for the Configure settings tabs that
 * recreate Edify's existing company-level surfaces (Sites, Users,
 * Company Info). For this single-client demo build they describe the
 * CHAGEE UK flagship tea house so the prototype reads as a faithful
 * in-system reproduction rather than abstract dummy data.
 *
 * Pure data only — no React imports — so it can be consumed by tables,
 * form prefills, or future AI surfaces that want to enumerate sites /
 * users (e.g. "who should I assign this to?").
 */

export type DirectorySite = {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive';
};

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  contactPhone: string | null;
  role: 'Admin' | 'Manager' | 'Employee';
  status: 'active' | 'inactive';
};

export const DIRECTORY_COMPANY = {
  name: 'CHAGEE UK Ltd',
  franchiseOf: '',
  contactName: 'Grace Lim',
  contactEmail: 'grace.lim@chagee.com',
  jobTitle: 'Operations Lead',
  accountsEmail: 'accountspayable@chagee.com',
  invoiceEmail: 'invoices@chagee.com',
  statementEmail: 'statements@chagee.com',
  phoneDial: '+44',
  phoneNumber: '20 7946 0100',
  mobileDial: '+44',
  mobileNumber: '',
  website: 'https://www.chagee.com',
  addressLine1: 'CHAGEE Flagship Tea House',
  addressLine2: '120 Regent Street',
  city: 'London',
  postCode: 'W1B 5SE',
  country: 'United Kingdom',
  vatNumber: 'GB 412 6789 03',
  companyRegistrationNumber: '15234876',
  supplierPriceUpdatePolicy: 'per-supplier' as 'manual' | 'auto' | 'per-supplier',
};

export const DIRECTORY_SITES: DirectorySite[] = [
  {
    id: 'chagee-flagship',
    name: 'CHAGEE — Flagship',
    location: '120 Regent Street, London W1B 5SE',
    status: 'active',
  },
];

export const DIRECTORY_USERS: DirectoryUser[] = [
  { id: 'u-001', name: 'Grace Lim',      email: 'grace.lim@chagee.com',      contactPhone: null, role: 'Admin',    status: 'active' },
  { id: 'u-002', name: 'Daniel Okafor',  email: 'daniel.okafor@chagee.com',  contactPhone: null, role: 'Manager',  status: 'active' },
  { id: 'u-003', name: 'Mei Tanaka',     email: 'mei.tanaka@chagee.com',     contactPhone: null, role: 'Employee', status: 'active' },
  { id: 'u-004', name: 'Sofia Rossi',    email: 'sofia.rossi@chagee.com',    contactPhone: null, role: 'Employee', status: 'active' },
];
