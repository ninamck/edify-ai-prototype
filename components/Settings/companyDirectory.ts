/**
 * companyDirectory — fixture data for the Configure settings tabs that
 * recreate Edify's existing company-level surfaces (Sites, Users,
 * Company Info). These mirror the staging.edifysystems.io account we're
 * borrowing from (Emirates Leisure Retail) so the prototype reads as a
 * faithful in-system reproduction rather than abstract dummy data.
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
  name: 'Emirates Leisure Retail (LLC)',
  franchiseOf: '',
  contactName: 'Stephane',
  contactEmail: 'placeholder@edifysystems.io',
  jobTitle: '10316',
  accountsEmail: 'payablesservices@mmielr.com',
  invoiceEmail: 'maryg@mmielr.com',
  statementEmail: 'ewas@mmielr.com',
  phoneDial: '+44',
  phoneNumber: '',
  mobileDial: '+44',
  mobileNumber: '',
  website: '',
  addressLine1: '5TH FLOOR EMIRATES HOLIDAYS BUILDING',
  addressLine2: 'SHEIKH ZAYED ROAD, BUSINESS BAY',
  city: 'DUBAI',
  postCode: '',
  country: 'United Arab Emirates',
  vatNumber: '',
  companyRegistrationNumber: 'I00229410400003',
  supplierPriceUpdatePolicy: 'per-supplier' as 'manual' | 'auto' | 'per-supplier',
};

export const DIRECTORY_SITES: DirectorySite[] = [
  {
    id: 'dxb-conca-pret',
    name: 'DXB CONCA PRET A MANGER',
    location: 'Dubai Airport, Terminal 3 , Conca Dubai DXB',
    status: 'active',
  },
  {
    id: 'dxb-concd-pret',
    name: 'DXB CONCD PRET A MANGER',
    location: 'Dubai Airport, Terminal 1 , Concd Dubai DXB',
    status: 'active',
  },
  {
    id: 'dxb-concd-qinwan',
    name: 'DXB CONCD QINWAN',
    location: 'Dubai International Airport DXB , Terminal 1 Concourse D Dubai Dubai',
    status: 'active',
  },
  {
    id: 'dxb-t3-grind',
    name: 'DXB T3 DEPARTURE LANDSIDE GRIND',
    location: 'Terminal 3, Departure Landside DXB-10-TB3-L2-1.01.10 Dubai Dubai',
    status: 'active',
  },
  {
    id: 'elr-hub-kitchen',
    name: 'ELR Hub Kitchen',
    location: 'DIB Warehouse No. 24 Al Goze Industrial Fourth (Al Quoz) Dubai Dubai',
    status: 'active',
  },
  {
    id: 'pret-bay-avenue',
    name: 'PRET A MANGER BAY AVENUE',
    location:
      'Unit G62 Executive Tower E, Al Mustaqbal Street, Downtown Dubai, Business Bay Dubai Dubai',
    status: 'active',
  },
  {
    id: 'pret-difc',
    name: 'PRET A MANGER DIFC',
    location:
      'Ground Floor, Gate District 5 Marble Walk, DIFC (Dubai International Financial Centre) Dubai Dubai',
    status: 'active',
  },
  {
    id: 'pret-index-mall',
    name: 'PRET A MANGER INDEX MALL',
    location: 'RT226 Index Tower, Al Mustaqbal Street, Zabeel, Dubai 482015',
    status: 'active',
  },
  {
    id: 'pret-aviation-college',
    name: 'PRET AVIATION COLLEGE C LOBBY',
    location: 'Emirates Training College Building C,Al Garhoud, Deira,',
    status: 'active',
  },
];

export const DIRECTORY_USERS: DirectoryUser[] = [
  { id: 'u-001', name: 'ADRAINNE ALMOCERA', email: 'adrainne.almocera@mmielr.com', contactPhone: null, role: 'Employee', status: 'active' },
  { id: 'u-002', name: 'AILYN DIONEDA',     email: 'ailyn.dioneda@mmielr.com',     contactPhone: null, role: 'Manager',  status: 'active' },
  { id: 'u-003', name: 'AIRIBEL AGUSTIN',   email: 'airibel.agustin@mmielr.com',   contactPhone: null, role: 'Employee', status: 'active' },
  { id: 'u-004', name: 'ALANA COLIBAO',     email: 'alana.colibao@mmielr.com',     contactPhone: null, role: 'Employee', status: 'active' },
  { id: 'u-005', name: 'Aljedrec Paned',    email: 'aljedrec.paned@mmielr.com',    contactPhone: null, role: 'Manager',  status: 'active' },
  { id: 'u-006', name: 'ANDE REBUSTES',     email: 'ande.rebustes@mmielr.com',     contactPhone: null, role: 'Employee', status: 'active' },
  { id: 'u-007', name: 'Aniket Wakins',     email: 'aniketw@mmielr.com',           contactPhone: null, role: 'Admin',    status: 'active' },
  { id: 'u-008', name: 'ANNA GALAC',        email: 'annag@mmielr.com',             contactPhone: null, role: 'Manager',  status: 'active' },
  { id: 'u-009', name: 'Anna Vanessa',      email: 'annaco@mmielr.com',            contactPhone: null, role: 'Manager',  status: 'active' },
  { id: 'u-010', name: 'Arlene Cruz',       email: 'arlene.cruz@mmielr.com',       contactPhone: null, role: 'Employee', status: 'active' },
];
