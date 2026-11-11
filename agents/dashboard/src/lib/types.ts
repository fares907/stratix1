export type AgentStatus = "active" | "paused" | "fired";

export interface Agent {
  id: string;
  name: string;
  title: string;
  department: string;
  status: AgentStatus;
  primary_model: string;
  fallback_model: string;
  tools: string[];
  duties: string[];
  instructions: string;
  sensitive: boolean;
}

export interface Message {
  id: number;
  agent_id: string | null;
  meeting_id: number | null;
  reply_to: number | null;
  author?: string | null; // "chairman" لو رئيس مجلس الإدارة هو اللي اتكلم
  kind: "speech" | "objection" | "decision" | "activity" | "error";
  content: string;
  reasoning: string | null;
  confidence: "high" | "medium" | "low" | null;
  unknowns: string[] | null;
  model_key: string | null;
  used_fallback: boolean | null;
  created_at: string;
}

export interface Approval {
  id: number;
  agent_id: string;
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
  reasons: string[];
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  decision_note: string | null;
  created_at: string;
}

export interface Lead {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  social_url: string | null;
  lat: number | null;
  lon: number | null;
  status: string;
  priority: number | null;
  created_at: string;
}

export interface ModelInfo {
  key: string;
  provider: string;
  model_id: string;
  rpm: number;
  rpd: number;
  trains_on_free_data: boolean;
}

export const DEPARTMENTS: Record<string, string> = {
  management: "الإدارة",
  sales: "المبيعات",
  operations: "العمليات",
  site: "الموقع والأمان",
  dev: "التطوير",
};

// الأدوات اللي الكود بيعرفها. الصلاحية اللي مش هنا مالهاش أي أثر.
export const TOOLS: Record<string, string> = {
  read_all: "يقرا كل حاجة",
  assign_task: "يوزّع مهام",
  request_approval: "يطلب موافقة",
  write_report: "يكتب التقرير",
  osm_search: "يبحث في الخريطة",
  write_leads: "يضيف عملاء محتملين",
  read_leads: "يقرا العملاء المحتملين",
  update_leads: "يعدّل العملاء المحتملين",
  web_check: "يفحص مواقع",
  draft_message: "يكتب مسودة رسالة",
  send_message: "يبعت رسايل",
  read_inbox: "يقرا الإيميلات الواردة",
  view_finance: "📊 لوحة الموقع: الحسابات والفواتير",
  view_bookings: "📊 لوحة الموقع: الحجوزات والمشاريع",
  view_contacts: "📊 لوحة الموقع: طلبات التواصل والشات",
  view_stats: "📊 لوحة الموقع: الإحصائيات",
  read_repo: "يقرا كود الموقع",
  read_infra: "يقرا الاشتراكات والبنية",
  open_pull_request: "يفتح Pull Request",
  comment_pull_request: "يعلّق على Pull Request",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  active: "شغّال",
  paused: "موقوف مؤقتًا",
  fired: "اتقال",
};
