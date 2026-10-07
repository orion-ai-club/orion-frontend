export interface BlogPost {
  _id: string;
  name: string;
  info: string;
  author: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  createdDate?: string; // Legacy
  updatedDate?: string; // Legacy
  date?: string; // Legacy
  likes: number;
  image: string;
  content?: string;
  isPrivate?: boolean;
  iframeUrl?: string;
  user?: User;
}

export interface Tag {
  name: string;
  count: number;
}

export interface Photo {
  _id: string;
  url: string;
  name?: string; // Backend field
  caption?: string; // Legacy support
  createdDate?: string; // Backend field
  date?: string; // Legacy support
  location?: string;
  order?: number;
}

export interface Role {
  _id: string;
  name: string;
  permissions: string[];
  description?: string;
  updatedAt?: string;
}

export interface Permission {
  _id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  createdAt?: string;
}

export enum UserRole {
  SuperAdmin = 'super_admin',
  Admin = 'admin',
  User = 'user',
  Bot = 'bot'
}

export interface User {
  _id: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  token?: string;
  vip?: boolean;
  private_token?: string;
  date?: string;
  // 🔥🔥🔥 New: Fitness Goal & Height
  fitnessGoal?: 'cut' | 'bulk' | 'maintain';
  height?: number; // cm
  // 🔔 New: Notification & Settings
  barkUrl?: string;
  timezone?: string;
  // 🛡️ Role Management
  role?: 'user' | 'admin' | 'super_admin' | 'bot' | string; // Allow custom roles
  // 🔐 Permissions
  permissions?: string[];
}

// --- PERMISSIONS CONFIG ---
// Keys matched to backend logic module:action
export const PERM_KEYS = {
  // --- User / Public ---
  BLOG_COMMENT: 'BLOG:INTERACT',
  BLOG_MANAGE: 'BLOG:MANAGE',
  RESUME_USE: 'RESUME:USE',
  RESUME_UPDATE: 'RESUME:UPDATE',
  // --- Private Space Modules ---
  PRIVATE_ACCESS: 'PRIVATE_DOMAIN:ACCESS', // Gatekeeper for Captain's Cabin

  BRAIN_USE: 'BRAIN:USE', // Second Brain
  JOURNAL_USE: 'JOURNAL_SPACE:USE', // View/Manage Journals (renamed from JOURNAL_READ)
  LEISURE_USE: 'LEISURE:USE', // Leisure Space (Mahjong, Games)
  CAPSULE_USE: 'CAPSULE:USE', // Photo Gallery (renamed from GALLERY_VIEW)
  FITNESS_USE: 'FITNESS:USE', // Fitness Tracker

  // --- Sub-features ---
  TODO_USE: 'TODO:USE', // Bucket List / Todos
  MENU_USE: 'MENU:USE', // AI Chef
  PERIOD_USE: 'PERIOD:USE', // Period Tracker
  FOOTPRINT_USE: 'FOOTPRINT:USE', // Footprint (renamed from FOOTPRINT_view)

  // --- System / Admin ---
  SYSTEM_ACCESS: 'SYSTEM_LOGS:USE', // Access System Management (using logs key as proxy for now)
  SYSTEM_LOGS: 'SYSTEM_LOGS:USE', // View Audit Logs
  USER_UPDATE_SELF: 'USER:UPDATE_SELF',

  // Admin Specific (Legacy or Specific)
  USER_MANAGE: 'system:users', // Keep legacy for now if not in list, or map to closest
  ROLE_MANAGE: 'system:roles',
  PERM_MANAGE: 'system:perms'
};

/**
 * Check if a user has a specific permission.
 * Logic:
 * 1. Super Admin role has all permissions.
 * 2. Wildcard '*' permission grants everything.
 * 3. Exact key match (case-insensitive).
 */
export const can = (user: User | null | undefined, permission: string): boolean => {
  if (!user) return false;

  // 1. Role-based Super Admin Override
  if (user.role === UserRole.SuperAdmin) return true;

  // 2. Check Permission Array
  if (!user.permissions || !Array.isArray(user.permissions)) return false;

  // 3. Wildcard Check
  if (user.permissions.includes('*')) return true;

  // 4. Exact Match (Case-insensitive)
  const target = permission.toLowerCase();
  return user.permissions.some((p) => p.toLowerCase() === target);
};

