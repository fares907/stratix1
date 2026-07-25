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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { LogOut, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BookingRow = RouterOutputs["adminBookings"]["list"][number];
type BookingStatus = BookingRow["status"];
type LedgerRow = RouterOutputs["adminLedger"]["list"][number];

const accounts = [
  { id: "fares" as const, label: "فارس سامي" },
  { id: "youssef" as const, label: "يوسف تامر" },
];

const statusLabels: Record<BookingStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  closed: "مغلق",
};

const statusFilters: Array<{ value: "all" | BookingStatus; label: string }> = [
  { value: "all", label: "كل الحجوزات" },
  { value: "new", label: "جديد" },
  { value: "contacted", label: "تم التواصل" },
  { value: "closed", label: "مغلق" },
];

const projectTypeLabels: Record<BookingRow["projectType"], string> = {
  company: "موقع شركة",
  personal: "موقع شخصي",
  other: "فكرة أخرى",
};

const budgetLabels: Record<BookingRow["budget"], string> = {
  "700-1500": "700 — 1,500 ج.م",
  "1500-3000": "1,500 — 3,000 ج.م",
  "3000+": "أكثر من 3,000 ج.م",
};

const emailStatusLabels: Record<BookingRow["emailStatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "تم الإرسال", variant: "secondary" },
  pending: { label: "قيد الإرسال", variant: "outline" },
  failed: { label: "فشل الإرسال", variant: "destructive" },
  not_configured: { label: "غير مُفعّل", variant: "outline" },
};

const PAGE_SIZE = 20;
const LEDGER_PAGE_SIZE = 20;

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("ar-EG", {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م`;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [accountId, setAccountId] = useState<"fares" | "youssef">("fares");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: () => {
      setPassword("");
      onLoggedIn();
    },
    onError: error => {
      toast.error("تعذر تسجيل الدخول", { description: error.message });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-display" dir="ltr">
            STRATIX <span className="text-muted-foreground text-sm">/ لوحة التحكم</span>
          </CardTitle>
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
                  className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                    accountId === account.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent hover:bg-accent"
                  }`}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <Input
              type="password"
              placeholder="كلمة السر"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" disabled={loginMutation.isPending || !password}>
              {loginMutation.isPending ? "جارٍ الدخول…" : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold font-display">{value}</p>
      </CardContent>
    </Card>
  );
}

function MoneyStatCard({ label, income, expense, net }: { label: string; income: number; expense: number; net: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={`text-2xl font-semibold font-display ${net >= 0 ? "text-emerald-500" : "text-destructive"}`}>
          {formatMoney(net)}
        </p>
        <p className="text-xs text-muted-foreground">
          دخل {formatMoney(income)} — مصروف {formatMoney(expense)}
        </p>
      </CardContent>
    </Card>
  );
}

