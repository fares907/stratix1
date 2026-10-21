import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Download,
  FileText,
  Globe,
  Hourglass,
  Inbox,
  LogOut,
  Mail,
  MessageCircle,
  MessagesSquare,
  Moon,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  Wallet,
  X,
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
    totpCode: "رمز التحقق",
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
    colAmount: "المبلغ",
    colPayment: "الدفع",
    payUnpaid: "غير مدفوع",
    payAwaiting: "بانتظار المراجعة",
    payPaid: "مدفوع",
    setAmount: "تحديد المبلغ",
    amountPlaceholder: "المبلغ",
    save: "حفظ",
    markPaid: "تأكيد الدفع",
    markUnpaid: "إلغاء التأكيد",
    confirmMarkPaid: "تأكيد إن المبلغ وصل فعلاً؟ راجع الحساب الأول.",
    invoice: "الفاتورة",
    invoiceFail: "تعذر إصدار الفاتورة",
    setAmountFail: "تعذر حفظ المبلغ",
    setPaymentFail: "تعذر تحديث حالة الدفع",
    amountSaved: "تم حفظ المبلغ",
    ref: "مرجع التحويل",
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
    financeSub: "دخل ومصروفات الشركة",
    pdfTitle: "تقرير الحجوزات",
    pdfGenerated: "تاريخ التصدير",
    pdfCount: "عدد الحجوزات",
    popupBlocked: "المتصفح منع النافذة — اسمح بالنوافذ المنبثقة وحاول مرة أخرى",
    kpiNeedsContact: "جديد يحتاج تواصل",
    kpiAwaiting: "تحويلات للمراجعة",
    attention: (n: number) => (n === 1 ? "فيه تحويل مستني مراجعتك" : `فيه ${n} تحويلات مستنية مراجعتك`),
    review: "راجعها",
    showAll: "عرض الكل",
    filteredBy: "معروض",
    colClient: "العميل",
    colOrder: "الطلب",
    colProject: "المشروع",
    details: "التفاصيل",
    close: "إغلاق",
    call: "اتصال",
    sendEmail: "إيميل",
    contactInfo: "بيانات التواصل",
    projectInfo: "المشروع",
    noNotes: "العميل مكتبش ملاحظات.",
    paymentSection: "المبلغ والدفع",
    emailDelivery: "إشعار الحجز",
    navLeads: "طلبات الشات",
    leadsTitle: "طلبات الشات",
    leadsSub: "اللي طلبوا تواصل من المساعد في الموقع",
    leadsTotal: "إجمالي الطلبات",
    allLeads: "كل الطلبات",
    noLeads: "مفيش طلبات تواصل لسه.",
    leadEmailMissed: "الإيميل موصلش — الطلب متسجل هنا",
    topicNewSite: "موقع جديد",
    topicExisting: "مشكلة في موقع حالي",
    topicOther: "طلب تاني",
    stageSection: "مرحلة المشروع",
    stageHint: "العميل بيشوف المرحلة دي في صفحة متابعة الطلب.",
    stageReceived: "تم الاستلام",
    stageDesign: "التصميم",
    stageDevelopment: "البرمجة",
    stageReview: "المراجعة",
    stageDelivered: "التسليم",
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
    totpCode: "Verification code",
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
    colAmount: "Amount",
    colPayment: "Payment",
    payUnpaid: "Unpaid",
    payAwaiting: "Awaiting review",
    payPaid: "Paid",
    setAmount: "Set amount",
    amountPlaceholder: "Amount",
    save: "Save",
    markPaid: "Confirm payment",
    markUnpaid: "Undo confirmation",
    confirmMarkPaid: "Confirm the money actually arrived? Check the account first.",
    invoice: "Invoice",
    invoiceFail: "Could not generate the invoice",
    setAmountFail: "Could not save the amount",
    setPaymentFail: "Could not update payment status",
    amountSaved: "Amount saved",
    ref: "Transfer reference",
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
    financeSub: "Company income and expenses",
    pdfTitle: "Bookings report",
    pdfGenerated: "Exported",
    pdfCount: "Bookings",
    popupBlocked: "The browser blocked the window — allow pop-ups and try again",
    kpiNeedsContact: "New, needs contact",
    kpiAwaiting: "Transfers to review",
    attention: (n: number) => (n === 1 ? "A transfer is waiting for your review" : `${n} transfers are waiting for your review`),
    review: "Review",
    showAll: "Show all",
    filteredBy: "Showing",
    colClient: "Client",
    colOrder: "Order",
    colProject: "Project",
    details: "Details",
    close: "Close",
    call: "Call",
    sendEmail: "Email",
    contactInfo: "Contact",
    projectInfo: "Project",
    noNotes: "No notes from the client.",
    paymentSection: "Amount & payment",
    emailDelivery: "Booking notification",
    navLeads: "Chat leads",
    leadsTitle: "Chat leads",
    leadsSub: "Visitors who asked the site assistant to reach them",
    leadsTotal: "Total leads",
    allLeads: "All leads",
    noLeads: "No contact requests yet.",
    leadEmailMissed: "Email not delivered — saved here",
    topicNewSite: "New website",
    topicExisting: "Issue with an existing site",
    topicOther: "Something else",
    stageSection: "Project stage",
    stageHint: "The client sees this stage on the order tracking page.",
    stageReceived: "Received",
    stageDesign: "Design",
    stageDevelopment: "Development",
    stageReview: "Review",
    stageDelivered: "Delivered",
  },
} satisfies Record<Lang, Record<string, unknown>>;