export interface AuditLog {
  _id: string;
  action: string;
  target: string;
  targetId?: string;
  operator?: User;
  details?: any;
  createdDate: string;
  ipAddress?: string;
  status?: string;
  message?: string; // From socket event
}

export interface PermissionRequest {
  _id: string;
  user: User;
  permission: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt: string;
}

export interface Project {
  _id: string;
  name: string;
  info: string;
  link: string;
  image: string;
  likes?: number;
}

// New Portfolio Project Model
export type PortfolioProjectCategory = 'web' | 'fullstack' | 'mobile' | 'tools';

export interface PortfolioProject {
  _id: string;
  title_zh: string;
  title_en: string;
  summary_zh?: string;
  summary_en?: string;
  description_zh?: string;
  description_en?: string;
  techStack: string[];
  repoUrl?: string;
  demoUrl?: string;
  coverImage?: string;
  iconImage?: string;
  category?: PortfolioProjectCategory; // Legacy primary category
  categories?: PortfolioProjectCategory[];
  order: number;
  isVisible: boolean;
  createdAt: string;
}

export interface PortfolioImportProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface PortfolioImportPreview {
  project: Partial<PortfolioProject>;
  coverSvg?: string;
  coverDataUrl?: string;
  iconDataUrl?: string;
  source: {
    owner: string;
    repo: string;
    private: boolean;
    description?: string;
    iconPath?: string;
    readmeBacked?: boolean;
  };
}

export interface PortfolioAiCoverResponse {
  dataUrl: string;
  mimeType: 'image/jpeg' | string;
  model: string;
  provider: 'cloudflare' | string;
}

export interface ResumeItem {
  _id: string;
  title: string;
  _title?: string;
  info: string;
  _info?: string;
  degree?: string;
  url?: string;
}

// New Resume Model
export interface ResumeData {
  _id: string;
  slug?: string;
  user?: string;
  title?: string;
  isHomepage?: boolean;
  sectionOrder?: string[];
  basics: {
    name_zh?: string;
    name_en?: string;
    label_zh?: string;
    label_en?: string;
    email?: string;
    phone?: string;
    location_zh?: string;
    location_en?: string;
    visaStatus_zh?: string;
    visaStatus_en?: string;
    summary_zh?: string;
    summary_en?: string;
    website?: string;
    linkedin?: string;
  };
  education: Array<{
    institution?: string;
    location?: string;
    area_zh?: string;
    area_en?: string;
    studyType_zh?: string;
    studyType_en?: string;
    startDate?: string;
    endDate?: string;
    score_zh?: string;
    score_en?: string;
    pageBreakBefore?: boolean;
  }>;
  work: Array<{
    company_zh?: string;
    company_en?: string;
    position_zh?: string;
    position_en?: string;
    location_zh?: string; // New
    location_en?: string; // New
    startDate?: string;
    endDate?: string;
    weight?: number; // Weight for sorting (higher ranks first)
    isProject?: boolean;
    highlights_zh?: string[];
    highlights_en?: string[];
    pageBreakBefore?: boolean;
  }>;
  volunteer?: Array<{
    organization_zh?: string;
    organization_en?: string;
    position_zh?: string;
    position_en?: string;
    startDate?: string;
    endDate?: string;
    highlights_zh?: string[];
    highlights_en?: string[];
    pageBreakBefore?: boolean;
  }>;
  interest?: Array<{
    name_zh?: string;
    name_en?: string;
    keywords?: string[];
    pageBreakBefore?: boolean;
  }>;
  skills: Array<{
    name_zh?: string;
    name_en?: string;
    keywords: string[];
    pageBreakBefore?: boolean;
  }>;
  languages: Array<{
    language_zh?: string;
    language_en?: string;
    fluency_zh?: string;
    fluency_en?: string;
  }>;
  styleSettings?: {
    fontSize?: 'small' | 'normal' | 'large';
    lineHeight?: 'compact' | 'normal' | 'relaxed';
    themeColor?: 'amber' | 'emerald' | 'sky' | 'crimson' | 'slate';
    margin?: 'small' | 'normal' | 'large';
    sectionGap?: 'compact' | 'normal' | 'relaxed';
    pdfMode?: 'single-page' | 'multi-page';
    paperSize?: 'a4' | 'a3' | 'a5';
    customStyles?: Record<
      string,
      {
        fontSize?: string;
        fontWeight?: string;
        color?: string;
      }
    >;
  };
  pageLimit?: number;
  sectionTitles?: {
    profile_zh?: string;
    profile_en?: string;
    work_zh?: string;
    work_en?: string;
    projects_zh?: string;
    projects_en?: string;
    education_zh?: string;
    education_en?: string;
    skills_zh?: string;
    skills_en?: string;
    volunteer_zh?: string;
    volunteer_en?: string;
    interest_zh?: string;
    interest_en?: string;
  };
}

