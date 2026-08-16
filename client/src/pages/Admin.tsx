import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Globe,
  Inbox,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BookingRow = RouterOutputs["adminBookings"]["list"][number];
type BookingStatus = BookingRow["status"];
type LedgerRow = RouterOutputs["adminLedger"]["list"][number];
type InvoiceRow = RouterOutputs["adminInvoices"]["list"][number];

// ─────────────────────────── i18n ───────────────────────────
type Lang = "ar" | "en";

const T = {
  ar: {
    dir: "rtl" as const,
    panel: "لوحة التحكم",
    hi: "أهلاً",
    logout: "خروج",
    bookings: "الحجوزات",
    finance: "الحسابات",
    invoices: "الفواتير",
    navBookings: "الحجوزات",
    navFinance: "الحسابات",
    navInvoices: "الفواتير",
    password: "كلمة السر",
    login: "دخول",
    loggingIn: "جارٍ الدخول…",
    loginFail: "تعذر تسجيل الدخول",
    loading: "جارٍ التحميل…",
    refresh: "تحديث",
    exportPdf: "تصدير PDF",
    whatsapp: "واتساب",
    totalBookings: "إجمالي الحجوزات",
    stNew: "جديد",
    stContacted: "تم التواصل",
    stClosed: "مغلق",
    searchBooking: "ابحث برقم الطلب أو الهاتف",
    allBookings: "كل الحجوزات",
    colId: "رقم الطلب",
    colDate: "التاريخ",
    colName: "الاسم",
    colPhone: "الهاتف",
    colEmail: "البريد",
    colType: "النوع",
    colBudget: "الميزانية",
    colDetails: "التفاصيل",
    colEmailStatus: "حالة البريد",
    colStatus: "الحالة",
    colContact: "تواصل",
    noBookings: "لا توجد حجوزات في هذا التصنيف.",
    prev: "السابق",
    next: "التالي",
    page: "صفحة",
    updateStatusFail: "تعذر تحديث الحالة",
    company: "موقع شركة",
    personal: "موقع شخصي",
    other: "فكرة أخرى",
    emailSent: "تم الإرسال",
    emailPending: "قيد الإرسال",
    emailFailed: "فشل الإرسال",
    emailNotConf: "غير مُفعّل",
    lastMonth: "آخر شهر",
    thisYear: "هذا العام",
    last6: "آخر 6 شهور",
    income: "دخل",
    expense: "مصروف",
    trend6: "مؤشر آخر 6 شهور",
    movements: "الحركات المالية",
    amount: "المبلغ",
    desc: "الوصف",
    descExample: "وصف الحركة (مثال: دفعة مشروع فلان)",
    by: "بواسطة",
    add: "إضافة",
    del: "حذف",
    noMovements: "لا توجد حركات مسجلة بعد.",
    badAmount: "اكتب مبلغاً صحيحاً",
    addFail: "تعذر إضافة الحركة",
    delMovementFail: "تعذر حذف الحركة",
    invTitle: "فواتير ومصاريف الشركة",
    invSubtitle: "سجّل ما تدفعه الشركة: الدومين، الاستضافة، الأدوات",
    invUsdYear: "دولار هذا العام",
    invEgpYear: "جنيه هذا العام",
    invCount: "عدد الفواتير",
    category: "التصنيف",
    currency: "العملة",
    catDomain: "دومين",
    catHosting: "استضافة",
    catCloud: "خدمات سحابية",
    catTools: "أدوات",
    catMarketing: "تسويق",
    catOther: "أخرى",
    invNoteExample: "وصف (مثال: تجديد دومين stratix.website)",
    noInvoices: "لا توجد فواتير مسجلة بعد.",
    addInvoiceFail: "تعذر إضافة الفاتورة",
    delInvoiceFail: "تعذر حذف الفاتورة",
    colCategory: "التصنيف",
    bookingsSub: "كل طلبات المشاريع الواردة",
    financeSub: "دخل ومصروفات الاستوديو",
    pdfTitle: "تقرير الحجوزات",
    pdfGenerated: "تاريخ التصدير",
    pdfCount: "عدد الحجوزات",
    popupBlocked: "المتصفح منع النافذة — اسمح بالنوافذ المنبثقة وحاول مرة أخرى",
  },
  en: {
    dir: "ltr" as const,
    panel: "Dashboard",
    hi: "Welcome",
    logout: "Log out",
    bookings: "Bookings",
    finance: "Finance",
    invoices: "Invoices",
    navBookings: "Bookings",
    navFinance: "Finance",
    navInvoices: "Invoices",
    password: "Password",
    login: "Sign in",
    loggingIn: "Signing in…",
    loginFail: "Sign-in failed",
    loading: "Loading…",
    refresh: "Refresh",
    exportPdf: "Export PDF",
    whatsapp: "WhatsApp",
    totalBookings: "Total bookings",
    stNew: "New",
    stContacted: "Contacted",
    stClosed: "Closed",
    searchBooking: "Search by order id or phone",
    allBookings: "All bookings",
    colId: "Order ID",
    colDate: "Date",
    colName: "Name",
    colPhone: "Phone",
    colEmail: "Email",
    colType: "Type",
    colBudget: "Budget",
    colDetails: "Details",
    colEmailStatus: "Email",
    colStatus: "Status",
    colContact: "Contact",
    noBookings: "No bookings in this filter.",
    prev: "Previous",
    next: "Next",
    page: "Page",
    updateStatusFail: "Could not update status",
    company: "Company site",
    personal: "Personal site",
    other: "Other idea",
    emailSent: "Sent",
    emailPending: "Pending",
    emailFailed: "Failed",
    emailNotConf: "Off",
    lastMonth: "Last month",
    thisYear: "This year",
    last6: "Last 6 months",
    income: "Income",
    expense: "Expense",
    trend6: "Last 6 months trend",
    movements: "Transactions",
    amount: "Amount",
    desc: "Description",
    descExample: "Description (e.g. project payment)",
    by: "By",
    add: "Add",
    del: "Delete",
    noMovements: "No transactions yet.",
    badAmount: "Enter a valid amount",
    addFail: "Could not add transaction",
    delMovementFail: "Could not delete transaction",
    invTitle: "Company bills & costs",
    invSubtitle: "Log what the company pays for: domain, hosting, tools",
    invUsdYear: "USD this year",
    invEgpYear: "EGP this year",
    invCount: "Invoices",
    category: "Category",
    currency: "Currency",
    catDomain: "Domain",
    catHosting: "Hosting",
    catCloud: "Cloud",
    catTools: "Tools",
    catMarketing: "Marketing",
    catOther: "Other",
    invNoteExample: "Description (e.g. renew stratix.website domain)",
    noInvoices: "No invoices yet.",
    addInvoiceFail: "Could not add invoice",
    delInvoiceFail: "Could not delete invoice",
    colCategory: "Category",
    bookingsSub: "Every incoming project request",
    financeSub: "Studio income and expenses",
    pdfTitle: "Bookings report",
    pdfGenerated: "Exported",
    pdfCount: "Bookings",
    popupBlocked: "The browser blocked the window — allow pop-ups and try again",
  },
} satisfies Record<Lang, Record<string, unknown>>;