type Dict = (typeof T)[Lang];

const PAGE_SIZE = 20;
const LEDGER_PAGE_SIZE = 20;
type Section = "bookings" | "leads" | "finance" | "invoices";

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

// The stored values are legacy price bands from when the site published a
// starting price. Pricing is now quoted per project, so the form asks about
// project size instead and these values act purely as size identifiers —
// smallest to largest, in the same order. Kept as-is so existing bookings stay
// readable; only the labels changed.
const budgetLabels: Record<BookingRow["budget"], { ar: string; en: string }> = {
  "700-1500": { ar: "موقع بسيط — صفحة واحدة", en: "Simple site — one page" },
  "1500-3000": { ar: "موقع متعدد الصفحات", en: "Multi-page site" },
  "3000+": { ar: "متجر أو نظام كبير", en: "Store or large system" },
};

// Egyptian local number to wa.me international form: 01xxxxxxxxx -> 201xxxxxxxxx.
function waLink(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  const intl = digits.startsWith("0") ? `2${digits}` : digits;
  return `https://wa.me/${intl}`;
}

// ─────────────────────────── login ───────────────────────────
function LoginScreen({ t, onLoggedIn }: { t: Dict; onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // The code field appears only once two-factor is configured on the server.
  const secondFactor = trpc.adminAuth.loginOptions.useQuery().data?.secondFactor ?? false;
  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: () => {
      setPassword("");
      setCode("");
      onLoggedIn();
    },
    onError: error => {
      setCode("");
      toast.error(t.loginFail, { description: error.message });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir={t.dir}>
      <Card className="w-full max-w-sm shadow-2xl border-border/60">
        <CardHeader className="items-center justify-items-center text-center gap-2">
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
              loginMutation.mutate({ password, code: code || undefined });
            }}
          >
            <Input
              type="password"
              placeholder={t.password}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            {secondFactor && (
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder={t.totpCode}
                value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                dir="ltr"
                required
                className="text-center tracking-[0.4em] font-mono placeholder:tracking-normal placeholder:font-sans"
              />
            )}
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
      .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #7c5cff;padding-bottom:10px;margin-bottom:16px}
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
    </body></html>`);
  win.document.close();
  // The popup inherits this page's CSP, which forbids inline scripts, so the
  // print dialog has to be opened from here rather than from inside the popup.
  win.focus();
  setTimeout(() => win.print(), 250);
}

// Quoting a project is what turns its payment page on: until an amount is set,
// the client is told the quote isn't ready. Editing happens inline because it's
// a two-field change made while reading the row.
function AmountCell({ booking, t, onSaved }: { booking: BookingRow; t: Dict; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(booking.amountDue ?? "");
  const [currency, setCurrency] = useState<BookingRow["currency"]>(booking.currency);

  const mutation = trpc.adminBookings.setAmount.useMutation({
    onSuccess: () => {
      setEditing(false);
      toast.success(t.amountSaved);
      onSaved();
    },
    onError: error => toast.error(t.setAmountFail, { description: error.message }),
  });

  if (!editing) {
    return (
      <button
        type="button"
        className="text-sm hover:text-primary underline-offset-4 hover:underline whitespace-nowrap"
        onClick={() => setEditing(true)}
      >
        {booking.amountDue ? (
          <span dir="ltr">
            {booking.amountDue} {booking.currency}
          </span>
        ) : (
          <span className="text-muted-foreground">{t.setAmount}</span>
        )}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={event => {
        event.preventDefault();
        const value = Number(amount);
        if (!value || value <= 0) {
          toast.error(t.badAmount);
          return;
        }
        mutation.mutate({ publicId: booking.publicId, amountDue: value, currency });
      }}
    >
      <Input
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder={t.amountPlaceholder}
        className="w-24 h-8"
        autoFocus
        required
      />
      <Select value={currency} onValueChange={v => setCurrency(v as BookingRow["currency"])}>
        <SelectTrigger size="sm" className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["EGP", "USD", "SAR", "AED"] as const).map(c => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {t.save}
      </Button>
    </form>
  );
}

// Status and payment are read at a glance from colour; the light theme gets
// deeper shades so the text keeps its contrast on a white card.
const STATUS_TONE: Record<BookingStatus, string> = {
  new: "bg-violet-500/14 text-violet-300 ring-violet-500/30 in-[.admin-light]:text-violet-700",
  contacted: "bg-sky-500/12 text-sky-400 ring-sky-500/25 in-[.admin-light]:text-sky-700",
  closed: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25 in-[.admin-light]:text-emerald-700",
};
const PAYMENT_TONE: Record<BookingRow["paymentStatus"], string> = {
  unpaid: "bg-muted text-muted-foreground ring-border",
  awaiting_review: "bg-amber-500/14 text-amber-400 ring-amber-500/30 in-[.admin-light]:text-amber-700",
  paid: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25 in-[.admin-light]:text-emerald-700",
};

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function paymentLabel(status: BookingRow["paymentStatus"], t: Dict) {
  return { unpaid: t.payUnpaid, awaiting_review: t.payAwaiting, paid: t.payPaid }[status];
}

type BookingStage = BookingRow["stage"];
const BOOKING_STAGE_ORDER: BookingStage[] = ["received", "design", "development", "review", "delivered"];

function stageLabel(stage: BookingStage, t: Dict) {
  return {
    received: t.stageReceived,
    design: t.stageDesign,
    development: t.stageDevelopment,
    review: t.stageReview,
    delivered: t.stageDelivered,
  }[stage];
}

function statusLabel(status: BookingStatus, t: Dict) {
  return { new: t.stNew, contacted: t.stContacted, closed: t.stClosed }[status];
}

function projectLabel(type: BookingRow["projectType"], t: Dict) {
  return { company: t.company, personal: t.personal, other: t.other }[type];
}

function StatusSelect({
  booking,
  t,
  onChange,
}: {
  booking: BookingRow;
  t: Dict;
  onChange: (status: BookingStatus) => void;
}) {
  return (
    <Select value={booking.status} onValueChange={value => onChange(value as BookingStatus)}>
      <SelectTrigger
        size="sm"
        className="h-7 w-auto gap-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        onClick={event => event.stopPropagation()}
      >
        <Pill tone={STATUS_TONE[booking.status]}>{statusLabel(booking.status, t)}</Pill>
      </SelectTrigger>
      <SelectContent>
        {(["new", "contacted", "closed"] as const).map(status => (
          <SelectItem key={status} value={status}>
            {statusLabel(status, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function downloadBase64Pdf(filename: string, base64: string) {
  // An object URL rather than a data: URL — several browsers refuse data: URLs
  // as download targets.
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PaymentActions({ booking, t, onChanged }: { booking: BookingRow; t: Dict; onChanged: () => void }) {
  const mutation = trpc.adminBookings.setPaymentStatus.useMutation({
    onSuccess: onChanged,
    onError: error => toast.error(t.setPaymentFail, { description: error.message }),
  });
  const invoiceMutation = trpc.adminBookings.invoicePdf.useMutation({
    onSuccess: ({ filename, base64 }) => downloadBase64Pdf(filename, base64),
    onError: error => toast.error(t.invoiceFail, { description: error.message }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking.amountDue && booking.paymentStatus !== "paid" && (
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-600/90"
          disabled={mutation.isPending}
          onClick={() => {
            if (window.confirm(t.confirmMarkPaid)) {
              mutation.mutate({ publicId: booking.publicId, paymentStatus: "paid" });
            }
          }}
        >
          <CheckCircle2 className="size-4" /> {t.markPaid}
        </Button>
      )}
      {booking.amountDue && (
        <Button
          size="sm"
          variant="outline"
          disabled={invoiceMutation.isPending}
          onClick={() => invoiceMutation.mutate({ publicId: booking.publicId })}
        >
          <Download className="size-4" /> {t.invoice}
        </Button>
      )}
      {booking.paymentStatus === "paid" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ publicId: booking.publicId, paymentStatus: "unpaid" })}
        >
          {t.markUnpaid}
        </Button>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm text-end min-w-0 break-words">{children}</div>
    </div>
  );
}

function BookingDetails({
  booking,
  t,
  lang,
  themeClass,
  onClose,
  onChanged,
  onStatusChange,
  onStageChange,
}: {
  booking: BookingRow | null;
  t: Dict;
  lang: Lang;
  themeClass: string;
  onClose: () => void;
  onChanged: () => void;
  onStatusChange: (booking: BookingRow, status: BookingStatus) => void;
  onStageChange: (booking: BookingRow, stage: BookingStage) => void;
}) {
  const emailState: Record<BookingRow["emailStatus"], string> = {
    sent: t.emailSent,
    pending: t.emailPending,
    failed: t.emailFailed,
    not_configured: t.emailNotConf,
  };

  return (
    <Dialog open={booking !== null} onOpenChange={open => !open && onClose()}>
      {booking && (
        <DialogContent
          dir={t.dir}
          showCloseButton={false}
          className={`${themeClass} bg-background text-foreground sm:max-w-xl max-h-[90dvh] overflow-y-auto p-0 gap-0`}
        >
          <div className="p-5 sm:p-6 border-b bg-card/60">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-start">
                <DialogTitle className="text-xl font-semibold truncate">{booking.name}</DialogTitle>
                <DialogDescription className="mt-1 font-mono text-xs" dir="ltr">
                  {booking.publicId} · {formatDate(booking.createdAt, lang)}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 -mt-1 -me-2" onClick={onClose} aria-label={t.close}>
                <X />
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusSelect booking={booking} t={t} onChange={status => onStatusChange(booking, status)} />
              <Pill tone={PAYMENT_TONE[booking.paymentStatus]}>{paymentLabel(booking.paymentStatus, t)}</Pill>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${booking.phone}`}>
                  <Phone className="size-4" /> {t.call}
                </a>
              </Button>
              <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-600/90">
                <a href={waLink(booking.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> {t.whatsapp}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={!booking.clientEmail}>
                {booking.clientEmail ? (
                  <a href={`mailto:${booking.clientEmail}`}>
                    <Mail className="size-4" /> {t.sendEmail}
                  </a>
                ) : (
                  <span className="opacity-50 pointer-events-none">
                    <Mail className="size-4" /> {t.sendEmail}
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col gap-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t.contactInfo}
              </h3>
              <DetailRow label={t.colPhone}>
                <span dir="ltr" className="font-mono">
                  {booking.phone}
                </span>
              </DetailRow>
              <DetailRow label={t.colEmail}>
                {booking.clientEmail ? (
                  <span dir="ltr">{booking.clientEmail}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>
              <DetailRow label={t.emailDelivery}>{emailState[booking.emailStatus]}</DetailRow>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t.projectInfo}
              </h3>
              <DetailRow label={t.colType}>{projectLabel(booking.projectType, t)}</DetailRow>
              <DetailRow label={t.colBudget}>{budgetLabels[booking.budget][lang]}</DetailRow>
              <div className="mt-3 rounded-lg bg-muted/50 p-3.5 text-sm leading-7 whitespace-pre-wrap text-start">
                {booking.details || <span className="text-muted-foreground">{t.noNotes}</span>}
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.stageSection}
                </h3>
                <Select value={booking.stage} onValueChange={value => onStageChange(booking, value as BookingStage)}>
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STAGE_ORDER.map(stage => (
                      <SelectItem key={stage} value={stage}>
                        {stageLabel(stage, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {BOOKING_STAGE_ORDER.map((stage, index) => (
                  <span
                    key={stage}
                    className={`h-1.5 flex-1 rounded-full ${
                      index <= BOOKING_STAGE_ORDER.indexOf(booking.stage) ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.stageHint}</p>
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t.paymentSection}
              </h3>
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm text-muted-foreground">{t.colAmount}</span>
                <AmountCell booking={booking} t={t} onSaved={onChanged} />
              </div>
              {booking.paymentReference && (
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-sm text-muted-foreground">{t.ref}</span>
                  <span className="font-mono text-sm" dir="ltr">
                    {booking.paymentReference}
                  </span>
                </div>
              )}
              <PaymentActions booking={booking} t={t} onChanged={onChanged} />
            </section>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-card p-3.5 sm:p-4 text-start transition-colors ${
        onClick ? "hover:border-primary/40 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground truncate">{label}</span>
        <span className={`size-8 shrink-0 rounded-lg grid place-items-center ${tone}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold font-display tabular-nums leading-none">{value}</p>
    </Wrapper>
  );
}

type PaymentFilter = "all" | BookingRow["paymentStatus"];

function BookingsPanel({ t, lang, themeClass }: { t: Dict; lang: Lang; themeClass: string }) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const statusFilters: Array<{ value: "all" | BookingStatus; label: string }> = [
    { value: "all", label: t.allBookings },
    { value: "new", label: t.stNew },
    { value: "contacted", label: t.stContacted },
    { value: "closed", label: t.stClosed },
  ];

  const filterArgs = {
    status: search || statusFilter === "all" ? undefined : statusFilter,
    paymentStatus: search || paymentFilter === "all" ? undefined : paymentFilter,
    search: search || undefined,
  };

  const statsQuery = trpc.adminBookings.stats.useQuery();
  const listQuery = trpc.adminBookings.list.useQuery(
    { ...filterArgs, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { placeholderData: previous => previous },
  );

  const invalidate = () => {
    utils.adminBookings.list.invalidate();
    utils.adminBookings.stats.invalidate();
  };

  const updateStatusMutation = trpc.adminBookings.updateStatus.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(t.updateStatusFail, { description: error.message }),
  });
  const changeStatus = (booking: BookingRow, status: BookingStatus) =>
    updateStatusMutation.mutate({ publicId: booking.publicId, status });

  const stageMutation = trpc.adminBookings.setStage.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(t.updateStatusFail, { description: error.message }),
  });
  const changeStage = (booking: BookingRow, stage: BookingStage) =>
    stageMutation.mutate({ publicId: booking.publicId, stage });

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
  const openBooking = bookings.find(b => b.publicId === openId) ?? null;
  const stats = statsQuery.data;
  const awaiting = stats?.byPaymentStatus.awaiting_review ?? 0;

  const showPayment = (filter: PaymentFilter) => {
    setPaymentFilter(filter);
    setStatusFilter("all");
    setSearchInput("");
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-5">
      {awaiting > 0 && paymentFilter !== "awaiting_review" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
          </span>
          <p className="flex-1 text-sm">{t.attention(awaiting)}</p>
          <Button size="sm" variant="outline" onClick={() => showPayment("awaiting_review")}>
            {t.review}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t.totalBookings} value={stats?.total ?? 0} icon={Inbox} tone="bg-primary/12 text-primary" />
        <KpiCard
          label={t.kpiNeedsContact}
          value={stats?.byStatus.new ?? 0}
          icon={CalendarClock}
          tone={STATUS_TONE.new}
          onClick={() => {
            setStatusFilter("new");
            setPaymentFilter("all");
            setPage(0);
          }}
        />
        <KpiCard
          label={t.kpiAwaiting}
          value={awaiting}
          icon={Hourglass}
          tone={PAYMENT_TONE.awaiting_review}
          onClick={() => showPayment("awaiting_review")}
        />
        <KpiCard
          label={t.payPaid}
          value={stats?.byPaymentStatus.paid ?? 0}
          icon={BadgeCheck}
          tone={PAYMENT_TONE.paid}
          onClick={() => showPayment("paid")}
        />
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
          <div className="relative sm:w-72">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder={t.searchBooking}
              className="ps-9"
              dir={t.dir}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              disabled={Boolean(search)}
              onValueChange={value => {
                setStatusFilter(value as "all" | BookingStatus);
                setPage(0);
              }}
            >
              <SelectTrigger className="flex-1 sm:w-40">
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
            <Button variant="outline" onClick={handleExport} disabled={exporting || bookings.length === 0}>
              <FileText className="size-4" />
              <span className="hidden sm:inline">{t.exportPdf}</span>
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
        </div>

        {paymentFilter !== "all" && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-muted/40 text-sm">
            <span>
              {t.filteredBy}: <Pill tone={PAYMENT_TONE[paymentFilter]}>{paymentLabel(paymentFilter, t)}</Pill>
            </span>
            <Button variant="ghost" size="sm" onClick={() => showPayment("all")}>
              {t.showAll}
            </Button>
          </div>
        )}

        {/* Desktop: a table whose rows open the full record. */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">{t.colClient}</TableHead>
                <TableHead>{t.colOrder}</TableHead>
                <TableHead>{t.colProject}</TableHead>
                <TableHead>{t.colAmount}</TableHead>
                <TableHead>{t.colPayment}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead className="pe-4 w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map(booking => (
                <TableRow
                  key={booking.publicId}
                  className="cursor-pointer"
                  onClick={() => setOpenId(booking.publicId)}
                >
                  <TableCell className="ps-4 py-3">
                    <div className="font-medium">{booking.name}</div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {booking.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs" dir="ltr">
                      {booking.publicId}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(booking.createdAt, lang)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{projectLabel(booking.projectType, t)}</div>
                    <div className="text-xs text-muted-foreground">{budgetLabels[booking.budget][lang]}</div>
                  </TableCell>
                  <TableCell className="tabular-nums" dir="ltr">
                    {booking.amountDue ? (
                      `${booking.amountDue} ${booking.currency}`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Pill tone={PAYMENT_TONE[booking.paymentStatus]}>{paymentLabel(booking.paymentStatus, t)}</Pill>
                  </TableCell>
                  <TableCell onClick={event => event.stopPropagation()}>
                    <StatusSelect booking={booking} t={t} onChange={status => changeStatus(booking, status)} />
                  </TableCell>
                  <TableCell className="pe-4" onClick={event => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setOpenId(booking.publicId)}
                        aria-label={t.details}
                        title={t.details}
                      >
                        <ChevronLeft className="size-4 ltr:rotate-180" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: one card per booking. */}
        <div className="md:hidden divide-y">
          {bookings.map(booking => (
            <button
              key={booking.publicId}
              type="button"
              onClick={() => setOpenId(booking.publicId)}
              className="w-full p-4 text-start active:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{booking.name}</div>
                  <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                    {booking.publicId}
                  </div>
                </div>
                <Pill tone={STATUS_TONE[booking.status]}>{statusLabel(booking.status, t)}</Pill>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground truncate">
                  {projectLabel(booking.projectType, t)} · {formatDate(booking.createdAt, lang)}
                </span>
                <Pill tone={PAYMENT_TONE[booking.paymentStatus]}>{paymentLabel(booking.paymentStatus, t)}</Pill>
              </div>
              {booking.amountDue && (
                <div className="mt-2 font-semibold tabular-nums" dir="ltr">
                  {booking.amountDue} {booking.currency}
                </div>
              )}
            </button>
          ))}
        </div>

        {bookings.length === 0 && !listQuery.isLoading && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="size-10 opacity-40" />
            <p className="text-sm">{t.noBookings}</p>
          </div>
        )}
        {listQuery.isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
            ))}
          </div>
        )}

        <div className="px-4 pb-4">
          <Pagination t={t} page={page} setPage={setPage} hasNextPage={hasNextPage} />
        </div>
      </Card>

      <BookingDetails
        booking={openBooking}
        t={t}
        lang={lang}
        themeClass={themeClass}
        onClose={() => setOpenId(null)}
        onChanged={invalidate}
        onStatusChange={changeStatus}
        onStageChange={changeStage}
      />
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
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
// ─────────────────────────── chat leads ───────────────────────────
type LeadRow = RouterOutputs["adminLeads"]["list"][number];
type LeadStatus = LeadRow["status"];

function LeadsPanel({ t, lang }: { t: Dict; lang: Lang }) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [page, setPage] = useState(0);

  const statsQuery = trpc.adminLeads.stats.useQuery();
  const listQuery = trpc.adminLeads.list.useQuery(
    { status: statusFilter === "all" ? undefined : statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { placeholderData: previous => previous },
  );
  const setStatus = trpc.adminLeads.setStatus.useMutation({
    onSuccess: () => {
      utils.adminLeads.list.invalidate();
      utils.adminLeads.stats.invalidate();
    },
    onError: error => toast.error(t.updateStatusFail, { description: error.message }),
  });

  const leads = listQuery.data ?? [];
  const stats = statsQuery.data;
  const topicLabel = (topic: LeadRow["topic"]) =>
    ({ new_site: t.topicNewSite, existing_issue: t.topicExisting, other: t.topicOther })[topic];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label={t.leadsTotal} value={stats?.total ?? 0} icon={MessagesSquare} tone="bg-primary/12 text-primary" />
        <KpiCard
          label={t.kpiNeedsContact}
          value={stats?.byStatus.new ?? 0}
          icon={CalendarClock}
          tone={STATUS_TONE.new}
          onClick={() => {
            setStatusFilter("new");
            setPage(0);
          }}
        />
        <KpiCard
          label={t.stContacted}
          value={stats?.byStatus.contacted ?? 0}
          icon={MessageCircle}
          tone={STATUS_TONE.contacted}
          onClick={() => {
            setStatusFilter("contacted");
            setPage(0);
          }}
        />
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b">
          <Select
            value={statusFilter}
            onValueChange={value => {
              setStatusFilter(value as "all" | LeadStatus);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allLeads}</SelectItem>
              {(["new", "contacted", "closed"] as const).map(status => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <ul className="divide-y">
          {leads.map(lead => (
            <li key={lead.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{topicLabel(lead.topic)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(lead.createdAt, lang)}</span>
                  {lead.emailStatus !== "sent" && (
                    <span className="text-[11px] text-amber-500">{t.leadEmailMissed}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span dir="ltr" className="font-mono">
                    {lead.phone}
                  </span>
                  {lead.clientEmail && <span dir="ltr">{lead.clientEmail}</span>}
                </div>
                {lead.note && <p className="text-sm leading-7 whitespace-pre-wrap">{lead.note}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Select
                  value={lead.status}
                  onValueChange={value => setStatus.mutate({ id: lead.id, status: value as LeadStatus })}
                >
                  <SelectTrigger size="sm" className="h-7 w-auto gap-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0">
                    <Pill tone={STATUS_TONE[lead.status]}>{statusLabel(lead.status, t)}</Pill>
                  </SelectTrigger>
                  <SelectContent>
                    {(["new", "contacted", "closed"] as const).map(status => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button asChild variant="ghost" size="icon" className="size-8" aria-label={t.call} title={t.call}>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="size-4" />
                  </a>
                </Button>
                <a
                  href={waLink(lead.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-grid place-items-center size-8 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  aria-label={t.whatsapp}
                  title={t.whatsapp}
                >
                  <MessageCircle className="size-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>

        {leads.length === 0 && !listQuery.isLoading && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <MessagesSquare className="size-10 opacity-40" />
            <p className="text-sm">{t.noLeads}</p>
          </div>
        )}

        <div className="px-4 pb-4">
          <Pagination t={t} page={page} setPage={setPage} hasNextPage={leads.length === PAGE_SIZE} />
        </div>
      </Card>
    </div>
  );
}

const navItems: Array<{
  id: Section;
  labelKey: "navBookings" | "navLeads" | "navFinance" | "navInvoices";
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "bookings", labelKey: "navBookings", icon: ClipboardList },
  { id: "leads", labelKey: "navLeads", icon: MessagesSquare },
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
    leads: { title: t.leadsTitle, sub: t.leadsSub },
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
          {accountName}
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
          {section === "bookings" && (
            <BookingsPanel t={t} lang={lang} themeClass={theme === "light" ? "admin-light" : ""} />
          )}
          {section === "leads" && <LeadsPanel t={t} lang={lang} />}
          {section === "finance" && <FinancePanel t={t} lang={lang} />}
          {section === "invoices" && <InvoicesPanel t={t} lang={lang} />}
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-card grid grid-cols-4">
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
    content = <LoginScreen t={prefs.t} onLoggedIn={() => meQuery.refetch()} />;
  } else {
    content = <DashboardShell accountName={meQuery.data.name} prefs={prefs} />;
  }

  return <div className={`${wrapperClass} min-h-screen bg-background text-foreground`}>{content}</div>;
}
