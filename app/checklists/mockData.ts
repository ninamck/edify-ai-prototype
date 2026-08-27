import type { BriefingPhase } from '@/components/briefing';
import type {
  ChecklistTemplate,
  ChecklistInstance,
  ChecklistQuestion,
  CorrectiveAssigneeType,
  FollowUpCondition,
  ResponseType,
  Severity,
} from './types';

export const MOCK_SITES = ['Fitzroy Espresso', 'South Yarra', 'Richmond', 'Carlton', 'Platō Tokai'];

// ── Site team map ─────────────────────────────────────────────────────
//
// Who a corrective action can be assigned to at each site: the named
// outlet manager, or the site's shared store account. One checklist
// template resolves per-site — no per-store duplication needed.

export interface SiteTeam {
  outletManager: string;
  storeAccount: string;
}

export const SITE_TEAM: Record<string, SiteTeam> = {
  'Fitzroy Espresso': { outletManager: 'Cheryl Wong', storeAccount: 'Fitzroy Espresso (store account)' },
  'South Yarra': { outletManager: 'Sam Torres', storeAccount: 'South Yarra (store account)' },
  Richmond: { outletManager: 'Jordan Beck', storeAccount: 'Richmond (store account)' },
  Carlton: { outletManager: 'Priya Nair', storeAccount: 'Carlton (store account)' },
  'Platō Tokai': { outletManager: 'Marco Silva', storeAccount: 'Platō Tokai (store account)' },
};

export function getSiteTeam(site: string): SiteTeam {
  return SITE_TEAM[site] ?? { outletManager: 'Outlet manager', storeAccount: `${site} (store account)` };
}

export function assigneeNameFor(site: string, type: CorrectiveAssigneeType): string {
  const team = getSiteTeam(site);
  return type === 'outlet_manager' ? team.outletManager : team.storeAccount;
}

/** Builds a flat list of simple questions (checkbox by default) — used by the Platō checklists. */
function simpleChecks(
  prefix: string,
  names: string[],
  opts?: { mandatory?: boolean; responseType?: ResponseType },
): ChecklistQuestion[] {
  return names.map((name, i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    mandatory: opts?.mandatory ?? true,
    allowPhoto: false,
    responseType: opts?.responseType ?? ('checkbox' as ResponseType),
    followUpRules: [],
  }));
}

/** Great/Average/Urgent rating questions with notes — used by the Platō store check sheet. */
function ratingChecks(prefix: string, names: string[]): ChecklistQuestion[] {
  return simpleChecks(prefix, names, { responseType: 'rating' });
}

export const MOCK_USERS = [
  { id: 'u1', name: 'Ed Mehta' },
  { id: 'u2', name: 'Cheryl Wong' },
  { id: 'u3', name: 'Jordan Beck' },
  { id: 'u4', name: 'Sam Torres' },
  { id: 'u5', name: 'Priya Nair' },
  { id: 'u6', name: 'Marco Silva' },
];

/** Default corrective-action config for the monthly ops audit questions:
 *  every No raises an action, assigned to the outlet manager by default,
 *  with photo evidence required on resolution. */
const OPS_CA_CONFIG = {
  triggerOnNo: true as const,
  defaultAssignee: 'outlet_manager' as const,
  requirePhotoEvidence: true,
};

/** Yes/No questions that raise an assignable corrective action on No. */
function opsAuditChecks(prefix: string, names: string[]): ChecklistQuestion[] {
  return names.map((name, i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    mandatory: true,
    allowPhoto: false,
    responseType: 'checkbox' as ResponseType,
    followUpRules: [],
    correctiveActionConfig: { ...OPS_CA_CONFIG },
  }));
}

/** Scored Yes/No audit question with photo allowed on the answer.
 *  Its point value comes from the template's severity weight map. */
function auditCheck(
  id: string,
  name: string,
  sectionId: string,
  severity: Severity,
): ChecklistQuestion {
  return {
    id,
    name,
    mandatory: true,
    allowPhoto: true,
    responseType: 'checkbox',
    followUpRules: [],
    severity,
    sectionId,
  };
}