type Dict = (typeof T)[Lang];

const accounts = [
  { id: "fares" as const, labelAr: "فارس سامي", labelEn: "Fares Samy" },
  { id: "youssef" as const, labelAr: "يوسف تامر", labelEn: "Youssef Tamer" },
];

const PAGE_SIZE = 20;
const LEDGER_PAGE_SIZE = 20;
type Section = "bookings" | "finance" | "invoices";

function useAdminPrefs() {
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem("admin-lang") as Lang) === "en" ? "en" : "ar",
  );
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("admin-theme") === "light" ? "light" : "dark",
  );

  useEffect(() => {
    localStorage.setItem("admin-lang", lang);
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("admin-theme", theme);
  }, [theme]);

  return {
    lang,
    theme,
    t: T[lang],
    toggleLang: () => setLang(l => (l === "ar" ? "en" : "ar")),
    toggleTheme: () => setTheme(v => (v === "light" ? "dark" : "light")),
  };
}

function formatDate(timestamp: number, lang: Lang) {
  return new Date(timestamp).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatEgp(value: number, lang: Lang) {
  const n = value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 0 });
  return lang === "ar" ? `${n} ج.م` : `EGP ${n}`;
}

function formatMoney(value: number, currency: "USD" | "EGP", lang: Lang) {
  const n = value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 });
  if (currency === "USD") return `$${n}`;
  return lang === "ar" ? `${n} ج.م` : `EGP ${n}`;
}