export interface Log {
  _id: string;
  version: string;
  date: string;
  content: string;
}

export interface Reply {
  id: string;
  user: User;
  content: string;
  date: string;
  photoURL?: string;
  targetUser?: User;
}

export interface Comment {
  _id: string;
  id: string;
  user: User;
  comment: string;
  date: string;
  photoURL?: string;
  reply: Reply[];
  _postid: string;
  _userid?: string;
}

export interface BarkConfig {
  sound?: string;
  level?: 'active' | 'timeSensitive' | 'passive' | 'critical';
  icon?: string;
  url?: string;
  image?: string;
}

// Updated Bucket List / Todo Model
export interface Todo {
  _id: string;
  todo: string; // The Title
  description?: string;
  status?: 'todo' | 'in_progress' | 'done';
  type?: 'wish' | 'routine'; // New Type Field
  isActive?: boolean; // 🔥 New: Routine active state
  images?: string[];
  targetDate?: string;
  remindAt?: string; // 🔥 New: Routine reminder time
  recurrence?: string; // 🔥 New: Routine recurrence rule
  notifyUsers?: string[] | User[]; // 🔥 New: Users to notify
  bark?: BarkConfig; // 🔥 New: Bark config
  order?: number;
  done: boolean; // Legacy field for compatibility
  timestamp: number | string;
  create_date?: string;
  complete_date?: string;
  user?: User; // Added user field
}

// Period / Cycle Types
export interface PeriodRecord {
  _id?: string;
  startDate: string; // ISO Date String
  endDate?: string; // ISO Date String
  duration?: number;
  cycleLength?: number;
  symptoms?: string[];
  flow?: 'light' | 'medium' | 'heavy';
  note?: string;
  color?: string; // New field for period blood color code
  operator?: string; // ID of the user who logged this record
}

export interface PeriodResponse {
  records: PeriodRecord[];
  avgCycle: number;
  avgDuration: number;
  lastStart: string;
  prediction: {
    nextPeriodStart: string;
    ovulationDate: string;
    fertileWindow: {
      start: string;
      end: string;
    };
    desc: string;
  };
}

// Fitness Types (Refactored)
export interface FitnessBody {
  weight?: number; // kg
  bmi?: number;
}

export interface FitnessWorkout {
  isDone: boolean;
  duration?: number; // min
  types?: string[]; // Array of strings e.g. ["Running", "Chest"]
  note?: string;
}

export interface FitnessDiet {
  content?: string; // "Bread for breakfast..."
  water?: number; // ml or cups
}

export interface FitnessStatus {
  mood?: 'happy' | 'neutral' | 'bad';
  sleepHours?: number;
}

export interface FitnessSupplements {
  protein: boolean;
  vitamins: boolean;
  details?: string;
}

export interface FitnessRecord {
  _id?: string;
  user?: User | string; // Can be ID or populated object
  date?: string;
  dateStr?: string; // YYYY-MM-DD
  body?: FitnessBody;
  workout?: FitnessWorkout;
  diet?: FitnessDiet; // Changed from nutrition
  supplements?: FitnessSupplements; // New field
  status?: FitnessStatus; // New field
  photos?: string[];
  targetUserEmail?: string; // For submission only
}

export interface FitnessStats {
  dates: string[];
  weights: (number | null)[];
  bmis: (number | null)[]; // Added BMI
  durations: number[];
  water: (number | null)[];
  sleep: (number | null)[];
}

// --- Footprint (Map/Travel) Types ---
export interface FootprintLocation {
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  name: string; // POI name
  address?: string;
  coordinates: [number, number]; // [lng, lat]
  adcode?: string;
}