export const MOCK_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Opening checks',
    sites: ['Fitzroy Espresso', 'South Yarra'],
    notifyUserIds: ['u2'],
    frequency: 'daily',
    timeOfDay: '07:00',
    assignedRoles: ['employee', 'manager'],
    active: true,
    questions: [
      {
        id: 'q1',
        name: 'Are all display fridges at correct temperature?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [
          {
            id: 'fr1',
            condition: { type: 'unchecked' },
            followUpQuestionId: 'q1a',
          },
        ],
      },
      {
        id: 'q1a',
        name: 'Document the fridge issue and corrective action taken',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: 'q1',
      },
      {
        id: 'q2',
        name: 'Fridge 1 temperature (°C)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'temperature',
        followUpRules: [
          {
            id: 'fr2',
            condition: { type: 'greater_than', value: 5 },
            followUpQuestionId: 'q2a',
          },
        ],
      },
      {
        id: 'q2a',
        name: 'Fridge is above safe temperature — describe corrective action',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: 'q2',
      },
      {
        id: 'q3',
        name: 'Are all cleaning checklists from close last night complete?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'q4',
        name: 'Is the coffee machine running correctly?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'q5',
        name: 'Any maintenance issues to log?',
        mandatory: false,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
      },
    ],
  },
  {
    id: 'tpl-2',
    name: 'Temperature log — cold chain',
    sites: ['Fitzroy Espresso', 'South Yarra', 'Richmond', 'Carlton'],
    notifyUserIds: ['u1', 'u2'],
    frequency: 'daily',
    timeOfDay: '09:00',
    assignedRoles: ['employee'],
    active: true,
    questions: [
      {
        id: 'qt1',
        name: 'Walk-in cool room temperature (°C)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'temperature',
        followUpRules: [
          {
            id: 'fr3',
            condition: { type: 'greater_than', value: 4 },
            followUpQuestionId: 'qt1a',
          },
        ],
      },
      {
        id: 'qt1a',
        name: 'Cool room above 4°C — log corrective action and notify manager',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: 'qt1',
      },
      {
        id: 'qt2',
        name: 'Sandwich fridge temperature (°C)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'temperature',
        followUpRules: [],
      },
      {
        id: 'qt3',
        name: 'Drinks fridge temperature (°C)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'temperature',
        followUpRules: [],
      },
      {
        id: 'qt4',
        name: 'All labels checked for use-by dates?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [
          {
            id: 'fr4',
            condition: { type: 'unchecked' },
            followUpQuestionId: 'qt4a',
          },
        ],
      },
      {
        id: 'qt4a',
        name: 'List items with expired or missing use-by dates',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: 'qt4',
      },
    ],
  },
  {
    id: 'tpl-3',
    name: 'Closing checks',
    sites: ['Fitzroy Espresso'],
    notifyUserIds: [],
    frequency: 'daily',
    timeOfDay: '17:00',
    assignedRoles: ['manager'],
    active: true,
    questions: [
      {
        id: 'qc1',
        name: 'All food stored correctly and labelled?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'qc2',
        name: 'Cash counted and reconciled?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'qc3',
        name: 'Total cash in drawer ($)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'number',
        followUpRules: [],
      },
      {
        id: 'qc4',
        name: 'All cleaning tasks complete?',
        mandatory: true,
        allowPhoto: true,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'qc5',
        name: 'Any incidents to report?',
        mandatory: false,
        allowPhoto: false,
        responseType: 'text',
        followUpRules: [],
      },
    ],
  },
  {
    id: 'tpl-4',
    name: 'Weekly equipment check',
    sites: ['Fitzroy Espresso', 'South Yarra', 'Richmond'],
    notifyUserIds: ['u3'],
    frequency: 'weekly',
    timeOfDay: '08:00',
    assignedRoles: ['manager'],
    active: false,
    questions: [
      {
        id: 'qe1',
        name: 'Coffee machine serviced this week?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'qe2',
        name: 'Grinder calibration checked?',
        mandatory: true,
        allowPhoto: false,
        responseType: 'checkbox',
        followUpRules: [],
      },
      {
        id: 'qe3',
        name: 'Any equipment faults to log?',
        mandatory: false,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
      },
    ],
  },
  // ── Monthly ops audit — one template, every site, one named auditor.
  //    Each No raises a corrective action assigned to that site's team. ──
  {
    id: 'tpl-monthly-ops',
    name: 'Monthly ops audit',
    sites: ['Fitzroy Espresso', 'South Yarra', 'Richmond', 'Carlton'],
    notifyUserIds: [],
    notifyScope: 'site_assignees',
    frequency: 'monthly',
    timeOfDay: '10:00',
    assignedRoles: ['admin'],
    active: true,
    questions: opsAuditChecks('qm', [
      'Fire exits clear and unobstructed?',
      'Pest control log up to date with no signs of activity?',
      'Food hygiene certificates displayed and in date?',
      'First aid kit fully stocked and in date?',
      'Waste area clean and bins secured?',
      'Extraction and ventilation filters clean?',
    ]),
  },
  // ── Daily delivery temperatures — repeating rows, one per delivery ──
  {
    id: 'tpl-delivery-temps',
    name: 'Daily delivery temperatures',
    sites: ['Fitzroy Espresso', 'South Yarra', 'Richmond', 'Carlton'],
    notifyUserIds: [],
    notifyScope: 'site_assignees',
    frequency: 'daily',
    timeOfDay: '11:00',
    assignedRoles: ['employee', 'manager'],
    active: true,
    questions: [
      {
        id: 'qd1',
        name: 'Log each delivery as it arrives',
        mandatory: true,
        allowPhoto: false,
        responseType: 'repeating_group',
        followUpRules: [],
        groupFields: [
          { id: 'f-supplier', name: 'Supplier name', type: 'text' },
          { id: 'f-product', name: 'Product name', type: 'text' },
          {
            id: 'f-condition',
            name: 'Received in good condition?',
            type: 'checkbox',
            followUpPrompt: 'Describe the condition issue and what was done with the product',
          },
          {
            id: 'f-temp',
            name: 'Temperature (°C)',
            type: 'temperature',
            maxThreshold: 5,
            followUpPrompt: 'Temperature above 5°C — record the action taken (reject, quarantine, escalate)',
          },
        ],
      },
    ],
  },
  // ── Brand standards audit — a checklist with scoring switched on.
  //    Points per question, severity-driven alerting, sections with
  //    subtotals, pass mark 80%, and any critical fail fails the audit. ──
  {
    id: 'tpl-brand-audit',
    name: 'Brand standards audit',
    sites: ['Fitzroy Espresso', 'South Yarra', 'Richmond', 'Carlton'],
    notifyUserIds: [],
    notifyScope: 'site_assignees',
    frequency: 'monthly',
    timeOfDay: '09:00',
    assignedRoles: ['admin'],
    active: true,
    scoringEnabled: true,
    passThresholdPct: 80,
    sections: [
      { id: 'sec-foh', name: 'Front of house' },
      { id: 'sec-food', name: 'Food safety' },
      { id: 'sec-brand', name: 'Brand standards' },
    ],
    questions: [
      // Front of house — every check counts for one; severity drives
      // alert routing and the critical override, not the arithmetic
      auditCheck('qa-1', 'Storefront glass and windows intact, clean and free of damage?', 'sec-foh', 'critical'),
      auditCheck('qa-2', 'Seating area clean, tidy and free of damage?', 'sec-foh', 'medium'),
      auditCheck('qa-3', 'Music, lighting and temperature at brand standard?', 'sec-foh', 'low'),
      // Food safety
      {
        id: 'qa-4',
        name: 'Display fridge temperature (°C)',
        mandatory: true,
        allowPhoto: false,
        responseType: 'temperature',
        followUpRules: [
          { id: 'qa-4-r1', condition: { type: 'greater_than', value: 5 }, followUpQuestionId: 'qa-4f' },
        ],
        severity: 'critical',
        sectionId: 'sec-food',
      },
      {
        id: 'qa-4f',
        name: 'Fridge above 5°C — record the stock moved and the action taken',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: 'qa-4',
      },
      auditCheck('qa-5', 'Handwash stations stocked — soap, towels, hot water?', 'sec-food', 'critical'),
      auditCheck('qa-6', 'Allergen matrix current and accessible to staff?', 'sec-food', 'medium'),
      auditCheck('qa-7', 'Date labels present on all open products?', 'sec-food', 'medium'),
      // Brand standards
      auditCheck('qa-8', 'Menu boards current with no handwritten amendments?', 'sec-brand', 'low'),
      auditCheck('qa-9', 'Team in correct uniform with name badges?', 'sec-brand', 'low'),
      auditCheck('qa-10', 'Only approved point-of-sale artwork displayed?', 'sec-brand', 'medium'),
    ],
  },
  // ── Platō Coffee checklists (available to all roles, all sites) ──
  {
    id: 'tpl-plato-open',
    name: 'Platō opening checklist',
    sites: [...MOCK_SITES],
    notifyUserIds: [],
    frequency: 'daily',
    timeOfDay: '05:30',
    assignedRoles: ['employee', 'manager', 'admin'],
    active: true,
    questions: [
      ...simpleChecks('po', [
        'All legends clock-in at 05:30',
        'Start the music for good vibes!',
        'Ensure that there is a black marker available, cups and syrups are ready',
        'Fill the hoppers (houseblend & decaf), open the hopper gate, switch grinders on',
        'Turn on PuqPress and set to 20, ensure the NCD is set to 8',
        'Rinse and warm up the portafilters',
        'Set up your bar: cloths, milk pitchers, thermometer, spoon, shot glasses & bar brush',
        'Program your machine',
        'Dial-in both house blend and decaf coffee and taste',
        'Check that there is enough milk available and ensure no milk has expired',
        'Check that the cups on the machine are stacked correctly',
        'Take out condensed milk from the fridge and ensure the honey, cinnamon & chocolate shakers are full',
        'Ensure that the condiment stand is clean and well-stocked',
        'Pack out fresh pastries, brownies and cookie jars',
        'Place blenders at their station',
        'All bins have liners in them',
        'All furniture is packed out',
      ]),
      {
        id: 'po-goals',
        name: 'Set your goals and intentions for the day (3 goals each) — keep Flow above 50% and make all customers feel welcomed!',
        mandatory: false,
        allowPhoto: false,
        responseType: 'text',
        followUpRules: [],
      },
    ],
  },
  {
    id: 'tpl-plato-close',
    name: 'Platō closing checklist',
    sites: [...MOCK_SITES],
    notifyUserIds: [],
    frequency: 'daily',
    timeOfDay: '17:30',
    assignedRoles: ['employee', 'manager', 'admin'],
    active: true,
    questions: [
      ...simpleChecks('pc', [
        'Clean steam wands',
        'Back flush both group heads with Cafiza',
        'Repeat back flush with water only',
        'Remove dispersion screens (keep the screws safe)',
        'Place all stainless-steel parts of the portafilter and dispersion screens inside Cafiza bath for 30 minutes as you clean — rinse and leave to dry',
        'Flush and brush both group heads with red brush dipped into Cafiza bath',
        'Drip tray rinsed and cleaned',
        'House blend & decaf beans placed into an airtight container',
        'Wiped down hoppers and placed back onto the grinders',
        'All equipment cleaned (grinders, Puq Press, coffee machine and blenders)',
        'NCD cleaned — set back to 8',
        'Blender jugs washed and placed out to dry',
        'Milk pitchers washed and placed out to dry (no jugs left in fridge with milk inside)',
        'Flush pitcher rinser with sunlight and hot water from the hydroboil',
        'Wipe down counters well (including underneath the machine & on top of fridge)',
        'All shop surfaces cleaned / wiped down: counters, pastry box, tables, chairs, etc.',
        'Plug in the Felicita scale, card machine and Sonos to charge for the next day',
        'Brownies taken out of the jar and placed inside the fridge',
        'Pastries are placed inside an airtight container',
        'Condensed milk stored away in the fridge',
        'Air fryer baskets cleaned',
        'Knock box lid wiped with cloth',
        'All bins emptied',
        'All powders topped up',
        'Check all containers & bottle lids are closed properly & wiped down',
        'All new stock has been packed out / stock arranged neatly',
        'Alternative milk has been topped up in the fridge (at least two bottles of each)',
        'Enough retail water is packed out into the fridge',
        'All dish & dry wipe cloths are washed (bleach), rinsed out (water) & hung to dry',
        'Floors swept and mopped',
        'Both legends have clocked out',
        'Remember to switch alarm on',
      ]),
      ...simpleChecks(
        'pcw',
        [
          'Weekly: grinder and flapper clean',
          'Weekly: deep clean of the shop',
          'Weekly: ice machine filter to be cleaned',
          'Weekly: top of espresso machine cleaned (lift the screens and wipe down)',
          'Weekly: furniture fully wiped down',
          'Monthly: clean storage bin and sump cap of the ice machine',
        ],
        { mandatory: false },
      ),
    ],
  },
  {
    id: 'tpl-plato-storecheck',
    name: 'Platō store check sheet',
    sites: [...MOCK_SITES],
    notifyUserIds: [],
    frequency: 'monthly',
    timeOfDay: '09:00',
    assignedRoles: ['employee', 'manager', 'admin'],
    active: true,
    questions: [
      ...ratingChecks('psc-store', [
        "Store: 'PLATO' signage (interior & exterior)",
        'Store: lights',
        'Store: plants',
        'Store: menu board',
        'Store: A5 stands (correct pamphlets)',
        'Store: retail display (including shelving)',
        'Store: furniture',
        'Store: condiment stand',
        'Store: coffee bar (counter & cupboards)',
        'Store: structure (walls, windows, ceiling, floors, doors)',
        'Store: paint (interior & exterior)',
        'Store: water filters',
        'Store: taps (FOH and BOH if applicable)',
      ]),
      ...ratingChecks('psc-clean', [
        'Cleanliness: back of store (storeroom & behind bar)',
        'Cleanliness: front of store (seating/standing area)',
        'Cleanliness: sanitary (no off smells)',
        'Cleanliness: pest-free (no ants, bees, flies, cockroaches)',
      ]),
      ...ratingChecks('psc-elec', [
        'Electronics: YOCO POS (table, neo touch, printer)',
        'Electronics: YOYO scanner',
        'Electronics: iPad (functional stand & displaying Flow)',
        'Electronics: FLOW (device & cables)',
        'Electronics: SONOS speaker (playing Plato Radio/playlist)',
        'Electronics: WiFi',
      ]),
      ...ratingChecks('psc-tools', [
        'Barista tools: coffee scale',
        'Barista tools: NCD',
        'Barista tools: tamp mat',
        'Barista tools: counter brush',
        'Barista tools: knockbox',
        'Barista tools: thermometer',
        'Barista tools: shot glasses (minimum of 2)',
        'Barista tools: spoons (1x coffee, 1x condensed milk, 1x matcha)',
        'Barista tools: toolbox (shifting spanner, screwdriver set, caffeine wrench)',
      ]),
      ...ratingChecks('psc-equip', [
        'Equipment: espresso machine — Astoria Tempesta (including servicing)',
        'Equipment: portafilters and steamwand condition',
        'Equipment: blend grinder — Mahlkönig E65GBW (including servicing)',
        'Equipment: decaf grinder — Eureka (including servicing)',
        'Equipment: PUQ press',
        'Equipment: blenders',
        'Equipment: airfryer',
        'Equipment: ice machine (including servicing)',
        'Equipment: refrigerator (including servicing)',
        'Equipment: sandwich press (if applicable)',
        'Equipment: pastry fridge (if applicable)',
        'Equipment: pitcher rinser (if applicable)',
        'Equipment: hydroboil (if applicable)',
      ]),
      ...ratingChecks('psc-misc', [
        'Miscellaneous: pastry blocks',
        'Miscellaneous: correct cup markers',
        'Miscellaneous: cloths',
        'Miscellaneous: powder tubs (correct scoops)',
        'Miscellaneous: powder shakers (chocolate & cinnamon)',
        'Miscellaneous: steel tumblers (markers & thermometer)',
        'Miscellaneous: squeeze bottles (minimum of 2 for condensed milk)',
        'Miscellaneous: mango jug',
        'Miscellaneous: cream gun (with a date)',
        'Miscellaneous: paper towel dispenser',
        'Miscellaneous: COA (correctly displayed)',
        'Miscellaneous: fire extinguisher',
        'Miscellaneous: Gresham license',
      ]),
      ...ratingChecks('psc-stock', [
        'Basic stock: beans (blend, decaf, retail)',
        'Basic stock: milks & cream (8 variants of milk)',
        'Basic stock: syrups (13 variants with correct pumps)',
        'Basic stock: powders (9 variants and none expired)',
        'Basic stock: condiments (Plato sugars, honey, cinnamon, condensed milk)',
        'Basic stock: cookies (3 variants and none expired)',
        'Basic stock: water (preferably Mountain Falls)',
        'Basic stock: retail items (luxury treats, coffee beans & pods, USN range)',
        'Basic stock: pastries (if applicable)',
        'Basic stock: cups & lids (espresso, cortado, small, medium, large, clear medium, clear large)',
        'Basic stock: packaging (wooden stirrers, straws, serviettes, croissant bags, 2 & 4 cup carriers, shopper bags)',
        'Basic stock: sundries (hand soap, hand sanitiser, sunlight, pine gel, all purpose cleaner, roller towel, bin bags)',
        'Basic stock: smalls (nitrogen bombs, elastic bands, GRINDZ, CAFIZA)',
      ]),
      {
        id: 'psc-notes',
        name: 'General notes and follow-ups from this visit',
        mandatory: false,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
      },
    ],
  },
];