const budgetLabels: Record<BookingRow["budget"], { ar: string; en: string }> = {
  "700-1500": { ar: "700 — 1,500 ج.م", en: "EGP 700 — 1,500" },
  "1500-3000": { ar: "1,500 — 3,000 ج.م", en: "EGP 1,500 — 3,000" },
  "3000+": { ar: "أكثر من 3,000 ج.م", en: "EGP 3,000+" },
};

// Egyptian local number to wa.me international form: 01xxxxxxxxx -> 201xxxxxxxxx.
function waLink(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  const intl = digits.startsWith("0") ? `2${digits}` : digits;
  return `https://wa.me/${intl}`;
}

// ─────────────────────────── login ───────────────────────────
function LoginScreen({ t, lang, onLoggedIn }: { t: Dict; lang: Lang; onLoggedIn: () => void }) {
  const [accountId, setAccountId] = useState<"fares" | "youssef">("fares");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: () => {
      setPassword("");
      onLoggedIn();
    },
    onError: error => toast.error(t.loginFail, { description: error.message }),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir={t.dir}>
      <Card className="w-full max-w-sm shadow-2xl border-border/60">
        <CardHeader className="items-center text-center gap-2">
          <div className="size-12 rounded-xl bg-primary/12 grid place-items-center mb-1">
            <span className="font-display text-primary text-xl font-bold" dir="ltr">
              S
            </span>
          </div>
          <CardTitle className="text-xl font-display" dir="ltr">
            STRATIX
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.panel}</p>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={event => {
              event.preventDefault();
              loginMutation.mutate({ accountId, password });
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              {accounts.map(account => (
                <button
                  type="button"
                  key={account.id}
                  onClick={() => setAccountId(account.id)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                    accountId === account.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {lang === "ar" ? account.labelAr : account.labelEn}
                </button>
              ))}
            </div>
            <Input
              type="password"
              placeholder={t.password}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" className="h-11" disabled={loginMutation.isPending || !password}>
              {loginMutation.isPending ? t.loggingIn : t.login}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── stat cards ───────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`size-10 shrink-0 rounded-lg grid place-items-center ${
            accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold font-display leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MoneyStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold font-display" dir="ltr">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── bookings ───────────────────────────
function exportBookingsPdf(rows: BookingRow[], t: Dict, lang: Lang) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error(t.popupBlocked);
    return;
  }
  const projectType: Record<BookingRow["projectType"], string> = {
    company: t.company,
    personal: t.personal,
    other: t.other,
  };
  const status: Record<BookingStatus, string> = {
    new: t.stNew,
    contacted: t.stContacted,
    closed: t.stClosed,
  };
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  const body = rows
    .map(
      b => `<tr>
        <td class="mono">${esc(b.publicId)}</td>
        <td>${esc(formatDate(b.createdAt, lang))}</td>
        <td>${esc(b.name)}</td>
        <td class="mono">${esc(b.phone)}</td>
        <td>${esc(projectType[b.projectType])}</td>
        <td>${esc(budgetLabels[b.budget][lang])}</td>
        <td>${esc(status[b.status])}</td>
      </tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8">
    <title>${esc(t.pdfTitle)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#1a1a1a;margin:24px;font-size:11px}
      .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #ff6b1a;padding-bottom:10px;margin-bottom:16px}
      .mark{font-size:24px;font-weight:800;letter-spacing:3px;direction:ltr}
      .meta{font-size:10px;color:#666;text-align:${lang === "ar" ? "left" : "right"}}
      h1{font-size:15px;margin:0 0 2px}
      table{width:100%;border-collapse:collapse}
      th{background:#11100e;color:#fff;padding:6px 8px;text-align:${lang === "ar" ? "right" : "left"};font-size:10px}
      td{padding:5px 8px;border-bottom:1px solid #ddd}
      tr:nth-child(even){background:#fafafa}
      .mono{font-family:Consolas,monospace;direction:ltr;font-size:10px}
      @media print{body{margin:12px}}
    </style></head><body>
    <div class="head">
      <div><div class="mark">STRATIX</div><h1>${esc(t.pdfTitle)}</h1></div>
      <div class="meta">${esc(t.pdfGenerated)}: ${esc(formatDate(Date.now(), lang))}<br>${esc(t.pdfCount)}: ${rows.length}</div>
    </div>
    <table><thead><tr>
      <th>${esc(t.colId)}</th><th>${esc(t.colDate)}</th><th>${esc(t.colName)}</th>
      <th>${esc(t.colPhone)}</th><th>${esc(t.colType)}</th><th>${esc(t.colBudget)}</th><th>${esc(t.colStatus)}</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
    </body></html>`);
  win.document.close();
}

function BookingsPanel({ t, lang }: { t: Dict; lang: Lang }) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const statusLabels: Record<BookingStatus, string> = {
    new: t.stNew,
    contacted: t.stContacted,
    closed: t.stClosed,
  };
  const projectTypeLabels: Record<BookingRow["projectType"], string> = {
    company: t.company,
    personal: t.personal,
    other: t.other,
  };
  const emailStatusLabels: Record<
    BookingRow["emailStatus"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    sent: { label: t.emailSent, variant: "secondary" },
    pending: { label: t.emailPending, variant: "outline" },
    failed: { label: t.emailFailed, variant: "destructive" },
    not_configured: { label: t.emailNotConf, variant: "outline" },
  };
  const statusFilters: Array<{ value: "all" | BookingStatus; label: string }> = [
    { value: "all", label: t.allBookings },
    { value: "new", label: t.stNew },
    { value: "contacted", label: t.stContacted },
    { value: "closed", label: t.stClosed },
  ];

  const filterArgs = {
    status: search || statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  };

  const statsQuery = trpc.adminBookings.stats.useQuery();
  const listQuery = trpc.adminBookings.list.useQuery({
    ...filterArgs,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const updateStatusMutation = trpc.adminBookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.adminBookings.list.invalidate();
      utils.adminBookings.stats.invalidate();
    },
    onError: error => toast.error(t.updateStatusFail, { description: error.message }),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await utils.adminBookings.list.fetch({ ...filterArgs, limit: 100, offset: 0 });
      exportBookingsPdf(rows, t, lang);
    } finally {
      setExporting(false);
    }
  };

  const bookings = listQuery.data ?? [];
  const hasNextPage = bookings.length === PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t.totalBookings} value={statsQuery.data?.total ?? 0} icon={Inbox} accent />
        <StatCard label={t.stNew} value={statsQuery.data?.byStatus.new ?? 0} icon={CalendarClock} />
        <StatCard label={t.stContacted} value={statsQuery.data?.byStatus.contacted ?? 0} icon={MessageCircle} />
        <StatCard label={t.stClosed} value={statsQuery.data?.byStatus.closed ?? 0} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-3 space-y-0">
          <CardTitle>{t.bookings}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute end-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder={t.searchBooking}
                className="w-full sm:w-56 pe-8"
                dir={t.dir}
              />
            </div>
            <Select
              value={statusFilter}
              disabled={Boolean(search)}
              onValueChange={value => {
                setStatusFilter(value as "all" | BookingStatus);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map(filter => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || bookings.length === 0}>
              <FileText className="size-4" /> {t.exportPdf}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                listQuery.refetch();
                statsQuery.refetch();
              }}
              aria-label={t.refresh}
            >
              <RefreshCw className={listQuery.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colId}</TableHead>
                  <TableHead>{t.colDate}</TableHead>
                  <TableHead>{t.colName}</TableHead>
                  <TableHead>{t.colPhone}</TableHead>
                  <TableHead>{t.colEmail}</TableHead>
                  <TableHead>{t.colType}</TableHead>
                  <TableHead>{t.colBudget}</TableHead>
                  <TableHead>{t.colDetails}</TableHead>
                  <TableHead>{t.colEmailStatus}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead className="text-center">{t.colContact}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map(booking => (
                  <TableRow key={booking.publicId}>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {booking.publicId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(booking.createdAt, lang)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{booking.name}</TableCell>
                    <TableCell dir="ltr" className="whitespace-nowrap">
                      <a className="hover:text-primary" href={`tel:${booking.phone}`}>
                        {booking.phone}
                      </a>
                    </TableCell>
                    <TableCell dir="ltr">
                      {booking.clientEmail ? (
                        <a className="hover:text-primary" href={`mailto:${booking.clientEmail}`}>
                          {booking.clientEmail}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{projectTypeLabels[booking.projectType]}</TableCell>
                    <TableCell className="whitespace-nowrap">{budgetLabels[booking.budget][lang]}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-sm text-muted-foreground">
                      {booking.details || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emailStatusLabels[booking.emailStatus].variant}>
                        {emailStatusLabels[booking.emailStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={booking.status}
                        onValueChange={value =>
                          updateStatusMutation.mutate({
                            publicId: booking.publicId,
                            status: value as BookingStatus,
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabels) as BookingStatus[]).map(s => (
                            <SelectItem key={s} value={s}>
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <a
                        href={waLink(booking.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-grid place-items-center size-8 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        aria-label={t.whatsapp}
                        title={t.whatsapp}
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings.length === 0 && !listQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                      {t.noBookings}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination t={t} page={page} setPage={setPage} hasNextPage={hasNextPage} />
        </CardContent>
      </Card>
    </div>
  );
}

function Pagination({
  t,
  page,
  setPage,
  hasNextPage,
}: {
  t: Dict;
  page: number;
  setPage: (fn: (n: number) => number) => void;
  hasNextPage: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(c => Math.max(0, c - 1))}>
        {t.prev}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t.page} {page + 1}
      </span>
      <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => setPage(c => c + 1)}>
        {t.next}
      </Button>
    </div>
  );
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────── finance ───────────────────────────
function AddLedgerEntryForm({ t, onCreated }: { t: Dict; onCreated: () => void }) {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayInputValue());

  const createMutation = trpc.adminLedger.create.useMutation({
    onSuccess: () => {
      setAmount("");
      setNote("");
      setDate(todayInputValue());
      onCreated();
    },
    onError: error => toast.error(t.addFail, { description: error.message }),
  });

  return (
    <form
      className="grid grid-cols-2 md:flex md:flex-wrap md:items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
          toast.error(t.badAmount);
          return;
        }
        createMutation.mutate({
          type,
          amount: numericAmount,
          note: note.trim(),
          occurredAt: new Date(date).getTime(),
        });
      }}
    >
      <Select value={type} onValueChange={value => setType(value as "income" | "expense")}>
        <SelectTrigger className="w-full md:w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="income">{t.income}</SelectItem>
          <SelectItem value="expense">{t.expense}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="0.01"
        step="0.01"
        placeholder={t.amount}
        value={amount}
        onChange={event => setAmount(event.target.value)}
        className="w-full md:w-32"
        required
      />
      <Input
        type="text"
        placeholder={t.descExample}
        value={note}
        onChange={event => setNote(event.target.value)}
        className="col-span-2 md:w-64"
        required
      />
      <Input
        type="date"
        value={date}
        onChange={event => setDate(event.target.value)}
        className="w-full md:w-40"
        required
      />
      <Button type="submit" className="col-span-2 md:col-span-1" disabled={createMutation.isPending}>
        <Plus /> {t.add}
      </Button>
    </form>
  );
}

function FinancePanel({ t, lang }: { t: Dict; lang: Lang }) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);

  const statsQuery = trpc.adminLedger.stats.useQuery();
  const listQuery = trpc.adminLedger.list.useQuery({ limit: LEDGER_PAGE_SIZE, offset: page * LEDGER_PAGE_SIZE });

  const invalidateAll = () => {
    utils.adminLedger.list.invalidate();
    utils.adminLedger.stats.invalidate();
  };

  const removeMutation = trpc.adminLedger.remove.useMutation({
    onSuccess: invalidateAll,
    onError: error => toast.error(t.delMovementFail, { description: error.message }),
  });

  const entries = listQuery.data ?? [];
  const hasNextPage = entries.length === LEDGER_PAGE_SIZE;
  const money = (n: number) => formatEgp(n, lang);
  const netSub = (income: number, expense: number) => `${t.income} ${money(income)} — ${t.expense} ${money(expense)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MoneyStatCard
          label={t.lastMonth}
          value={money(statsQuery.data?.thisMonth.net ?? 0)}
          sub={netSub(statsQuery.data?.thisMonth.income ?? 0, statsQuery.data?.thisMonth.expense ?? 0)}
        />
        <MoneyStatCard
          label={t.thisYear}
          value={money(statsQuery.data?.thisYear.net ?? 0)}
          sub={netSub(statsQuery.data?.thisYear.income ?? 0, statsQuery.data?.thisYear.expense ?? 0)}
        />
        <MoneyStatCard
          label={t.last6}
          value={money(statsQuery.data?.last6Months.net ?? 0)}
          sub={netSub(statsQuery.data?.last6Months.income ?? 0, statsQuery.data?.last6Months.expense ?? 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.trend6}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              income: { label: t.income, color: "oklch(0.7 0.16 150)" },
              expense: { label: t.expense, color: "oklch(0.62 0.22 28)" },
            }}
            className="h-56 md:h-64 w-full"
          >
            <BarChart data={statsQuery.data?.monthlyTrend ?? []}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={4} />
              <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>{t.movements}</CardTitle>
          <AddLedgerEntryForm t={t} onCreated={invalidateAll} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colDate}</TableHead>
                  <TableHead>{t.colType}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.desc}</TableHead>
                  <TableHead>{t.by}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: LedgerRow) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.occurredAt, lang)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.type === "income" ? "secondary" : "destructive"}>
                        {entry.type === "income" ? t.income : t.expense}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{money(Number(entry.amount))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.note}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {(() => {
                        const a = accounts.find(acc => acc.id === entry.createdBy);
                        return a ? (lang === "ar" ? a.labelAr : a.labelEn) : entry.createdBy;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMutation.mutate({ id: entry.id })}
                        aria-label={t.del}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && !listQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {t.noMovements}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination t={t} page={page} setPage={setPage} hasNextPage={hasNextPage} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── invoices ───────────────────────────
const invoiceCategories = ["domain", "hosting", "cloud", "tools", "marketing", "other"] as const;
type InvoiceCategory = (typeof invoiceCategories)[number];

function categoryLabel(cat: InvoiceCategory, t: Dict) {
  const map: Record<InvoiceCategory, string> = {
    domain: t.catDomain,
    hosting: t.catHosting,
    cloud: t.catCloud,
    tools: t.catTools,
    marketing: t.catMarketing,
    other: t.catOther,
  };
  return map[cat];
}

function AddInvoiceForm({ t, onCreated }: { t: Dict; onCreated: () => void }) {
  const [category, setCategory] = useState<InvoiceCategory>("domain");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EGP">("USD");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayInputValue());

  const createMutation = trpc.adminInvoices.create.useMutation({
    onSuccess: () => {
      setAmount("");
      setNote("");
      setDate(todayInputValue());
      onCreated();
    },
    onError: error => toast.error(t.addInvoiceFail, { description: error.message }),
  });

  return (
    <form
      className="grid grid-cols-2 md:flex md:flex-wrap md:items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
          toast.error(t.badAmount);
          return;
        }
        createMutation.mutate({
          category,
          amount: numericAmount,
          currency,
          note: note.trim(),
          occurredAt: new Date(date).getTime(),
        });
      }}
    >
      <Select value={category} onValueChange={value => setCategory(value as InvoiceCategory)}>
        <SelectTrigger className="w-full md:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {invoiceCategories.map(cat => (
            <SelectItem key={cat} value={cat}>
              {categoryLabel(cat, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="0.01"
        step="0.01"
        placeholder={t.amount}
        value={amount}
        onChange={event => setAmount(event.target.value)}
        className="w-full md:w-28"
        required
      />
      <Select value={currency} onValueChange={value => setCurrency(value as "USD" | "EGP")}>
        <SelectTrigger className="w-full md:w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USD">USD $</SelectItem>
          <SelectItem value="EGP">EGP</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="text"
        placeholder={t.invNoteExample}
        value={note}
        onChange={event => setNote(event.target.value)}
        className="col-span-2 md:w-64"
        required
      />
      <Input
        type="date"
        value={date}
        onChange={event => setDate(event.target.value)}
        className="w-full md:w-40"
        required
      />
      <Button type="submit" className="col-span-2 md:col-span-1" disabled={createMutation.isPending}>
        <Plus /> {t.add}
      </Button>
    </form>
  );
}

function InvoicesPanel({ t, lang }: { t: Dict; lang: Lang }) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);

  const statsQuery = trpc.adminInvoices.stats.useQuery();
  const listQuery = trpc.adminInvoices.list.useQuery({ limit: LEDGER_PAGE_SIZE, offset: page * LEDGER_PAGE_SIZE });

  const invalidateAll = () => {
    utils.adminInvoices.list.invalidate();
    utils.adminInvoices.stats.invalidate();
  };

  const removeMutation = trpc.adminInvoices.remove.useMutation({
    onSuccess: invalidateAll,
    onError: error => toast.error(t.delInvoiceFail, { description: error.message }),
  });

  const entries = listQuery.data ?? [];
  const hasNextPage = entries.length === LEDGER_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MoneyStatCard label={t.invUsdYear} value={formatMoney(statsQuery.data?.usdThisYear ?? 0, "USD", lang)} />
        <MoneyStatCard label={t.invEgpYear} value={formatMoney(statsQuery.data?.egpThisYear ?? 0, "EGP", lang)} />
        <StatCard label={t.invCount} value={statsQuery.data?.total ?? 0} icon={Receipt} accent />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>{t.invoices}</CardTitle>
          <AddInvoiceForm t={t} onCreated={invalidateAll} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colDate}</TableHead>
                  <TableHead>{t.colCategory}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.desc}</TableHead>
                  <TableHead>{t.by}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: InvoiceRow) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.occurredAt, lang)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabel(entry.category, t)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap" dir="ltr">
                      {formatMoney(Number(entry.amount), entry.currency, lang)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.note}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {(() => {
                        const a = accounts.find(acc => acc.id === entry.createdBy);
                        return a ? (lang === "ar" ? a.labelAr : a.labelEn) : entry.createdBy;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMutation.mutate({ id: entry.id })}
                        aria-label={t.del}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && !listQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {t.noInvoices}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination t={t} page={page} setPage={setPage} hasNextPage={hasNextPage} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── shell ───────────────────────────
const navItems: Array<{
  id: Section;
  labelKey: "navBookings" | "navFinance" | "navInvoices";
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "bookings", labelKey: "navBookings", icon: ClipboardList },
  { id: "finance", labelKey: "navFinance", icon: Wallet },
  { id: "invoices", labelKey: "navInvoices", icon: Receipt },
];

function DashboardShell({
  accountName,
  prefs,
}: {
  accountName: string;
  prefs: ReturnType<typeof useAdminPrefs>;
}) {
  const { t, lang, theme, toggleLang, toggleTheme } = prefs;
  const [section, setSection] = useState<Section>("bookings");
  const utils = trpc.useUtils();
  const logoutMutation = trpc.adminAuth.logout.useMutation({
    onSuccess: () => utils.adminAuth.me.setData(undefined, null),
  });

  const sectionMeta: Record<Section, { title: string; sub: string }> = {
    bookings: { title: t.bookings, sub: t.bookingsSub },
    finance: { title: t.finance, sub: t.financeSub },
    invoices: { title: t.invTitle, sub: t.invSubtitle },
  };

  return (
    <div className="flex min-h-screen" dir={t.dir}>
      {/* Sidebar — tablet and up */}
      <aside className="hidden md:flex md:flex-col w-16 lg:w-60 shrink-0 border-e bg-card">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <div className="size-9 rounded-lg bg-primary/15 grid place-items-center shrink-0">
            <span className="font-display text-primary font-bold" dir="ltr">
              S
            </span>
          </div>
          <span className="font-display font-bold text-lg hidden lg:block" dir="ltr">
            STRATIX
          </span>
        </div>
        <nav className="flex-1 p-2 lg:p-3 flex flex-col gap-1">
          {navItems.map(item => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 rounded-lg px-3 h-11 text-sm font-medium transition-colors justify-center lg:justify-start ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title={t[item.labelKey]}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="hidden lg:block">{t[item.labelKey]}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-2 lg:p-3 border-t text-xs text-muted-foreground hidden lg:block">
          {t.hi} {accountName}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b flex items-center justify-between gap-3 px-4 md:px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg leading-tight md:hidden" dir="ltr">
              STRATIX
            </h1>
            <h2 className="font-semibold text-base md:text-lg truncate hidden md:block">
              {sectionMeta[section].title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggleLang} aria-label="language" title="AR / EN">
              <Globe />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="theme">
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t.logout}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div className="md:hidden mb-4">
            <h2 className="font-semibold text-lg">{sectionMeta[section].title}</h2>
            <p className="text-sm text-muted-foreground">{sectionMeta[section].sub}</p>
          </div>
          {section === "bookings" && <BookingsPanel t={t} lang={lang} />}
          {section === "finance" && <FinancePanel t={t} lang={lang} />}
          {section === "invoices" && <InvoicesPanel t={t} lang={lang} />}
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-card grid grid-cols-3">
        {navItems.map(item => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-16 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-5" />
              {t[item.labelKey]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function Admin() {
  const prefs = useAdminPrefs();
  const meQuery = trpc.adminAuth.me.useQuery();

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const wrapperClass = prefs.theme === "light" ? "admin-light" : "";

  let content: React.ReactNode;
  if (meQuery.isLoading) {
    content = (
      <div className="min-h-screen grid place-items-center text-muted-foreground">{prefs.t.loading}</div>
    );
  } else if (!meQuery.data) {
    content = <LoginScreen t={prefs.t} lang={prefs.lang} onLoggedIn={() => meQuery.refetch()} />;
  } else {
    content = <DashboardShell accountName={meQuery.data.name} prefs={prefs} />;
  }

  return <div className={`${wrapperClass} min-h-screen bg-background text-foreground`}>{content}</div>;
}