function BookingsPanel() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const statsQuery = trpc.adminBookings.stats.useQuery();
  const listQuery = trpc.adminBookings.list.useQuery({
    // A search should find the booking regardless of the status filter —
    // otherwise a stale filter silently hides matches and search looks broken.
    status: search || statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const updateStatusMutation = trpc.adminBookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.adminBookings.list.invalidate();
      utils.adminBookings.stats.invalidate();
    },
    onError: error => toast.error("تعذر تحديث الحالة", { description: error.message }),
  });

  const bookings = listQuery.data ?? [];
  const hasNextPage = bookings.length === PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            listQuery.refetch();
            statsQuery.refetch();
          }}
          aria-label="تحديث"
        >
          <RefreshCw className={listQuery.isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الحجوزات" value={statsQuery.data?.total ?? 0} />
        <StatCard label="جديد" value={statsQuery.data?.byStatus.new ?? 0} />
        <StatCard label="تم التواصل" value={statsQuery.data?.byStatus.contacted ?? 0} />
        <StatCard label="مغلق" value={statsQuery.data?.byStatus.closed ?? 0} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-3 space-y-0">
          <CardTitle>الحجوزات</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="ابحث برقم الطلب أو الهاتف"
                className="w-56 pr-8"
                dir="rtl"
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
              <SelectTrigger className="w-44" title={search ? "البحث بيشمل كل الحالات" : undefined}>
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الميزانية</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead>حالة البريد</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map(booking => (
                <TableRow key={booking.publicId}>
                  <TableCell className="font-mono text-xs" dir="ltr">{booking.publicId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(booking.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{booking.name}</TableCell>
                  <TableCell dir="ltr">
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
                  <TableCell>{projectTypeLabels[booking.projectType]}</TableCell>
                  <TableCell>{budgetLabels[booking.budget]}</TableCell>
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
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statusLabels) as BookingStatus[]).map(status => (
                          <SelectItem key={status} value={status}>
                            {statusLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {bookings.length === 0 && !listQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    لا توجد حجوزات في هذا التصنيف.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(current => Math.max(0, current - 1))}
            >
              السابق
            </Button>
            <span className="text-xs text-muted-foreground">صفحة {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => setPage(current => current + 1)}
            >
              التالي
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

function AddLedgerEntryForm({ onCreated }: { onCreated: () => void }) {
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
    onError: error => toast.error("تعذر إضافة الحركة", { description: error.message }),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
          toast.error("اكتب مبلغاً صحيحاً");
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
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="income">دخل</SelectItem>
          <SelectItem value="expense">مصروف</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="المبلغ"
        value={amount}
        onChange={event => setAmount(event.target.value)}
        className="w-32"
        required
      />
      <Input
        type="text"
        placeholder="وصف الحركة (مثال: دفعة مشروع فلان)"
        value={note}
        onChange={event => setNote(event.target.value)}
        className="w-64"
        required
      />
      <Input
        type="date"
        value={date}
        onChange={event => setDate(event.target.value)}
        className="w-40"
        required
      />
      <Button type="submit" disabled={createMutation.isPending}>
        <Plus /> إضافة
      </Button>
    </form>
  );
}

function FinancePanel() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);

  const statsQuery = trpc.adminLedger.stats.useQuery();
  const listQuery = trpc.adminLedger.list.useQuery({
    limit: LEDGER_PAGE_SIZE,
    offset: page * LEDGER_PAGE_SIZE,
  });

  const invalidateAll = () => {
    utils.adminLedger.list.invalidate();
    utils.adminLedger.stats.invalidate();
  };

  const removeMutation = trpc.adminLedger.remove.useMutation({
    onSuccess: invalidateAll,
    onError: error => toast.error("تعذر حذف الحركة", { description: error.message }),
  });

  const entries = listQuery.data ?? [];
  const hasNextPage = entries.length === LEDGER_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MoneyStatCard
          label="آخر شهر"
          income={statsQuery.data?.thisMonth.income ?? 0}
          expense={statsQuery.data?.thisMonth.expense ?? 0}
          net={statsQuery.data?.thisMonth.net ?? 0}
        />
        <MoneyStatCard
          label="هذا العام"
          income={statsQuery.data?.thisYear.income ?? 0}
          expense={statsQuery.data?.thisYear.expense ?? 0}
          net={statsQuery.data?.thisYear.net ?? 0}
        />
        <MoneyStatCard
          label="آخر 6 شهور"
          income={statsQuery.data?.last6Months.income ?? 0}
          expense={statsQuery.data?.last6Months.expense ?? 0}
          net={statsQuery.data?.last6Months.net ?? 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مؤشر آخر 6 شهور</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              income: { label: "دخل", color: "oklch(0.7 0.16 150)" },
              expense: { label: "مصروف", color: "oklch(0.62 0.22 28)" },
            }}
            className="h-64 w-full"
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
          <CardTitle>الحركات المالية</CardTitle>
          <AddLedgerEntryForm onCreated={invalidateAll} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>بواسطة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: LedgerRow) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(entry.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.type === "income" ? "secondary" : "destructive"}>
                      {entry.type === "income" ? "دخل" : "مصروف"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatMoney(Number(entry.amount))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.note}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {accounts.find(account => account.id === entry.createdBy)?.label ?? entry.createdBy}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeMutation.mutate({ id: entry.id })}
                      aria-label="حذف"
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && !listQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    لا توجد حركات مسجلة بعد.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(current => Math.max(0, current - 1))}
            >
              السابق
            </Button>
            <span className="text-xs text-muted-foreground">صفحة {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => setPage(current => current + 1)}
            >
              التالي
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardShell({ accountName }: { accountName: string }) {
  const utils = trpc.useUtils();
  const logoutMutation = trpc.adminAuth.logout.useMutation({
    onSuccess: () => {
      utils.adminAuth.me.setData(undefined, null);
    },
  });

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-6" dir="rtl">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display" dir="ltr">STRATIX</h1>
          <p className="text-sm text-muted-foreground">لوحة التحكم — أهلاً {accountName}</p>
        </div>
        <Button variant="outline" onClick={() => logoutMutation.mutate()}>
          <LogOut /> تسجيل الخروج
        </Button>
      </header>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">الحجوزات</TabsTrigger>
          <TabsTrigger value="finance">الحسابات</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-4">
          <BookingsPanel />
        </TabsContent>
        <TabsContent value="finance" className="mt-4">
          <FinancePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Admin() {
  const meQuery = trpc.adminAuth.me.useQuery();

  if (meQuery.isLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!meQuery.data) {
    return <LoginScreen onLoggedIn={() => meQuery.refetch()} />;
  }

  return <DashboardShell accountName={meQuery.data.name} />;
}