export const MOCK_INSTANCES: ChecklistInstance[] = [
  {
    id: 'inst-1',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed today · 7:05am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: 6 },
      { questionId: 'q2a', value: 'Fridge 1 was 6°C on arrival. Thermostat bumped down, re-checked at 7:40am — now 3°C. Will monitor through day.' },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '7:05am',
    completedDate: '2026-04-20',
    completedBy: 'Ed Mehta',
  },
  {
    id: 'inst-2',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Fitzroy Espresso',
    status: 'in_progress',
    dueLabel: 'Due today · 9:00am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 3 },
    ],
  },
  {
    id: 'inst-3',
    templateId: 'tpl-3',
    templateName: 'Closing checks',
    site: 'Fitzroy Espresso',
    status: 'pending',
    dueLabel: 'Due today · 5:00pm',
    assignedRole: 'manager',
    questionCount: 5,
    answers: [],
  },
  {
    id: 'inst-monthly-ops',
    templateId: 'tpl-monthly-ops',
    templateName: 'Monthly ops audit',
    site: 'South Yarra',
    status: 'pending',
    dueLabel: 'Due this month · by 30 Apr',
    assignedRole: 'admin',
    questionCount: 6,
    answers: [],
  },
  {
    id: 'inst-brand-audit',
    templateId: 'tpl-brand-audit',
    templateName: 'Brand standards audit',
    site: 'Fitzroy Espresso',
    status: 'pending',
    dueLabel: 'Due this month · by 30 Apr',
    assignedRole: 'admin',
    questionCount: 10,
    answers: [],
  },
  {
    id: 'inst-delivery-temps',
    templateId: 'tpl-delivery-temps',
    templateName: 'Daily delivery temperatures',
    site: 'Fitzroy Espresso',
    status: 'pending',
    dueLabel: 'Due today · as deliveries arrive',
    assignedRole: 'employee',
    questionCount: 1,
    answers: [],
  },
  {
    id: 'inst-4',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'South Yarra',
    status: 'complete',
    dueLabel: 'Completed today · 7:12am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: false },
      { questionId: 'q1a', value: 'Display fridge door seal broken. Raised a work order with Coolhub, items moved to backup unit.' },
      { questionId: 'q2', value: 3 },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '7:12am',
    completedDate: '2026-04-20',
    completedBy: 'Sam Torres',
  },
  {
    id: 'inst-5',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'South Yarra',
    status: 'complete',
    dueLabel: 'Completed today · 8:58am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 3 },
      { questionId: 'qt2', value: 4 },
      { questionId: 'qt3', value: 3 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '8:58am',
    completedDate: '2026-04-20',
    completedBy: 'Sam Torres',
  },
  {
    id: 'inst-6',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Richmond',
    status: 'complete',
    dueLabel: 'Completed today · 9:06am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 5 },
      { questionId: 'qt1a', value: 'Walk-in at 5°C — door left ajar overnight. Stock checked, nothing above 4°C at core. Manager notified.' },
      { questionId: 'qt2', value: 3 },
      { questionId: 'qt3', value: 2 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '9:06am',
    completedDate: '2026-04-20',
    completedBy: 'Jordan Beck',
  },
  {
    id: 'inst-7',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Carlton',
    status: 'complete',
    dueLabel: 'Completed today · 9:11am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 3 },
      { questionId: 'qt2', value: 4 },
      { questionId: 'qt3', value: 3 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '9:11am',
    completedDate: '2026-04-20',
    completedBy: 'Jordan Beck',
  },
  {
    id: 'inst-plato-open',
    templateId: 'tpl-plato-open',
    templateName: 'Platō opening checklist',
    site: 'Platō Tokai',
    status: 'complete',
    dueLabel: 'Completed today · 5:42am',
    assignedRole: 'employee',
    questionCount: 18,
    answers: [
      ...Array.from({ length: 17 }, (_, i) => ({ questionId: `po-${i + 1}`, value: true as const })),
      { questionId: 'po-goals', value: 'Keep Flow above 60% today, upsell cookies with every flat white, learn two regulars by name.' },
    ],
    completedAt: '5:42am',
    completedDate: '2026-04-20',
    completedBy: 'Sam Torres',
  },
  {
    id: 'inst-plato-close',
    templateId: 'tpl-plato-close',
    templateName: 'Platō closing checklist',
    site: 'Platō Tokai',
    status: 'pending',
    dueLabel: 'Due today · 5:30pm',
    assignedRole: 'employee',
    questionCount: 38,
    answers: [],
  },
  {
    id: 'inst-plato-storecheck',
    templateId: 'tpl-plato-storecheck',
    templateName: 'Platō store check sheet',
    site: 'Platō Tokai',
    status: 'pending',
    dueLabel: 'Due this month · by 30 Apr',
    assignedRole: 'manager',
    questionCount: 72,
    answers: [],
  },
];

export const MOCK_HISTORY: ChecklistInstance[] = [
  // Last month's ops audit at Richmond — two No answers, each of which
  // raised a corrective action (seeded in correctiveActionsStore).
  {
    id: 'hist-monthly-ops',
    templateId: 'tpl-monthly-ops',
    templateName: 'Monthly ops audit',
    site: 'Richmond',
    status: 'complete',
    dueLabel: 'Completed 28 Mar · 10:40am',
    assignedRole: 'admin',
    questionCount: 6,
    answers: [
      { questionId: 'qm-1', value: true },
      {
        questionId: 'qm-2',
        value: false,
        correctiveActionDraft: {
          issueSummary: 'March entry missing from the pest control log. Droppings found behind dry-store shelving — contractor visit needed before next audit.',
          assigneeType: 'outlet_manager',
        },
      },
      { questionId: 'qm-3', value: true },
      {
        questionId: 'qm-4',
        value: false,
        correctiveActionDraft: {
          issueSummary: 'First aid kit missing burn dressings; plasters below minimum count.',
          assigneeType: 'outlet_manager',
        },
      },
      { questionId: 'qm-5', value: true },
      { questionId: 'qm-6', value: true },
    ],
    completedAt: '10:40am',
    completedDate: '2026-03-28',
    completedBy: 'Ed Mehta',
  },
  // Last month's brand audit at Richmond — failed on the critical
  //  override (smashed window) despite only three fails. Its actions are
  //  seeded in correctiveActionsStore across all three lifecycle states.
  {
    id: 'hist-brand-audit',
    templateId: 'tpl-brand-audit',
    templateName: 'Brand standards audit',
    site: 'Richmond',
    status: 'complete',
    dueLabel: 'Completed 30 Mar · 9:35am',
    assignedRole: 'admin',
    questionCount: 10,
    answers: [
      {
        questionId: 'qa-1',
        value: false,
        correctiveActionDraft: {
          issueSummary:
            'Left-hand front window smashed overnight — glass swept but pane boarded up. Glazier needed urgently; storefront visibly damaged.',
          assigneeType: 'outlet_manager',
        },
      },
      { questionId: 'qa-2', value: true },
      { questionId: 'qa-3', value: true },
      { questionId: 'qa-4', value: 3.6 },
      { questionId: 'qa-5', value: true },
      { questionId: 'qa-6', value: true },
      {
        questionId: 'qa-7',
        value: false,
        correctiveActionDraft: {
          issueSummary: 'Open sauces and two prepped containers in the walk-in with no date labels.',
          assigneeType: 'outlet_manager',
        },
      },
      {
        questionId: 'qa-8',
        value: false,
        correctiveActionDraft: {
          issueSummary: 'Winter specials still on the main board; two handwritten price corrections.',
          assigneeType: 'outlet_manager',
        },
      },
      { questionId: 'qa-9', value: true },
      { questionId: 'qa-10', value: true },
    ],
    completedAt: '9:35am',
    completedDate: '2026-03-30',
    completedBy: 'Ed Mehta',
    scoreResult: {
      // 10 checks, 3 failed (qa-1 critical, qa-7 medium, qa-8 low).
      // 80% of 10 needs 8 passed — a fail budget of 2, so 3 fails is
      // over budget AND the critical fail fails it outright.
      checksPassed: 7,
      checksTotal: 10,
      pct: 70,
      passThresholdPct: 80,
      criticalFails: 1,
      passed: false,
      sectionScores: [
        { sectionId: 'sec-foh', name: 'Front of house', passed: 2, total: 3 },
        { sectionId: 'sec-food', name: 'Food safety', passed: 3, total: 4 },
        { sectionId: 'sec-brand', name: 'Brand standards', passed: 2, total: 3 },
      ],
      failedQuestionIds: ['qa-1', 'qa-7', 'qa-8'],
    },
  },
  // Yesterday's delivery log — shows the repeating-row table in history.
  {
    id: 'hist-delivery-temps',
    templateId: 'tpl-delivery-temps',
    templateName: 'Daily delivery temperatures',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 3 Apr · 11:20am',
    assignedRole: 'employee',
    questionCount: 1,
    answers: [
      {
        questionId: 'qd1',
        value: null,
        rows: [
          {
            id: 'row-1',
            values: { 'f-supplier': 'Calendar Cheese Co', 'f-product': 'Brie wheels', 'f-condition': true, 'f-temp': 3 },
          },
          {
            id: 'row-2',
            values: { 'f-supplier': 'Bidfood', 'f-product': 'Chicken breast', 'f-condition': true, 'f-temp': 7 },
            followUpNote: 'Above range — rejected at the door, credit requested from Bidfood.',
          },
          {
            id: 'row-3',
            values: { 'f-supplier': 'Fresh Produce Direct', 'f-product': 'Mixed leaves', 'f-condition': false, 'f-temp': 4 },
            followUpNote: 'Two bags crushed in transit — set aside for credit, remainder accepted.',
          },
        ],
      },
    ],
    completedAt: '11:20am',
    completedDate: '2026-04-03',
    completedBy: 'Jordan Beck',
  },
  // Yesterday — 3 Apr
  {
    id: 'hist-1',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 3 Apr · 7:04am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: 4 },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '7:04am',
    completedDate: '2026-04-03',
    completedBy: 'Ed Mehta',
  },
  {
    id: 'hist-2',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 3 Apr · 9:11am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 6 },
      { questionId: 'qt1a', value: 'Moved stock to backup fridge, called tech support. Fridge back to 3°C by 10am.' },
      { questionId: 'qt2', value: 4 },
      { questionId: 'qt3', value: 3 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '9:11am',
    completedDate: '2026-04-03',
    completedBy: 'Jordan Beck',
  },
  {
    id: 'hist-3',
    templateId: 'tpl-3',
    templateName: 'Closing checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 3 Apr · 5:22pm',
    assignedRole: 'manager',
    questionCount: 5,
    answers: [
      { questionId: 'qc1', value: true },
      { questionId: 'qc2', value: true },
      { questionId: 'qc3', value: 842 },
      { questionId: 'qc4', value: true },
      { questionId: 'qc5', value: '' },
    ],
    completedAt: '5:22pm',
    completedDate: '2026-04-03',
    completedBy: 'Cheryl Wong',
  },
  {
    id: 'hist-4',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'South Yarra',
    status: 'complete',
    dueLabel: 'Completed 3 Apr · 7:08am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: false },
      { questionId: 'q1a', value: 'Display fridge door seal broken. Placed a work order, moved cold items to backup unit.' },
      { questionId: 'q2', value: 7 },
      { questionId: 'q2a', value: 'Backup fridge used. Temp normal by 8am. Manager notified.' },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '7:08am',
    completedDate: '2026-04-03',
    completedBy: 'Sam Torres',
  },
  // 2 Apr
  {
    id: 'hist-5',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 2 Apr · 6:58am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: 3 },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '6:58am',
    completedDate: '2026-04-02',
    completedBy: 'Ed Mehta',
  },
  {
    id: 'hist-6',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 2 Apr · 9:03am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 3 },
      { questionId: 'qt2', value: 4 },
      { questionId: 'qt3', value: 3 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '9:03am',
    completedDate: '2026-04-02',
    completedBy: 'Jordan Beck',
  },
  {
    id: 'hist-7',
    templateId: 'tpl-3',
    templateName: 'Closing checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 2 Apr · 5:18pm',
    assignedRole: 'manager',
    questionCount: 5,
    answers: [
      { questionId: 'qc1', value: true },
      { questionId: 'qc2', value: true },
      { questionId: 'qc3', value: 910 },
      { questionId: 'qc4', value: true },
      { questionId: 'qc5', value: 'Customer left phone, returned same day.' },
    ],
    completedAt: '5:18pm',
    completedDate: '2026-04-02',
    completedBy: 'Cheryl Wong',
  },
  {
    id: 'hist-8',
    templateId: 'tpl-2',
    templateName: 'Temperature log — cold chain',
    site: 'Richmond',
    status: 'complete',
    dueLabel: 'Completed 2 Apr · 9:15am',
    assignedRole: 'employee',
    questionCount: 4,
    answers: [
      { questionId: 'qt1', value: 4 },
      { questionId: 'qt2', value: 3 },
      { questionId: 'qt3', value: 2 },
      { questionId: 'qt4', value: true },
    ],
    completedAt: '9:15am',
    completedDate: '2026-04-02',
    completedBy: 'Sam Torres',
  },
  // 1 Apr
  {
    id: 'hist-9',
    templateId: 'tpl-1',
    templateName: 'Opening checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 1 Apr · 7:01am',
    assignedRole: 'employee',
    questionCount: 5,
    answers: [
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: 3 },
      { questionId: 'q3', value: true },
      { questionId: 'q4', value: true },
      { questionId: 'q5', value: '' },
    ],
    completedAt: '7:01am',
    completedDate: '2026-04-01',
    completedBy: 'Jordan Beck',
  },
  {
    id: 'hist-10',
    templateId: 'tpl-3',
    templateName: 'Closing checks',
    site: 'Fitzroy Espresso',
    status: 'complete',
    dueLabel: 'Completed 1 Apr · 5:30pm',
    assignedRole: 'manager',
    questionCount: 5,
    answers: [
      { questionId: 'qc1', value: true },
      { questionId: 'qc2', value: false },
      { questionId: 'qc3', value: 0 },
      { questionId: 'qc4', value: true },
      { questionId: 'qc5', value: 'POS system was down at end of day, cash reconciliation to be completed tomorrow morning.' },
    ],
    completedAt: '5:30pm',
    completedDate: '2026-04-01',
    completedBy: 'Cheryl Wong',
  },
];

