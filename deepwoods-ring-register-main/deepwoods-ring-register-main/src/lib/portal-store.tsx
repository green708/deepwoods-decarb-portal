import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AccountStatus = "draft" | "pending" | "accepted";
export type TeamRole = "accountAdmin" | "dataContributor" | "viewer";

export type TeamMember = { id: string; fullName: string; email: string; role: TeamRole };
export type Facility = { id: string; name: string; location: string; locked?: boolean };
export type Invoice = {
  id: string;
  period: string;
  amount: string;
  status: "paid" | "due";
  datePaid: string | null;
};

export type CompanyDetails = {
  registeredInIndia: boolean;
  gstin: string;
  legalName: string;
  operatingName: string;
  industry: string;
  orgType: string;
  msme: boolean;
  udyam: string;
  legalAddress: string;
  website: string;
  logoName: string;
};

export type Account = {
  id: string;
  companyName: string;
  status: AccountStatus;
  createdDate: string;
  lastEditDate: string;
  updatedBy: string;
  orgType: string;
  industry: string;
  plan: string;
  companyDetails: CompanyDetails;
  facilities: Facility[];
  team: TeamMember[];
  invoices: Invoice[];
  emissions: { scope1: number; scope2: number; scope3: number };
};

export const ROLE_LABEL: Record<TeamRole, string> = {
  accountAdmin: "Account Admin",
  dataContributor: "Data Contributor",
  viewer: "Viewer",
};

export const INDUSTRIES = [
  "Manufacturing",
  "Textiles & Apparel",
  "Chemicals",
  "Food & Beverage",
  "IT/Technology",
  "Financial Services",
  "Real Estate & Construction",
  "Logistics & Transportation",
  "Furniture manufacturing",
  "Other",
];

export const ORG_TYPES = [
  "Private Limited",
  "Public Limited",
  "LLP",
  "Partnership",
  "Sole Proprietorship",
  "Other",
];

export const emptyCompanyDetails = (): CompanyDetails => ({
  registeredInIndia: true,
  gstin: "",
  legalName: "",
  operatingName: "",
  industry: "",
  orgType: "",
  msme: false,
  udyam: "",
  legalAddress: "",
  website: "",
  logoName: "",
});

const uid = () => Math.random().toString(36).slice(2, 10);

export const todayStamp = () =>
  new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const HEJJALA =
  "Survey No. 83 & 88/1, Bengaluru-Mysuru Road, Hejjala Post, Bidadi Hobli, Ramanagaram Taluk, Bengaluru 562109, Karnataka, India";

const seedAccounts = (): Account[] => [
  {
    id: "fos",
    companyName: "Featherlite Office Systems Pvt Ltd",
    status: "accepted",
    createdDate: "02 Feb 2026",
    lastEditDate: "18 Mar 2026",
    updatedBy: "Featherlite Furnitures",
    orgType: "Private Limited",
    industry: "Furniture manufacturing",
    plan: "Deepwoods GHG Portal — Annual Access",
    companyDetails: {
      registeredInIndia: true,
      gstin: "29AABCF1234M1ZQ",
      legalName: "Featherlite Office Systems Pvt Ltd",
      operatingName: "Featherlite Office Systems",
      industry: "Furniture manufacturing",
      orgType: "Private Limited",
      msme: false,
      udyam: "",
      legalAddress: HEJJALA,
      website: "https://www.featherlitefurniture.com",
      logoName: "",
    },
    facilities: [
      { id: "f1", name: "Head Office", location: HEJJALA, locked: true },
      {
        id: "f2",
        name: "Vasanth Nagar",
        location:
          "No. 16A, KKMP Building, Millers Rd, Kaverappa Layout, Vasanth Nagar, Bengaluru, Karnataka 560052, India",
      },
      {
        id: "f3",
        name: "Ramohalli",
        location:
          "Unit II, Survey No. 28, Plot No. 9A, Chikkeluru Ramapura Village, Tavarekere Hobli, Bangalore South, Bangalore 562130, India",
      },
      {
        id: "f4",
        name: "Sriperumbudur",
        location:
          "No. K-11/1 Phase-2, Sipcot Industrial Area, Mambakkam Post, Sriperumbudur Taluk, Kancheepuram District, Tamil Nadu 602106, India",
      },
      {
        id: "f5",
        name: "Kumbalgudu",
        location:
          "Unit IV, #21F, Kumbalgudu Industrial Area, 2nd Phase Mysore Road Bengaluru 560074, India",
      },
    ],
    team: [
      {
        id: "t1",
        fullName: "Account Admin (placeholder)",
        email: "admin@featherlite.example",
        role: "accountAdmin",
      },
    ],
    invoices: [
      {
        id: "INV-FOS-FY26-001",
        period: "FY26",
        amount: "₹75,000",
        status: "paid",
        datePaid: "15 Apr 2026",
      },
      {
        id: "INV-FOS-FY27-001",
        period: "FY27",
        amount: "₹75,000",
        status: "due",
        datePaid: null,
      },
    ],
    emissions: { scope1: 1840, scope2: 3120, scope3: 9460 },
  },
];

type Ctx = {
  loggedIn: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
  accounts: Account[];
  getAccount: (id: string) => Account | undefined;
  addAccount: (a: Omit<Account, "id" | "createdDate" | "lastEditDate" | "updatedBy">) => string;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  approveLatest: () => void;
  payInvoice: (accountId: string, invoiceId: string) => void;
  fiscalYear: string;
  setFiscalYear: (fy: string) => void;
};

const PortalContext = createContext<Ctx | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>(seedAccounts);
  const [fiscalYear, setFiscalYear] = useState("FY25");

  const value = useMemo<Ctx>(
    () => ({
      loggedIn,
      fiscalYear,
      setFiscalYear,
      login: (user, pass) => {
        const ok = user.trim() === "Featherlite Furnitures" && pass === "123";
        if (ok) setLoggedIn(true);
        return ok;
      },
      logout: () => setLoggedIn(false),
      accounts,
      getAccount: (id) => accounts.find((a) => a.id === id),
      addAccount: (a) => {
        const id = uid();
        setAccounts((prev) => [
          ...prev,
          {
            ...a,
            id,
            createdDate: todayStamp(),
            lastEditDate: todayStamp(),
            updatedBy: "Featherlite Furnitures",
          },
        ]);
        return id;
      },
      updateAccount: (id, patch) =>
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...patch, lastEditDate: todayStamp() } : a)),
        ),
      approveLatest: () =>
        setAccounts((prev) => {
          const idx = [...prev].reverse().findIndex((a) => a.status === "pending");
          if (idx === -1) return prev;
          const realIdx = prev.length - 1 - idx;
          return prev.map((a, i) => (i === realIdx ? { ...a, status: "accepted" as const } : a));
        }),
      payInvoice: (accountId, invoiceId) =>
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  invoices: a.invoices.map((inv) =>
                    inv.id === invoiceId
                      ? { ...inv, status: "paid" as const, datePaid: todayStamp() }
                      : inv,
                  ),
                }
              : a,
          ),
        ),
    }),
    [loggedIn, accounts, fiscalYear],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
