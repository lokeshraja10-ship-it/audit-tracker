/* =====================================================================
   i-Audit-Liv  ·  Seed data   (HR = payroll themes · Retail = SBU issue types)
   HR recurring-theme bar charts and deep-dive content reproduced verbatim
   from the HR AI Enabled Dashboard PDF (slide "04 · Recurring & Repetitive
   Themes"). Every yearly[] array below was verified bar-by-bar against the
   PDF image and cross-checked against its stated point-totals and peak years.
   Retail figures as on 1 September 2026.
   ===================================================================== */

window.AUDIT_DATA = {
  meta: { org: "BPCL  ·  Internal Audit", app: "i-Audit-Liv", tagline: "Audit Insight Hub — Internal Audit", updated: "Sep 2026" },

  fyLabels: ["'14-15","'15-16","'16-17","'17-18","'18-19","'19-20","'20-21","'21-22","'22-23","'23-24","'24-25","'25-26"],

  atrDefault: {
    source: "SR Sheet", hasCycle: true,
    total: 539, projects: 94, overdue: 461, high: 11, highOverdue: 10, beyond1: 177,
    oldest: 2284, oldestLabel: "31-May-2020 (Lubes)",
    pri: { High: 11, Medium: 498, Low: 30 },
    buckets: [ { label: "0-90 days", n: 22 }, { label: "90-180 days", n: 138 }, { label: "180-365 days", n: 124 }, { label: "Beyond 1 year", n: 177 } ],
    byEntity: [
      { entity: "Retail", total: 347, H: 1, M: 323, L: 23, avgOD: 372, reduced: 78, added: 23, before2024: 34 },
      { entity: "Lubes", total: 50, H: 0, M: 48, L: 2, avgOD: 512, reduced: 12, added: 4, before2024: 6 },
      { entity: "HRS & CBA", total: 43, H: 7, M: 34, L: 2, avgOD: 454, reduced: 9, added: 3, before2024: 6 },
      { entity: "I&C - Chennai Territory", total: 21, H: 0, M: 19, L: 2, avgOD: 104, reduced: 2, added: 3, before2024: 1 },
      { entity: "BPEC", total: 20, H: 1, M: 19, L: 0, avgOD: 125, reduced: 5, added: 1, before2024: 2 },
      { entity: "I&C - Kochi Territory", total: 16, H: 2, M: 14, L: 0, avgOD: 444, reduced: 3, added: 1, before2024: 3 },
      { entity: "LPG", total: 15, H: 0, M: 14, L: 1, avgOD: 678, reduced: 5, added: 1, before2024: 2 },
      { entity: "Aviation", total: 12, H: 0, M: 12, L: 0, avgOD: 444, reduced: 3, added: 1, before2024: 2 },
      { entity: "Gas", total: 7, H: 0, M: 7, L: 0, avgOD: 318, reduced: 2, added: 0, before2024: 1 },
      { entity: "I&C - Coimbatore Territory", total: 5, H: 0, M: 5, L: 0, avgOD: 318, reduced: 1, added: 0, before2024: 1 },
      { entity: "E&P", total: 2, H: 0, M: 2, L: 0, avgOD: 318, reduced: 1, added: 0, before2024: 0 },
      { entity: "Pipelines", total: 1, H: 0, M: 1, L: 0, avgOD: 318, reduced: 0, added: 0, before2024: 0 }
    ],
    statusMap: { "New": 524, "In Process": 15 },
    concentrationGroups: [ { label: "Retail", overdue: 316, total: 347 }, { label: "Lubes", overdue: 48, total: 50 }, { label: "HRS and CBA", overdue: 43, total: 43 }, { label: "I&C territories", overdue: 27, total: 42 }, { label: "LPG / Gas / Others", overdue: 27, total: 57 } ],
    ageingNarrative: [ "177 points are older than one year; Retail accounts for 127 of them.", "73 points are overdue by more than two years.", "Oldest point dates back to 31-May-2020 (Lubes) — over six years outstanding." ],
    legacyRows: [
      { id:"4611", code:"P&C-Retail-38-2018-19", entity:"Retail", region:"SR", rec:"Review of ARB & In/Out activities and monitoring mechanism.", targetStr:"31-03-2019", days:2711 },
      { id:"4623", code:"P&C-Legal-01-2019-20", entity:"HRS & CBA", region:"HQ", rec:"Trace original sale deeds; lay down trackable storage process.", targetStr:"31-12-2020", days:2070 },
      { id:"4638", code:"BAA-4-2020-21", entity:"Retail", region:"WR", rec:"Recover excess medical eligibility payments; build SAP HR vs FI report.", targetStr:"15-10-2021", days:1782 },
      { id:"4652", code:"P&C-FIN-9-2022-23", entity:"Lubes", region:"HQ", rec:"Analyse & clear open items in travel GLs (Jan-19 to Mar-22).", targetStr:"31-12-2022", days:1340 },
      { id:"4667", code:"PRC-6-2022-23", entity:"Gas", region:"HQ", rec:"Reconcile pipeline transfers to/from OMCs post automation.", targetStr:"31-12-2022", days:1340 },
      { id:"4671", code:"P&C-Retail-28-2022-23", entity:"Retail", region:"SR", rec:"Closing paper — review of FI entries and clear differences.", targetStr:"31-12-2022", days:1340 },
      { id:"4688", code:"PRC-HR-4-2021-22", entity:"HRS & CBA", region:"NR", rec:"Analyse separated-employee loan balances; recover/pay.", targetStr:"30-09-2022", days:1432 },
      { id:"4695", code:"P&C-IC-2-2021-22", entity:"I&C - Kochi Territory", region:"SR", rec:"Vendor registration and PO verification pending closure.", targetStr:"31-03-2022", days:1615 },
      { id:"4702", code:"P&C-LB-3-2022-23", entity:"Lubes", region:"WR", rec:"Physical verification exception list not prepared.", targetStr:"31-12-2022", days:1340 },
      { id:"4718", code:"P&C-Retail-5-2023-24", entity:"Retail", region:"ER", rec:"Guwahati territory — clear long-pending open items.", targetStr:"31-07-2023", days:1128 },
      { id:"4726", code:"P&C-AV-1-2022-23", entity:"Aviation", region:"SR", rec:"Security deposits not obtained; bank guarantees expired.", targetStr:"31-03-2023", days:1250 },
      { id:"4733", code:"P&C-BPEC-5-2022-23", entity:"BPEC", region:"SR", rec:"BPEC transport process — reconcile balances.", targetStr:"31-12-2022", days:1340 }
    ]
  },

  businessUnits: [
    {
      id: "hr", name: "HR", full: "HRS & HRD + CBA", icon: "\uD83D\uDC65", status: "active", type: "hr",
      entities: ["HQ", "WR", "ER", "SR", "NR", "HRD", "CBA"],
      kpis: { tracked: 1404, open: 257, closed: 1147, overdue: 247, highOpen: 22, highTotal: 92, oldestYrs: 7.2, overdueDays: 2623 },
      recurringThemes: {
        note: "How the themes are classified: 'Improving' means the number of points is showing a downward trend over the last 3-4 years, while 'Flat' means a steady annual run-rate with no sustained decline.",
        improving: [
          { title: "Accommodation: transit flats & holiday homes", tag: "\u25BC 36% in FY21-26 · Improving", sub: "134 points across 12 years  ·  peak 31 in FY2017-18", yearly: [14,11,12,31,8,5,6,1,16,20,6,3] },
          { title: "Leave administration: credit, LOP, LFA", tag: "\u25BC Improving · only 10 points since FY2023-24", sub: "68 points across 12 years  ·  peak 23 in FY2022-23", yearly: [1,6,5,17,0,4,2,0,23,1,0,9] },
          { title: "Payroll accuracy: pay fixation & allowances", tag: "\u25BC Improving · trend turning", sub: "175 points across 12 years  ·  peak 32 in FY2023-24", yearly: [11,28,14,11,4,4,12,23,16,32,5,4] },
          { title: "Medical benefits & PRMB", tag: "\u25BC Improving · trend turning", sub: "67 points across 12 years  ·  peak 20 in FY2020-21", yearly: [2,3,2,4,6,0,20,7,9,9,1,4] }
        ],
        flat: [
          { title: "Open items: vendor & customer accounts", tag: "\u25AC Flat · steady annual run-rate", sub: "129 points across 12 years  ·  peak 25 in FY2020-21", yearly: [19,2,11,3,11,7,25,1,7,15,17,7] },
          { title: "Open items: GR/IR, POs & WBS closure", tag: "\u25AC Flat · steady annual run-rate", sub: "115 points across 12 years  ·  peak 17 in FY2020-21", yearly: [7,0,9,14,5,5,17,4,6,16,15,17] }
        ],
        efforts: [
          { title: "Fixed assets: capitalisation, disposal & buyback", tag: "\u25B2 Efforts Required", sub: "118 points across 12 years  ·  peak 27 in FY2025-26", yearly: [11,12,1,11,8,0,6,8,6,10,18,27] },
          { title: "Tendering & procurement compliance", tag: "\u25B2 +70% in FY21-26 · Efforts Required", sub: "101 points across 12 years  ·  peak 18 in FY2025-26", yearly: [8,1,12,7,3,6,14,2,7,16,6,18] },
          { title: "Fixed assets: physical verification & tagging", tag: "\u25B2 Efforts Required", sub: "67 points across 12 years  ·  peak 14 in FY2025-26", yearly: [9,4,1,11,3,0,2,0,6,9,8,14] },
          { title: "CSR governance, MIS & utilisation", tag: "\u25B2 +180% in FY21-26 · Efforts Required", sub: "57 points across 12 years  ·  peak 32 in FY2025-26", yearly: [0,0,0,0,0,0,10,4,1,2,8,32] }
        ],
        takeaway: "Four themes still need concerted effort. CSR governance barely registered before FY2020-21; CSR alone contributed 32 points in FY2025-26, the single largest year of any theme. Fixed assets carry 185 points across capitalisation and physical verification, and tendering is up 70% in the second half of the period."
      },
      repetitiveObs: {
        intro: "The themes raised most often are not always the themes carrying the greatest risk. Ranking the same twelve-year population by high-priority points, and by what is still open, changes the priority order materially.",
        rows: [
          { theme: "Reconciliation: SAP HR vs FI", raised: 54, high: 18, open: 7, openHigh: 3, deepId: "recon" },
          { theme: "Payroll accuracy: pay fixation & allowances", raised: 175, high: 17, open: 17, openHigh: 2 },
          { theme: "Open items: vendor & customer accounts", raised: 129, high: 16, open: 23, openHigh: 1, deepId: "open" },
          { theme: "Leave administration: credit, LOP, LFA", raised: 68, high: 8, open: 2, openHigh: 0 },
          { theme: "Accommodation: transit flats & holiday homes", raised: 134, high: 7, open: 25, openHigh: 5 },
          { theme: "Medical benefits & PRMB", raised: 67, high: 7, open: 2, openHigh: 0, deepId: "medical" },
          { theme: "Tendering & procurement compliance", raised: 101, high: 6, open: 20, openHigh: 0, deepId: "tendering" },
          { theme: "Open items: GR/IR, POs & WBS closure", raised: 115, high: 5, open: 28, openHigh: 1, deepId: "open" },
          { theme: "CSR governance, MIS & utilisation", raised: 57, high: 5, open: 30, openHigh: 3, deepId: "fa" },
          { theme: "Fixed assets: physical verification & tagging", raised: 67, high: 3, open: 13, openHigh: 1, deepId: "fa" }
        ],
        total: { theme: "Total — ten priority themes", raised: 967, high: 92, open: 167, openHigh: 16 },
        takeaway: "Three themes carry the bulk of the high-priority risk. Reconciliation between SAP HR and FI is the heaviest — 18 high-priority from just 54 points raised. Payroll accuracy follows with 17 high-priority and 17 still open from 175 points, and open items on vendor & customer accounts add 16 high-priority with 23 still open."
      },
      deepDives: [
        {
          id: "recon", title: "Reconciliation: SAP HR vs FI",
          sub: "It is also the smallest theme to carry 18 high-priority points, making it the deck's clearest concentration of risk.",
          stats: [ {v:"54", l:"points raised over 12 plan years"}, {v:"18", l:"rated high priority"}, {v:"25", l:"raised in FY2020-21 alone"} ],
          yearly: [2,1,3,2,4,25,5,4,3,2,2,1],
          observations: [ {label:"Loan balance mismatches, SAP HR vs FI", n:8}, {label:"Loan balance and interest recovery", n:6}, {label:"Recovery towards buyback of assets", n:6}, {label:"Medical advance outstanding differs", n:4}, {label:"Advances vs expenses booked", n:3}, {label:"Retention money", n:3} ],
          issueLabel: "The real issue",
          issueText: "Although the number of points is coming down, the real difficulty lies with the old items pertaining to the period before June 2021, for which no formal document exists for fixing responsibility."
        },
        {
          id: "medical", title: "Medical Benefits & PRMB",
          sub: "The theme barely registered before FY2020-21, when 20 points were raised in a single year, and it has held a steady run-rate since.",
          stats: [ {v:"67", l:"points raised over 12 plan years"}, {v:"7", l:"rated high priority"}, {v:"20", l:"raised in FY2020-21 alone"} ],
          yearly: [2,3,2,4,6,0,20,7,9,9,1,4],
          observations: [ {label:"Retired-employee medical eligibility limit wrong"}, {label:"Medical advance balances differ, SAP HR vs FI"}, {label:"Advance settled in HR but still pending in FI"}, {label:"Duplicate advance requests, two payment routes"}, {label:"Special GL balance in medical advance \u201C2\u201D open items not cleared"}, {label:"PRMB audit deferred, now in the FY2026-27 plan"} ],
          issueLabel: "What is being observed",
          issueText: "Base medical eligibility limit appearing incorrectly for retired employees  \u2022  Medical advance balances differing for 104 employees \u2014 Rs 1.22 crore in FI against Rs 0.24 crore in HR  \u2022  Rs 1.32 crore across 67 employees settled in HR but still pending in FI, 21 cases beyond 30 days  \u2022  Duplicate advance requests raised through both the normal and one-time vendor routes  \u2022  Open items under Special GL \u201C2\u201D of Rs 3.85 crore across 248 employees"
        },
        {
          id: "open", title: "Open Items: GR/IR, POs, WBS and Vendor Accounts",
          sub: "Taken together the two open-item themes account for 244 points \u2014 17% of everything ever raised \u2014 and 51 that are still open. Both hold a steady annual run-rate rather than escalating, and both have the same root cause.",
          stats: [ {v:"244", l:"points across both themes"}, {v:"51", l:"still open today"}, {v:"42", l:"raised in FY2020-21"}, {v:"+58%", l:"FY21-26 vs FY15-20"} ],
          yearly: [26,2,20,17,16,12,42,5,13,31,32,24],
          observations: [ {label:"Open items in travel GLs", n:8}, {label:"Open purchase orders", n:7}, {label:"Vendor registration", n:6}, {label:"Purchase order verification", n:5}, {label:"PO related observations", n:5}, {label:"Security deposit and vendor open items", n:4} ],
          issueLabel: "The real issue",
          issueText: "Balances accumulate quietly between audits, an audit finds and the same gets cleared, and accumulation restarts. Very old items \u2014 such as the long-pending Balmer Lawrie balances \u2014 are still lying open and need to be cleared on priority. That is why the theme stays flat rather than closing \u2014 FY2023-24 to FY2025-26 alone produced 87 points."
        },
        {
          id: "fa", title: "Fixed Assets: Capitalisation, Verification and CSR",
          sub: "Fixed assets carry 185 points across two themes and 50 still open. Both fixed-asset themes are flat rather than rising. CSR is the newer and sharper problem: 32 of its 57 points were raised in FY2025-26 alone, and 30 are still open.",
          stats: [ {v:"185", l:"fixed-asset points"}, {v:"50", l:"fixed-asset points open"}, {v:"73", l:"fixed assets + CSR, FY2025-26"}, {v:"32", l:"CSR points in FY2025-26"} ],
          yearly: [20,16,2,22,11,0,18,12,13,21,34,73],
          observations: [ {label:"Procurement & capitalisation observations", n:9}, {label:"Assets related observations", n:8}, {label:"CSR project MIS & website compliance", n:8}, {label:"Physical verification by HRS South", n:6}, {label:"Physical verification of assets by audit", n:5}, {label:"Discrepancies in ZASSETMASTER", n:5} ],
          issueLabel: "The real issue",
          issueText: "There are two issues here. The first relates to master data for fixed assets, where asset records drift because details are entered without validation. The second relates to CSR, where governance and monitoring are still being strengthened."
        },
        {
          id: "tendering", title: "Tendering & Procurement Compliance",
          sub: "Thirty-seven points in FY15-20 became 63 in FY21-26 \u2014 a 70% rise, the sharpest among the efforts-required themes. The concern here is trend and process integrity rather than immediate exposure.",
          stats: [ {v:"101", l:"points raised over 12 plan years"}, {v:"6", l:"rated high priority"}, {v:"18", l:"raised in FY2025-26 alone"} ],
          yearly: [8,1,12,7,3,6,14,2,7,16,6,18],
          observations: [ {label:"Single or limited tender where open tendering applied"}, {label:"Work commenced or orders placed before sanction"}, {label:"Evaluation and comparatives not documented"}, {label:"No agreed LD or performance guarantee terms"}, {label:"Orders on unregistered or incomplete vendor records"}, {label:"Security deposits not obtained, bank guarantees expired"} ],
          issueLabel: "What is being observed",
          issueText: "Deviation from the laid-down process is the stated root cause  \u2022  Approval and sanction obtained after the event, or beyond delegated authority  \u2022  Technical and commercial evaluation not documented and comparatives not prepared  \u2022  Rate reasonableness not benchmarked on negotiated awards  \u2022  Post-award compliance gaps in security deposit, retention and bank guarantee expiry"
        }
      ],
      rootCauseThemes: [
        { title: "Legacy items with no owner/policy", desc: "Pre-2021 loan, vendor & FI open items lack a documented responsibility-fixation policy \u2014 41 items >3 yrs remain unactioned." },
        { title: "SAP FI-HR reconciliation gaps", desc: "Loan, medical-advance & ZLOAN balances mismatch across HR and FI modules; manual correction never prioritised." },
        { title: "Asset PV vs master mismatch", desc: "Physical-verification exception lists (transit flats / holiday homes) repeat every cycle without corrective closure." },
        { title: "Open POs / WBSE / CRFQ in SAP", desc: "Completed jobs not closed in system; recurring across every CapexRevex audit and regions." }
      ],
      regionStats: {
        avgDaysOverdue: [ {region:"HRS - HQ", days:546}, {region:"HRS - WR", days:748}, {region:"HRS - ER", days:369}, {region:"HRS - SR", days:362}, {region:"HRD", days:343}, {region:"HRS - NR", days:522}, {region:"CBA", days:903} ],
        openByRegion: [ {region:"HQ", open:80, before2024:22}, {region:"WR", open:57, before2024:12}, {region:"ER", open:47, before2024:8}, {region:"SR", open:44, before2024:9}, {region:"HRD", open:20, before2024:2}, {region:"NR", open:5, before2024:1}, {region:"CBA", open:4, before2024:1} ],
        openTakeaway: "HQ and WR hold 137 of the 257 open points (53%).",
        heatMap: { ages: ["0-6 m","6-12 m","1-2 yr","2-3 yr",">3 yr","Not yet due"], rows: [ {pri:"High", vals:[3,3,0,1,13,2]}, {pri:"Medium", vals:[95,19,19,40,29,8]}, {pri:"Low", vals:[3,4,7,6,5,0]} ], bands: [ {name:"Critical", n:43}, {name:"High", n:62}, {name:"Medium", n:40}, {name:"Low", n:112} ], note: "Critical. High-priority points overdue by more than one year, and Medium-priority points overdue beyond three years. High. High-priority points 6-12 months overdue, and Medium-priority points 1-3 years overdue. Medium. High-priority points up to 6 months overdue, Medium-priority 6-12 months overdue, and Low-priority points beyond one year. Low. Points not yet due, or within six months of target date at Medium or Low priority." }
      },
      auditInputs: {
        intro: "Applying the lesson from the two improving themes: each chronic theme is matched to the systemic control that would remove it, rather than the periodic clean-up that currently contains it.",
        rows: [
          { theme:"Open items: vendor & GR/IR", raisedOpen:"244 raised / 51 open", why:"No ageing-based standing control", enable:"CAR scripts can be shared on a periodic basis by Audit for actions." },
          { theme:"Fixed assets: capitalisation", raisedOpen:"118 raised / 37 open", why:"Master data entered without validation", enable:"Automation at the stage of creation of asset can be implemented which was recently adopted by Retail BU" },
          { theme:"Fixed assets: verification", raisedOpen:"67 raised / 13 open", why:"Verification treated as an annual event", enable:"QR based asset verification facility can be explored especially for high value artifacts, paintings, machines etc. Verification can be staggered over 2 years period rather than concentrating everything at once." },
          { theme:"CSR governance & MIS", raisedOpen:"57 raised / 30 open", why:"Governance are in the process of strengthening", enable:"Project MIS, budget consistency and website disclosure checklist" },
          { theme:"Tendering & procurement", raisedOpen:"101 raised / 20 open", why:"Deviation from laid-down tending process", enable:"Standard pre-award checklist may be embedded in the tender workflow" }
        ]
      },
      criticalAtrs: [
        { code: "BAA-4-2020-21", rec: "Base medical eligibility limit for Retired employee appearing incorrectly. Analyze reasons for such variation. Also recover excess payments if any. Take up with ERPCC for developing medical advance outstanding report as per SAP HR and SAP Finance.", region: "WR", age: "5.2y", pri: "H" },
        { code: "PRC-HR-4-2021-22", rec: "Ensure to analyse separated employee balances and take necessary action for payment/ recover.", region: "3 regions", age: "3.8y", pri: "H" },
        { code: "P&C-FIN-9-2022-23", rec: "Analyze the open items in various travel GLs from Jan2019 till Mar2022 and take action to clear the same.", region: "HQ", age: "3.1y", pri: "H" },
        { code: "PRC-4-2022-23", rec: "Arrange to uniformly update real estate masters for company quarters. Ensure to mandate the requirement to update mailing address.", region: "HQ", age: "3y", pri: "H" },
        { code: "P&C-HRS-8-2023-24", rec: "Employee has left but still showing balance in Housing Loan - Analyze the reported case and ensure to clear the same.", region: "NR", age: "2.4y", pri: "H" },
        { code: "PRC-Legal-01-2019-20", rec: "Trace the original sale deed where they are either currently missing or only scanned/copies are available.", region: "HQ", age: "5.6y", pri: "H" },
        { code: "P&C-HR-7-2025-26", rec: "Ensure physical verification of assets is carried out and an exception list prepared; take suitable action for 1,635 missing assets with book value of Rs. 44.70 lakh.", region: "SR", age: "Due Jan-26", pri: "H" },
        { code: "P&C-HR-6-2025-26", rec: "Establish an approved end-to-end CSR process note; develop a system-based CSR project management application; ensure withdrawals from the Unspent CSR Account are based on actual expenditure.", region: "HQ", age: "Due Mar-26", pri: "H" }
      ]
    },

    {
      id: "retail", name: "Retail", full: "Retail SBU", icon: "\u26FD", status: "active", type: "sbu",
      asOn: "1 September 2026",
      entities: ["WR", "SR", "NR", "ER", "HQ"],
      kpis: { pending: 1159, overdue: 1052, overduePct: 91, regions: 5, audits: 147, submitted: 67, closed: 456, highPri: 35, highOverdue: 33, medium: 1057, low: 67 },
      issueTrendLabels: ["\u226422-23","23-24","24-25","25-26","26-27"],
      issueTypes: [
        { name: "Deviation from Internal Guidelines", open: 193, pct: 16.7, H: 0, M: 177, L: 16, trend: [4,2,7,77,103], spread: {NR:22,WR:74,SR:37,ER:23,HQ:37}, top: "Leased sites WR (44) · IBROMA+ Integration (15) · Hisar (15) · Chennai (12) · Shillong (10)" },
        { name: "Fixed Assets", open: 179, pct: 15.4, H: 0, M: 168, L: 11, trend: [8,9,19,106,37], spread: {NR:31,WR:51,SR:72,ER:24,HQ:1}, top: "Chennai (13) · Gorakhpur (10) · Bhubaneshwar (8) · Ahmedabad (7) · Lubes RO channel (1)" },
        { name: "Others", open: 163, pct: 14.1, H: 11, M: 133, L: 19, trend: [27,28,36,37,35], spread: {NR:22,WR:48,SR:12,ER:34,HQ:47}, top: "Shillong (16) · Real Estate & Rentals (16) · Mumbai (13) · ARB Review (8) · Madurai (5)" },
        { name: "Sales", open: 144, pct: 12.4, H: 2, M: 139, L: 3, trend: [2,8,13,85,36], spread: {NR:30,WR:34,SR:38,ER:20,HQ:22}, top: "Bhubaneshwar (15) · EV Charging (13) · Gorakhpur (10) · Bhopal (9) · Mysore (9)" },
        { name: "PR to Pay Cycle", open: 124, pct: 10.7, H: 3, M: 117, L: 4, trend: [8,3,10,61,42], spread: {NR:15,WR:49,SR:37,ER:20,HQ:3}, top: "Chennai (15) · Goa (9) · Barauni (6) · Gorakhpur (3) · NRL RO Assets (3)" },
        { name: "Financial Accounting & MIS", open: 123, pct: 10.6, H: 2, M: 118, L: 3, trend: [4,10,17,28,64], spread: {NR:38,WR:36,SR:30,ER:8,HQ:11}, top: "Closing Paper (27) · Leased sites WR (17) · Transport (7) · EV Charging (4) · Ranchi (3)" },
        { name: "Operations", open: 83, pct: 7.2, H: 6, M: 68, L: 9, trend: [4,0,13,22,44], spread: {NR:8,WR:18,SR:41,ER:1,HQ:15}, top: "Chennai (18) · EV Charging (8) · Mumbai (6) · Kanpur (3) · BPEC Transport (1)" },
        { name: "COCO Visit", open: 71, pct: 6.1, H: 0, M: 71, L: 0, trend: [1,3,4,28,35], spread: {NR:8,WR:18,SR:39,ER:6,HQ:0}, top: "Hyderabad (13) · Rajkot (5) · Gorakhpur (3) · Bhubaneshwar (2)" },
        { name: "Credit Management", open: 27, pct: 2.3, H: 0, M: 25, L: 2, trend: [0,0,3,15,9], spread: {NR:1,WR:14,SR:10,ER:2,HQ:0}, top: "ARB Review (5) · Chennai (3) · Hisar (1) · Muzaffarpur (1)" },
        { name: "Stock Accounting & Inventory", open: 23, pct: 2.0, H: 3, M: 20, L: 0, trend: [1,0,1,13,8], spread: {NR:2,WR:8,SR:8,ER:1,HQ:4}, top: "Manmad (3) · Mumbai Surprise (3) · Mysore (2) · Jaipur (1) · Receipt Terminal NRL (1)" }
      ],
      issuesTakeaway: "1,130 of all 1,159 pending Retail ATRs (97%) fall in these top 10 issue types. Deviation from internal guidelines (193) is the largest, ahead of Fixed Assets (179). West is the busiest region across the top 10 with 350 pending ATRs.",
      history: {
        labels: ["20-21","21-22","22-23","23-24","24-25","25-26"],
        audits: [46,50,56,46,52,50], auditsNote: "300 audits across six plan years",
        soWhat: "Observations nearly tripled since 2020-21 as audit coverage widened — rising counts alone are not evidence of weaker control.",
        types: [
          { name: "Guideline Deviation", pct: 13.1, chg: "\u25B2 7.4\u00D7 vs 2020-21", yearly: [63,94,82,87,223,469] },
          { name: "PR to Pay Cycle", pct: 12.9, chg: "\u25B2 2.9\u00D7", yearly: [116,153,110,133,160,334] },
          { name: "Operations", pct: 12.0, chg: "\u25B2 4.5\u00D7", yearly: [59,128,96,210,178,266] },
          { name: "Fixed Assets", pct: 11.5, chg: "\u25B2 4.1\u00D7", yearly: [65,123,124,102,215,267] },
          { name: "Sales", pct: 9.9, chg: "\u25B2 4.6\u00D7", yearly: [66,96,72,110,123,302] },
          { name: "Fin. Acct & MIS", pct: 6.9, chg: "\u25B2 2.7\u00D7", yearly: [59,21,84,111,107,159] },
          { name: "COCO Visit", pct: 6.2, chg: "\u25B2 5.4\u00D7", yearly: [36,45,61,65,77,196] },
          { name: "Credit Mgmt", pct: 2.3, chg: "\u25B2 3.6\u00D7", yearly: [12,41,27,25,33,43] },
          { name: "Stock & Inventory", pct: 2.3, chg: "\u25B2 2.6\u00D7", yearly: [25,23,17,19,28,66] },
          { name: "Others", pct: 20.8, chg: "\u25BC -54%", yearly: [276,387,451,205,177,126] }
        ]
      },
      regions: {
        pending: [ {region:"Retail WR", n:355}, {region:"Retail SR", n:333}, {region:"Retail NR", n:178}, {region:"Retail HQ", n:150}, {region:"Retail ER", n:143} ],
        targetFY: [ {fy:"FY18-19",n:1}, {fy:"FY19-20",n:1}, {fy:"FY20-21",n:15}, {fy:"FY21-22",n:2}, {fy:"FY22-23",n:44}, {fy:"FY23-24",n:64}, {fy:"FY24-25",n:128}, {fy:"FY25-26",n:478}, {fy:"FY26-27",n:426} ],
        takeaway: "West leads the backlog with 355 pending ATRs, followed by South (333). 91% of all pending items are overdue, and the target-date profile is heavily loaded on FY25-26 (478) and FY26-27 (426).",
        topTitles: [
          { region: "Retail WR", total: 355, titles: [["Leased sites WR",67],["Mumbai Retail Territory WR",43],["Rajkot Retail Territory WR",26],["Hazira/Surat Retail Territory WR",26],["Indore Retail Territory WR",24]] },
          { region: "Retail SR", total: 333, titles: [["Chennai Retail Territory SR",78],["Mysore Retail Territory SR",25],["Warangal Retail Territory SR",24],["Madurai Retail Territory SR",23],["Bangalore Retail Territory SR",23]] },
          { region: "Retail NR", total: 178, titles: [["Hisar Retail Territory NR",34],["Gorakhpur Retail Territory NR",28],["Closing Paper Review all Regional SBU/Es",27],["Meerut Retail Territory NR",13],["Jaipur Retail Territory NR",11]] },
          { region: "Retail ER", total: 143, titles: [["Bhubaneshwar Retail Territory ER",32],["Shillong Retail Territory",31],["Bokaro Retail Territory ER",17],["Barauni Retail Territory ER",16],["Guwahati Retail Territory ER",13]] },
          { region: "Retail HQ", total: 150, titles: [["Review of EV Charging Services",38],["Real Estate Master and Rental Payments",16],["IBROMA+ Integration with MetaHos / vendor system",16],["Bidding Fee & New RO Dealership Award",15],["Verification of Title Deeds for Own Land",11]] }
        ]
      },
      escalation: {
        summary: { overdue: 33, of: 35, over1yr: 21, longest: 2711, inHQ: 21 },
        note: "33 of 35 high-priority ATRs are past their target date — 21 overdue by over a year, and 21 sit with Retail HQ.",
        rows: [
          { region:"WR", title:"Review of ARB and In & Out activities and monitoring mechanism", code:"P&C-Retail-38-2018-19", atrs:1, target:"31 Mar 2019", days:2711 },
          { region:"ER", title:"Sambalpur Retail Territory ER", code:"P&C-Retail-6-2019-20", atrs:1, target:"31 Mar 2020", days:2345 },
          { region:"HQ", title:"Verification of Title Deeds for Own Land", code:"PRC-Legal-01-2019-20", atrs:5, target:"31 Dec 2020", days:2070 },
          { region:"SR", title:"Mysore Retail Territory SR", code:"P&C-Retail-8-2021-22", atrs:1, target:"30 Sep 2022", days:1432 },
          { region:"HQ", title:"Closing paper including Review of FI Entries", code:"P&C-Retail-28-2022-23", atrs:1, target:"31 Dec 2022", days:1340 },
          { region:"HQ", title:"Pipeline transfers to and from OMCs post automation", code:"PRC-6-2022-23", atrs:2, target:"31 Dec 2022", days:1340 },
          { region:"HQ", title:"Migration of LPG Bulk business to I&C SBU and Lubes RO", code:"P&C-Migration-1-2022-23", atrs:1, target:"30 Apr 2023", days:1220 },
          { region:"HQ", title:"Verification of Title deeds of Own Land — Legal, HQ", code:"P&C-Legal-1-2024-25", atrs:2, target:"31 Jul 2024", days:762 },
          { region:"WR", title:"BPEC Transport Process", code:"P&C-BPEC-5-2024-25", atrs:3, target:"31 Oct 2024", days:670 },
          { region:"ER", title:"BPEC Transport Process", code:"P&C-BPEC-5-2024-25", atrs:1, target:"31 Oct 2024", days:670 },
          { region:"NR", title:"BPEC Transport Process", code:"P&C-BPEC-5-2024-25", atrs:1, target:"31 Oct 2024", days:670 },
          { region:"ER", title:"Guwahati Retail Territory ER", code:"P&C-Retail-5-2024-25", atrs:2, target:"31 Oct 2024", days:670 }
        ]
      },
      systemControls: {
        intro: "Eight Retail SBU control gaps and five enterprise-wide gaps raised by Internal Audit — all converted into system checks now built and live.",
        retail: [
          { gap:"Lorry inspection time recorded after gate-out", impact:"Mandatory 10% surprise inspection not demonstrably performed", ctrl:"System blocks inspection time later than gate-out time for filled lorries" },
          { gap:"ZCOCO tank closing bypassed automation data", impact:"Manual stock figures used without exception approval; book stock unreliable", ctrl:"ZCOCO restricts manual closing / dip entry unless approved by the finance role holder" },
          { gap:"Duplicate Bank Deposit Slips in COCO accounts", impact:"\u20B9228.6 lakh duplicated; reversals delayed beyond 90 days", ctrl:"ERPCC report flags suspected duplicate BDS weekly; duplicates reversed immediately" },
          { gap:"No credit-limit correction on EDFS de-boarding", impact:"De-boarded dealers retained one-load ICICI EDFS credit against policy", ctrl:"Customer master checks limits at de-boarding; alerts sent to Regional Finance" },
          { gap:"EDFS de-boarding allowed despite overdue balances", impact:"Dealers exited EDFS with dues outstanding to BPCL and ICICI", ctrl:"Customer master verifies customer and ICICI dues before de-boarding" },
          { gap:"Credit limits keyed in wrong denomination", impact:"Lakh vs rupee confusion produced incorrect sanctioned limits", ctrl:"Minimum threshold enforced on the recommended credit limit at onboarding" },
          { gap:"VTS master requests visible to all Location In-Charges", impact:"Cross-location approvals possible; NRO masters missing in VTS", ctrl:"Requests mapped to the right Depot In-Charge; interlock blocks sales without VTS master" },
          { gap:"OC loss booked without reason capture", impact:"OC loss (operation loss from causes other than temperature variation) — root cause untraceable", ctrl:"Reason for OC loss must be captured at the time of booking" }
        ],
        enterprise: [
          { gap:"Credit notes posted ahead of billing documents", impact:"Incorrect credit allocation and a broken accounting sequence", ctrl:"Credit note posting blocked until the related billing document is released" },
          { gap:"Physical verification date allowed before capitalisation", impact:"Asset verification records carried impossible dates", ctrl:"System restricts PV date earlier than the capitalisation date" },
          { gap:"GR posting date earlier than PO creation date", impact:"Goods receipts recorded before the PO existed, distorting the audit trail", ctrl:"GR posting date must be on or after the PO creation date" },
          { gap:"Assets capitalised in blocked plant codes", impact:"\u20B917.25 crore capitalised against blocked plant codes", ctrl:"Asset master creation blocked for plant codes that are blocked in the system" },
          { gap:"GeM tenders not identifiable in SAP", impact:"PR reason code 25 often missed, causing GeM-to-SAP mismatch", ctrl:"GeM transactions identified at RFQ/OLA and PO level; details updated on the GeM portal" }
        ]
      }
    },

    { id: "lpg",      name: "LPG",      full: "LPG SBU",           icon: "\uD83D\uDD25", status: "coming" },
    { id: "aviation", name: "Aviation", full: "Aviation SBU",      icon: "\u2708\uFE0F", status: "coming" },
    { id: "lubes",    name: "Lubes",    full: "Lubricants SBU",    icon: "\uD83D\uDEE2\uFE0F", status: "coming" },
    { id: "gas",      name: "Gas",      full: "Gas SBU",           icon: "\uD83D\uDCA8", status: "coming" },
    { id: "ic",       name: "I&C",      full: "Industrial & Commercial", icon: "\uD83C\uDFED", status: "coming" }
  ]
};