export const ALL_COMPLETED_INSTANCES: ChecklistInstance[] = [
  ...MOCK_INSTANCES.filter((i) => i.status === 'complete'),
  ...MOCK_HISTORY,
];

export function getTemplateById(id: string): ChecklistTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === id);
}

export function getInstanceById(id: string): ChecklistInstance | undefined {
  return [...MOCK_INSTANCES, ...MOCK_HISTORY].find((i) => i.id === id);
}

export function getTemplateForInstance(instance: ChecklistInstance): ChecklistTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === instance.templateId);
}

export function getAllHistoryInstances(): ChecklistInstance[] {
  return ALL_COMPLETED_INSTANCES.sort((a, b) => {
    const dateA = a.completedDate ?? '0000-00-00';
    const dateB = b.completedDate ?? '0000-00-00';
    return dateB.localeCompare(dateA);
  });
}

// ---------- Compliance helpers (used by dashboard) ----------

export interface FollowUpWarning {
  instanceId: string;
  templateName: string;
  site: string;
  completedAt?: string;
  completedBy?: string;
  parentQuestion: string;
  parentAnswer: string;
  followUpNote: string;
}

function answerForQuestion(
  instance: ChecklistInstance,
  questionId: string,
): ChecklistInstance['answers'][number] | undefined {
  return instance.answers.find((a) => a.questionId === questionId);
}