export interface Footprint {
  _id: string;
  user: User;
  location: FootprintLocation;
  content?: string;
  images?: string[];
  rating?: number;
  mood?: 'happy' | 'excited' | 'peaceful' | 'tired' | 'sad' | 'romantic' | 'adventurous';
  cost?: number;
  visitDate: string;
  status: 'visited' | 'planned';
  isHighlight?: boolean;
}

export interface FootprintStats {
  totalCount: number;
  countries: string[];
  provinces: string[];
  citiesCount: number;
}

// --- Menu / Chef's Wheel Types ---
export interface Menu {
  _id: string;
  name: string;
  category: string; // '午餐', '晚餐', etc.
  tags: string[];
  image?: string;
  timesEaten: number;
  lastEaten?: string;
  isActive: boolean;
  weight: number; // 1-10
  caloriesLevel: 'low' | 'medium' | 'high';
  createdAt?: string;
}

export interface DrawResponse {
  winner: Menu;
  pool: Menu[];
  meta: any;
}

// --- Smart Menu Recommendation Types ---
export interface SmartMenuDish {
  name: string;
  tags: string[];
  calories_estimate: string;
  reason: string;
}

export interface SmartMenuResponse {
  success: boolean;
  based_on: {
    weight: number | null;
    goal: string;
    source: 'fitness_record' | 'user_profile';
  };
  recommendation: {
    nutrition_advice: string;
    dishes: SmartMenuDish[];
  };
}

// --- Hot Search & News Types ---
export interface HotSearchItem {
  title: string;
  url: string;
  hot?: string;
  googleUrl?: string; // Backend provides googleUrl
  index?: number;
}

// Unified API Response
export type DailyListType = 'hotsearch' | 'finance' | 'game' | 'guonei' | 'world';

export interface DailyListResponse {
  type: DailyListType;
  date: string;
  list: HotSearchItem[];
  source: string;
}

// Keeping aliases for compatibility if needed, but implementation uses DailyListResponse
export type HotSearchResponse = DailyListResponse;
export type FinanceNewsResponse = DailyListResponse;

// --- Cloudinary Usage Types ---
export interface CloudinaryUsage {
  plan: string;
  last_updated: string;
  transformations: { usage: number; credits_usage: number };
  objects: { usage: number };
  bandwidth: { usage: number; credits_usage: number };
  storage: { usage: number; credits_usage: number };
  credits: { usage: number; limit: number; used_percent: number };
  requests: number;
  resources: number;
  derived_resources: number;
}

// --- R2 Usage Types ---
export interface R2UsageStats {
  total: { count: number; size: number; sizeFormatted: string };
  resources: { count: number; size: number; sizeFormatted: string };
  backups: { count: number; size: number; sizeFormatted: string };
  others: { count: number; size: number; sizeFormatted: string };
  percentages: { resources: string; backups: string; others: string };
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

export type Language = 'en' | 'zh' | 'fr' | 'zh-HK' | 'ja' | 'ru' | 'de' | 'es';

// Used mostly for Header Highlighting logic now
export enum PageView {
  HOME = 'HOME',
  BLOG = 'BLOG',
  ARTICLE = 'ARTICLE',
  RESUME = 'RESUME', // Now maps to PortfolioPage
  PRIVATE_SPACE = 'PRIVATE_SPACE',
  PROFILE = 'PROFILE',
  SETTINGS = 'SETTINGS',
  SYSTEM = 'SYSTEM', // New System Management Page
  CHAT = 'CHAT',
  AUDIT_LOG = 'AUDIT_LOG',
  ARCHIVES = 'ARCHIVES', // Deprecated, but keeping enum to avoid breaks if any
  FOOTPRINT = 'FOOTPRINT' // New Page
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationData;
}

// Chat Types
export interface ChatUser {
  id: string;
  name: string;
  email?: string;
  socketId?: string;
}

export interface ChatMessage {
  message: string;
  author: string;
  userId?: string;
  email?: string;
  photoURL?: string;
  room?: string;
  timestamp?: string;
  isPrivate?: boolean;
  isSystem?: boolean;
  receiver?: string;
}

// --- AI Conversation Types ---
export interface Conversation {
  _id?: string; // Mongo ID
  sessionId: string; // UUID
  title: string;
  user: string;
  lastActiveAt: string;
  isTitleAutoGenerated?: boolean;
}