function conditionMet(
  condition: FollowUpCondition,
  value: ChecklistInstance['answers'][number]['value'],
): boolean {
  switch (condition.type) {
    case 'checked':   return value === true;
    case 'unchecked': return value === false;
    case 'equals':    return value === condition.value;
    case 'greater_than':
      return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
    case 'less_than':
      return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
    case 'contains':
      return typeof value === 'string' && typeof condition.value === 'string'
        && value.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}

function describeParentAnswer(responseType: ResponseType, value: ChecklistInstance['answers'][number]['value']): string {
  if (responseType === 'temperature' && typeof value === 'number') return `${value}°C`;
  if (responseType === 'number' && typeof value === 'number') return String(value);
  if (responseType === 'checkbox') return value === true ? 'Yes' : 'No';
  return String(value ?? '');
}

export function followUpWarningsForInstance(instance: ChecklistInstance): FollowUpWarning[] {
  if (instance.status !== 'complete') return [];
  const template = getTemplateForInstance(instance);
  if (!template) return [];

  const warnings: FollowUpWarning[] = [];
  for (const question of template.questions) {
    const ans = answerForQuestion(instance, question.id);
    if (!ans) continue;
    for (const rule of question.followUpRules) {
      if (!conditionMet(rule.condition, ans.value)) continue;
      const followUpAns = answerForQuestion(instance, rule.followUpQuestionId);
      warnings.push({
        instanceId: instance.id,
        templateName: instance.templateName,
        site: instance.site,
        completedAt: instance.completedAt,
        completedBy: instance.completedBy,
        parentQuestion: question.name,
        parentAnswer: describeParentAnswer(question.responseType, ans.value),
        followUpNote: typeof followUpAns?.value === 'string' ? followUpAns.value : '',
      });
    }
  }
  return warnings;
}

function phaseHour(phase: BriefingPhase): number {
  switch (phase) {
    case 'morning':   return 9;
    case 'midday':    return 12;
    case 'afternoon': return 15;
    case 'evening':   return 19;
  }
}

function parseDueHour(dueLabel: string): number | null {
  const match = dueLabel.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h;
}

export interface ChecklistComplianceSummary {
  totalToday: number;
  completeToday: number;
  inProgressToday: number;
  overdueToday: number;
  upcomingToday: number;
  completionPct: number;
  warnings: FollowUpWarning[];
  sevenDayPct: number;
  sevenDayTotal: number;
  sevenDayComplete: number;
}

export function getChecklistComplianceSummary(phase: BriefingPhase): ChecklistComplianceSummary {
  const now = phaseHour(phase);

  let completeToday = 0;
  let inProgressToday = 0;
  let overdueToday = 0;
  let upcomingToday = 0;

  for (const inst of MOCK_INSTANCES) {
    if (inst.status === 'complete') {
      completeToday += 1;
    } else if (inst.status === 'in_progress') {
      inProgressToday += 1;
    } else {
      const due = parseDueHour(inst.dueLabel);
      if (due !== null && due <= now) overdueToday += 1;
      else upcomingToday += 1;
    }
  }

  const totalToday = MOCK_INSTANCES.length;
  const completionPct = totalToday > 0 ? Math.round((completeToday / totalToday) * 100) : 0;

  const warnings = MOCK_INSTANCES.flatMap(followUpWarningsForInstance);

  // Seven-day compliance baseline. Fixtures are too thin to derive a believable rate,
  // so we use a realistic demo number that reflects a well-run estate with occasional
  // misses.
  const sevenDayPct = 94;
  const sevenDayTotal = 49;
  const sevenDayComplete = Math.round(sevenDayTotal * (sevenDayPct / 100));

  return {
    totalToday,
    completeToday,
    inProgressToday,
    overdueToday,
    upcomingToday,
    completionPct,
    warnings,
    sevenDayPct,
    sevenDayTotal,
    sevenDayComplete,
  };
}
