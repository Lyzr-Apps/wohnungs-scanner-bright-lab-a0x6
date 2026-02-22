'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { listSchedules, getScheduleLogs, pauseSchedule, resumeSchedule, triggerScheduleNow, cronToHuman } from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search, Home, SlidersHorizontal, ListFilter, Heart, History, Settings, ChevronLeft, ChevronRight,
  Loader2, Play, Pause, Clock, Building2, MapPin, ExternalLink, X, Bell,
  CheckCircle2, XCircle, Activity, Zap, Mail, Send, RefreshCw, Calendar,
  Star, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp, Menu, Radio, CircleDot
} from 'lucide-react'

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const SEARCH_AGENT_ID = '699b6ac231859b031052a62c'
const MATCH_AGENT_ID = '699b6b030263953e570d7a45'
const SEARCH_SCHEDULE_ID = '699b6aca399dfadeac385562'
const MATCH_SCHEDULE_ID = '699b6b0c399dfadeac38558c'

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface Listing {
  id: string
  title: string
  cold_rent: number
  warm_rent: number
  size_sqm: number
  rooms: number
  address: string
  district: string
  availability: string
  features: string[]
  image_urls: string[]
  portal: string
  listing_url: string
  contact_info: string
  match_score?: number
  score_breakdown?: {
    price_score: number
    size_score: number
    location_score: number
    rooms_score: number
    features_score: number
  }
  category?: string
  listing_id?: string
}

interface SearchSummary {
  portals_scanned: number
  total_listings_found: number
  new_listings: number
  duplicates_filtered: number
  search_duration_seconds: number
  search_timestamp: string
}

interface SearchRun {
  id: string
  timestamp: string
  portals_scanned: number
  results_found: number
  new_listings: number
  status: 'success' | 'error' | 'running'
  listings?: Listing[]
}

interface SearchProfile {
  city: string
  districts: string[]
  radius: number
  size_min: number
  size_max: number
  max_rent: number
  rooms: number
  features: string[]
  portals: string[]
}

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const MOCK_LISTINGS: Listing[] = [
  {
    id: 'is24-kr-001', title: 'Helle 2-Zimmer-Wohnung mit Balkon in Kreuzberg',
    cold_rent: 850, warm_rent: 1050, size_sqm: 58, rooms: 2,
    address: 'Oranienstrasse 42, 10999 Berlin', district: 'Kreuzberg',
    availability: '01.04.2026', features: ['Balkon', 'Einbaukueche', 'Parkett'],
    image_urls: [], portal: 'ImmobilienScout24',
    listing_url: 'https://immobilienscout24.de/expose/kr001',
    contact_info: 'Hausverwaltung Mueller, Tel: 030-1234567',
    match_score: 94, score_breakdown: { price_score: 95, size_score: 90, location_score: 100, rooms_score: 100, features_score: 80 },
    category: 'top_match'
  },
  {
    id: 'wg-mi-002', title: 'Altbau-Traum in Mitte, 3 Zimmer',
    cold_rent: 1200, warm_rent: 1420, size_sqm: 78, rooms: 3,
    address: 'Torstrasse 115, 10119 Berlin', district: 'Mitte',
    availability: '15.03.2026', features: ['Einbaukueche', 'Parkett', 'Aufzug', 'Keller'],
    image_urls: [], portal: 'WG-Gesucht',
    listing_url: 'https://wg-gesucht.de/expose/mi002',
    contact_info: 'Immobilien GmbH Berlin, info@immogmbh.de',
    match_score: 91, score_breakdown: { price_score: 75, size_score: 95, location_score: 100, rooms_score: 85, features_score: 95 },
    category: 'top_match'
  },
  {
    id: 'iw-nk-003', title: 'Gemuetliche Wohnung in Neukoelln',
    cold_rent: 650, warm_rent: 820, size_sqm: 45, rooms: 2,
    address: 'Sonnenallee 78, 12045 Berlin', district: 'Neukoelln',
    availability: '01.05.2026', features: ['Einbaukueche', 'Laminat'],
    image_urls: [], portal: 'Immowelt',
    listing_url: 'https://immowelt.de/expose/nk003',
    contact_info: 'Privatvermieter Schulz, 0172-9876543',
    match_score: 82, score_breakdown: { price_score: 100, size_score: 70, location_score: 80, rooms_score: 100, features_score: 60 },
    category: 'good_match'
  },
  {
    id: 'is24-fh-004', title: 'Moderne 2-Zi-Wohnung Friedrichshain',
    cold_rent: 920, warm_rent: 1100, size_sqm: 55, rooms: 2,
    address: 'Boxhagener Strasse 22, 10245 Berlin', district: 'Friedrichshain',
    availability: '01.04.2026', features: ['Balkon', 'Einbaukueche', 'Aufzug'],
    image_urls: [], portal: 'ImmobilienScout24',
    listing_url: 'https://immobilienscout24.de/expose/fh004',
    contact_info: 'Wohnungsbaugesellschaft Ost, 030-5551234',
    match_score: 78, score_breakdown: { price_score: 80, size_score: 85, location_score: 75, rooms_score: 100, features_score: 70 },
    category: 'good_match'
  },
  {
    id: 'wg-pb-005', title: 'Charmante Altbauwohnung Prenzlauer Berg',
    cold_rent: 980, warm_rent: 1180, size_sqm: 65, rooms: 2.5,
    address: 'Kastanienallee 33, 10435 Berlin', district: 'Prenzlauer Berg',
    availability: '15.04.2026', features: ['Balkon', 'Parkett', 'Haustiere erlaubt', 'Keller'],
    image_urls: [], portal: 'WG-Gesucht',
    listing_url: 'https://wg-gesucht.de/expose/pb005',
    contact_info: 'Hausverwaltung Berg, hausverwaltung@berg.de',
    match_score: 88, score_breakdown: { price_score: 85, size_score: 88, location_score: 90, rooms_score: 90, features_score: 85 },
    category: 'good_match'
  },
  {
    id: 'iw-kr-006', title: 'Studio-Apartment Kreuzberg Naehe Goerlitzer Park',
    cold_rent: 600, warm_rent: 750, size_sqm: 35, rooms: 1,
    address: 'Wiener Strasse 10, 10999 Berlin', district: 'Kreuzberg',
    availability: '01.03.2026', features: ['Einbaukueche', 'Laminat'],
    image_urls: [], portal: 'Immowelt',
    listing_url: 'https://immowelt.de/expose/kr006',
    contact_info: 'Fr. Weber, 030-7778899',
    match_score: 55, score_breakdown: { price_score: 100, size_score: 40, location_score: 95, rooms_score: 30, features_score: 50 },
    category: 'medium_match'
  },
  {
    id: 'is24-mi-007', title: 'Loftartige 3-Zimmer-Wohnung Mitte',
    cold_rent: 1400, warm_rent: 1650, size_sqm: 85, rooms: 3,
    address: 'Rosenthaler Strasse 68, 10119 Berlin', district: 'Mitte',
    availability: '01.06.2026', features: ['Balkon', 'Einbaukueche', 'Parkett', 'Aufzug', 'Waschmaschinenanschluss'],
    image_urls: [], portal: 'ImmobilienScout24',
    listing_url: 'https://immobilienscout24.de/expose/mi007',
    contact_info: 'Loft Living GmbH, info@loftliving.de',
    match_score: 72, score_breakdown: { price_score: 50, size_score: 100, location_score: 90, rooms_score: 85, features_score: 95 },
    category: 'good_match'
  },
  {
    id: 'wg-nk-008', title: 'Hinterhof-Perle in Neukoelln',
    cold_rent: 700, warm_rent: 870, size_sqm: 48, rooms: 2,
    address: 'Weserstrasse 55, 12045 Berlin', district: 'Neukoelln',
    availability: '15.03.2026', features: ['Einbaukueche', 'Dielen'],
    image_urls: [], portal: 'WG-Gesucht',
    listing_url: 'https://wg-gesucht.de/expose/nk008',
    contact_info: 'Vermieter direkt: vermieter@email.de',
    match_score: 76, score_breakdown: { price_score: 95, size_score: 65, location_score: 75, rooms_score: 100, features_score: 55 },
    category: 'good_match'
  },
  {
    id: 'is24-fh-009', title: 'Sonnige Wohnung am Volkspark Friedrichshain',
    cold_rent: 780, warm_rent: 950, size_sqm: 52, rooms: 2,
    address: 'Danziger Strasse 88, 10405 Berlin', district: 'Friedrichshain',
    availability: '01.04.2026', features: ['Balkon', 'Einbaukueche'],
    image_urls: [], portal: 'ImmobilienScout24',
    listing_url: 'https://immobilienscout24.de/expose/fh009',
    contact_info: 'WBM, service@wbm.de',
    match_score: 85, score_breakdown: { price_score: 90, size_score: 80, location_score: 85, rooms_score: 100, features_score: 70 },
    category: 'good_match'
  },
  {
    id: 'iw-pb-010', title: 'Grosszuegige Familienwohnung Prenzlauer Berg',
    cold_rent: 1350, warm_rent: 1580, size_sqm: 82, rooms: 3.5,
    address: 'Schoenhauser Allee 152, 10435 Berlin', district: 'Prenzlauer Berg',
    availability: '01.05.2026', features: ['Balkon', 'Einbaukueche', 'Parkett', 'Aufzug', 'Keller', 'Haustiere erlaubt'],
    image_urls: [], portal: 'Immowelt',
    listing_url: 'https://immowelt.de/expose/pb010',
    contact_info: 'Gesobau AG, 030-40730',
    match_score: 68, score_breakdown: { price_score: 55, size_score: 95, location_score: 80, rooms_score: 70, features_score: 100 },
    category: 'medium_match'
  },
  {
    id: 'wg-kr-011', title: 'Zimmer in Kreuzberger WG',
    cold_rent: 450, warm_rent: 550, size_sqm: 18, rooms: 1,
    address: 'Adalbertstrasse 20, 10999 Berlin', district: 'Kreuzberg',
    availability: 'sofort', features: ['Einbaukueche'],
    image_urls: [], portal: 'WG-Gesucht',
    listing_url: 'https://wg-gesucht.de/expose/kr011',
    contact_info: 'Max, 0176-12345678',
    match_score: 42, score_breakdown: { price_score: 100, size_score: 10, location_score: 95, rooms_score: 20, features_score: 30 },
    category: 'no_match'
  },
  {
    id: 'is24-mi-012', title: 'Stilvolle 2-Zimmer nahe Hackescher Markt',
    cold_rent: 1100, warm_rent: 1300, size_sqm: 60, rooms: 2,
    address: 'Neue Schoenhauser Strasse 5, 10178 Berlin', district: 'Mitte',
    availability: '15.05.2026', features: ['Einbaukueche', 'Parkett', 'Aufzug'],
    image_urls: [], portal: 'ImmobilienScout24',
    listing_url: 'https://immobilienscout24.de/expose/mi012',
    contact_info: 'City Wohnen GmbH, 030-2345678',
    match_score: 96, score_breakdown: { price_score: 80, size_score: 92, location_score: 100, rooms_score: 100, features_score: 90 },
    category: 'top_match'
  }
]

const MOCK_SEARCH_RUNS: SearchRun[] = [
  { id: 'run-001', timestamp: '2026-02-22T14:00:00Z', portals_scanned: 3, results_found: 47, new_listings: 12, status: 'success' },
  { id: 'run-002', timestamp: '2026-02-22T08:00:00Z', portals_scanned: 3, results_found: 38, new_listings: 5, status: 'success' },
  { id: 'run-003', timestamp: '2026-02-22T02:00:00Z', portals_scanned: 3, results_found: 42, new_listings: 8, status: 'success' },
  { id: 'run-004', timestamp: '2026-02-21T20:00:00Z', portals_scanned: 2, results_found: 31, new_listings: 3, status: 'error' },
  { id: 'run-005', timestamp: '2026-02-21T14:00:00Z', portals_scanned: 3, results_found: 44, new_listings: 7, status: 'success' },
]

const DEFAULT_PROFILE: SearchProfile = {
  city: 'Berlin',
  districts: ['Kreuzberg', 'Mitte', 'Neukoelln', 'Friedrichshain', 'Prenzlauer Berg'],
  radius: 5,
  size_min: 40,
  size_max: 80,
  max_rent: 1200,
  rooms: 2,
  features: ['Balkon', 'Einbaukueche'],
  portals: ['ImmobilienScout24', 'WG-Gesucht', 'Immowelt']
}

const ALL_DISTRICTS = ['Kreuzberg', 'Mitte', 'Neukoelln', 'Friedrichshain', 'Prenzlauer Berg', 'Charlottenburg', 'Schoeneberg', 'Wedding', 'Tempelhof', 'Steglitz']
const ALL_FEATURES = ['Balkon', 'Einbaukueche', 'Parkett', 'Aufzug', 'Haustiere erlaubt', 'Keller', 'Waschmaschinenanschluss', 'Garten', 'Terrasse']
const ALL_PORTALS = ['ImmobilienScout24', 'WG-Gesucht', 'Immowelt']

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'hsl(160, 70%, 45%)'
  if (score >= 70) return 'hsl(220, 80%, 55%)'
  if (score >= 50) return 'hsl(35, 85%, 55%)'
  return 'hsl(220, 12%, 55%)'
}

function getScoreBorderClass(score: number): string {
  if (score >= 90) return 'border-l-4 border-l-green-500'
  if (score >= 70) return 'border-l-4 border-l-blue-500'
  if (score >= 50) return 'border-l-4 border-l-yellow-500'
  return 'border-l-4 border-l-gray-500'
}

function getPortalShort(portal: string): string {
  if (portal.includes('Scout')) return 'IS24'
  if (portal.includes('WG')) return 'WG-G'
  if (portal.includes('Immowelt')) return 'IW'
  return portal.slice(0, 4)
}

function formatTimestamp(ts: string): string {
  if (!ts) return '---'
  try {
    const d = new Date(ts)
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

// ---------------------------------------------------------------------------
// SVG Circular Score
// ---------------------------------------------------------------------------
function CircularScore({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)
  const glowClass = score >= 90 ? 'drop-shadow-[0_0_6px_hsl(160,70%,45%)]' : ''

  return (
    <div className={cn('relative inline-flex items-center justify-center', glowClass)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(220,15%,20%)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="absolute text-xs font-bold font-mono" style={{ color }}>{score}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LISTING CARD
// ---------------------------------------------------------------------------
function ListingCard({ listing, onSelect, onToggleFav, isFav }: { listing: Listing; onSelect: (l: Listing) => void; onToggleFav: (id: string) => void; isFav: boolean }) {
  const score = listing.match_score ?? 0
  return (
    <Card className={cn('bg-card hover:bg-secondary/50 transition-all duration-200 cursor-pointer group overflow-hidden', getScoreBorderClass(score))} onClick={() => onSelect(listing)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold leading-tight truncate text-foreground">{listing.title}</h4>
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs truncate">{listing.address}</span>
            </div>
          </div>
          <CircularScore score={score} size={44} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-foreground">{listing.cold_rent} EUR</span>
          <span className="text-xs text-muted-foreground">kalt</span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">{listing.warm_rent} EUR warm</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{listing.size_sqm} m2</span>
          <span>{listing.rooms} Zi.</span>
          <span>{listing.availability}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{listing.district}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getPortalShort(listing.portal)}</Badge>
            {Array.isArray(listing.features) && listing.features.slice(0, 2).map(f => (
              <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted">{f}</Badge>
            ))}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onToggleFav(listing.id) }} className="p-1 hover:scale-110 transition-transform">
            <Heart className={cn('h-4 w-4', isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400')} />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// KPI CARD
// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold font-mono leading-none text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SIDEBAR NAV
// ---------------------------------------------------------------------------
type NavSection = 'dashboard' | 'suchprofil' | 'ergebnisse' | 'favoriten' | 'suchverlauf' | 'einstellungen'

const NAV_ITEMS: { key: NavSection; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
  { key: 'suchprofil', label: 'Suchprofil', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { key: 'ergebnisse', label: 'Ergebnisse', icon: <ListFilter className="h-4 w-4" /> },
  { key: 'favoriten', label: 'Favoriten', icon: <Heart className="h-4 w-4" /> },
  { key: 'suchverlauf', label: 'Suchverlauf', icon: <History className="h-4 w-4" /> },
  { key: 'einstellungen', label: 'Einstellungen', icon: <Settings className="h-4 w-4" /> },
]

// ---------------------------------------------------------------------------
// ERROR BOUNDARY
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Etwas ist schiefgelaufen</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Erneut versuchen</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function Page() {
  // --- Navigation ---
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // --- Data ---
  const [listings, setListings] = useState<Listing[]>(MOCK_LISTINGS)
  const [favorites, setFavorites] = useState<string[]>([])
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>(MOCK_SEARCH_RUNS)
  const [profile, setProfile] = useState<SearchProfile>(DEFAULT_PROFILE)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sampleData, setSampleData] = useState(true)

  // --- Agent state ---
  const [searchLoading, setSearchLoading] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info')

  // --- Detail panel ---
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // --- Schedule state ---
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedError, setSchedError] = useState('')

  // --- Countdown timer ---
  const [countdown, setCountdown] = useState('--:--:--')

  // --- Filter state for Ergebnisse ---
  const [scoreFilter, setScoreFilter] = useState(0)
  const [priceMax, setPriceMax] = useState(2000)
  const [portalFilter, setPortalFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'size'>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // --- Search history expand ---
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  // --- Load from localStorage on mount ---
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('wr_favorites')
      if (savedFavs) setFavorites(JSON.parse(savedFavs))
      const savedProfile = localStorage.getItem('wr_profile')
      if (savedProfile) setProfile(JSON.parse(savedProfile))
      const savedEmail = localStorage.getItem('wr_email')
      if (savedEmail) setRecipientEmail(savedEmail)
      const savedListings = localStorage.getItem('wr_listings')
      if (savedListings) {
        const parsed = JSON.parse(savedListings)
        if (Array.isArray(parsed) && parsed.length > 0) setListings(parsed)
      }
      const savedRuns = localStorage.getItem('wr_runs')
      if (savedRuns) {
        const parsed = JSON.parse(savedRuns)
        if (Array.isArray(parsed) && parsed.length > 0) setSearchRuns(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // --- Save to localStorage ---
  useEffect(() => { try { localStorage.setItem('wr_favorites', JSON.stringify(favorites)) } catch {} }, [favorites])
  useEffect(() => { try { localStorage.setItem('wr_profile', JSON.stringify(profile)) } catch {} }, [profile])
  useEffect(() => { try { localStorage.setItem('wr_email', recipientEmail) } catch {} }, [recipientEmail])

  // --- Countdown timer effect ---
  useEffect(() => {
    const computeCountdown = () => {
      const now = new Date()
      const hours = now.getHours()
      const nextSlot = Math.ceil((hours + 1) / 6) * 6
      const next = new Date(now)
      next.setHours(nextSlot, 0, 0, 0)
      if (next.getTime() <= now.getTime()) {
        next.setHours(next.getHours() + 6)
      }
      const diff = next.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    computeCountdown()
    const iv = setInterval(computeCountdown, 1000)
    return () => clearInterval(iv)
  }, [])

  // --- Load schedules ---
  const loadSchedules = useCallback(async () => {
    setSchedLoading(true)
    setSchedError('')
    try {
      const res = await listSchedules()
      if (res.success) {
        setSchedules(Array.isArray(res.schedules) ? res.schedules : [])
      } else {
        setSchedError(res.error ?? 'Fehler beim Laden der Zeitplaene')
      }
    } catch {
      setSchedError('Netzwerkfehler')
    }
    setSchedLoading(false)
  }, [])

  const loadScheduleLogs = useCallback(async (scheduleId: string) => {
    try {
      const res = await getScheduleLogs(scheduleId, { limit: 20 })
      if (res.success) {
        setScheduleLogs(Array.isArray(res.executions) ? res.executions : [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // --- Toggle favorite ---
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }, [])

  // --- Trigger search agent ---
  const triggerSearch = useCallback(async () => {
    setSearchLoading(true)
    setActiveAgentId(SEARCH_AGENT_ID)
    setStatusMessage('Suche laeuft...')
    setStatusType('info')
    try {
      const msg = `Suche Wohnungen in ${profile.city}, Bezirke: ${profile.districts.join(', ')}, ${profile.size_min}-${profile.size_max} m2, max ${profile.max_rent} EUR kalt, ${profile.rooms} Zimmer, Features: ${profile.features.join(', ')}, Portale: ${profile.portals.join(', ')}`
      const result = await callAIAgent(msg, SEARCH_AGENT_ID)
      if (result.success) {
        const data = result?.response?.result
        const newListings = Array.isArray(data?.listings) ? data.listings : []
        const summary: SearchSummary | null = data?.search_summary ?? null
        if (newListings.length > 0) {
          setListings(prev => {
            const merged = [...newListings, ...prev]
            const unique = merged.filter((l: Listing, idx: number) => merged.findIndex((m: Listing) => m.id === l.id) === idx)
            try { localStorage.setItem('wr_listings', JSON.stringify(unique)) } catch {}
            return unique
          })
        }
        const newRun: SearchRun = {
          id: `run-${Date.now()}`,
          timestamp: summary?.search_timestamp ?? new Date().toISOString(),
          portals_scanned: summary?.portals_scanned ?? profile.portals.length,
          results_found: summary?.total_listings_found ?? newListings.length,
          new_listings: summary?.new_listings ?? newListings.length,
          status: (data?.status === 'success' || newListings.length > 0) ? 'success' : 'error',
          listings: newListings
        }
        setSearchRuns(prev => {
          const updated = [newRun, ...prev]
          try { localStorage.setItem('wr_runs', JSON.stringify(updated)) } catch {}
          return updated
        })
        setStatusMessage(`Suche abgeschlossen: ${newRun.results_found} Treffer, ${newRun.new_listings} neu`)
        setStatusType('success')
      } else {
        setStatusMessage(result?.error ?? 'Fehler bei der Suche')
        setStatusType('error')
      }
    } catch {
      setStatusMessage('Netzwerkfehler bei der Suche')
      setStatusType('error')
    }
    setSearchLoading(false)
    setActiveAgentId(null)
  }, [profile])

  // --- Trigger match analysis ---
  const triggerMatch = useCallback(async () => {
    if (!recipientEmail) {
      setStatusMessage('Bitte E-Mail-Adresse angeben')
      setStatusType('error')
      return
    }
    setMatchLoading(true)
    setActiveAgentId(MATCH_AGENT_ID)
    setStatusMessage('Match-Analyse laeuft...')
    setStatusType('info')
    try {
      const listingsData = listings.slice(0, 20).map(l => ({
        id: l.id, title: l.title, cold_rent: l.cold_rent, warm_rent: l.warm_rent,
        size_sqm: l.size_sqm, rooms: l.rooms, district: l.district, features: l.features
      }))
      const msg = `Analysiere folgende Inserate und sende Benachrichtigung an ${recipientEmail}. Suchkriterien: ${profile.size_min}-${profile.size_max} m2, max ${profile.max_rent} EUR, ${profile.rooms} Zimmer, Bezirke: ${profile.districts.join(', ')}, Features: ${profile.features.join(', ')}. Inserate: ${JSON.stringify(listingsData)}`
      const result = await callAIAgent(msg, MATCH_AGENT_ID)
      if (result.success) {
        const data = result?.response?.result
        const scored = Array.isArray(data?.scored_listings) ? data.scored_listings : []
        if (scored.length > 0) {
          setListings(prev => {
            const updated = prev.map(l => {
              const match = scored.find((s: Listing) => (s?.listing_id ?? s?.id) === l.id)
              if (match) {
                return { ...l, match_score: match.match_score, score_breakdown: match.score_breakdown, category: match.category }
              }
              return l
            })
            try { localStorage.setItem('wr_listings', JSON.stringify(updated)) } catch {}
            return updated
          })
        }
        const notif = data?.notifications_sent
        setStatusMessage(`Analyse abgeschlossen. ${notif?.immediate_emails ?? 0} E-Mails gesendet an ${notif?.recipient_email ?? recipientEmail}`)
        setStatusType('success')
      } else {
        setStatusMessage(result?.error ?? 'Fehler bei der Analyse')
        setStatusType('error')
      }
    } catch {
      setStatusMessage('Netzwerkfehler bei der Analyse')
      setStatusType('error')
    }
    setMatchLoading(false)
    setActiveAgentId(null)
  }, [recipientEmail, listings, profile])

  // --- Schedule controls ---
  const handleToggleSchedule = useCallback(async (sched: Schedule) => {
    setSchedLoading(true)
    if (sched.is_active) {
      await pauseSchedule(sched.id)
    } else {
      await resumeSchedule(sched.id)
    }
    await loadSchedules()
    setSchedLoading(false)
  }, [loadSchedules])

  const handleTriggerNow = useCallback(async (scheduleId: string) => {
    setSchedLoading(true)
    await triggerScheduleNow(scheduleId)
    setStatusMessage('Zeitplan manuell ausgeloest')
    setStatusType('success')
    setSchedLoading(false)
  }, [])

  // --- Filtered & sorted listings ---
  const filteredListings = useMemo(() => {
    let items = sampleData ? [...listings] : []
    if (scoreFilter > 0) items = items.filter(l => (l.match_score ?? 0) >= scoreFilter)
    if (priceMax < 2000) items = items.filter(l => l.cold_rent <= priceMax)
    if (portalFilter !== 'all') items = items.filter(l => l.portal === portalFilter)
    items.sort((a, b) => {
      let va = 0
      let vb = 0
      if (sortBy === 'score') { va = a.match_score ?? 0; vb = b.match_score ?? 0 }
      else if (sortBy === 'price') { va = a.cold_rent; vb = b.cold_rent }
      else if (sortBy === 'size') { va = a.size_sqm; vb = b.size_sqm }
      return sortDir === 'desc' ? vb - va : va - vb
    })
    return items
  }, [listings, scoreFilter, priceMax, portalFilter, sortBy, sortDir, sampleData])

  const favoriteListings = useMemo(() => listings.filter(l => favorites.includes(l.id)), [listings, favorites])
  const topMatches = useMemo(() => [...listings].filter(l => (l.match_score ?? 0) >= 90).sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)), [listings])
  const recentListings = useMemo(() => [...listings].slice(0, 6), [listings])

  // --- Open detail ---
  const openDetail = useCallback((l: Listing) => {
    setSelectedListing(l)
    setDetailOpen(true)
  }, [])

  // --- Schedule name helper ---
  const getScheduleName = (sched: Schedule) => {
    if (sched.id === SEARCH_SCHEDULE_ID || sched.agent_id === SEARCH_AGENT_ID) return 'Immobilien-Suchagent'
    if (sched.id === MATCH_SCHEDULE_ID || sched.agent_id === MATCH_AGENT_ID) return 'Match-Analyse Agent'
    return sched?.agent_id?.slice(0, 8) ?? 'Unbekannt'
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex font-sans">
        {/* ======== SIDEBAR ======== */}
        <aside className={cn('flex-shrink-0 bg-[hsl(220,24%,8%)] border-r border-[hsl(220,18%,15%)] flex flex-col transition-all duration-200', sidebarOpen ? 'w-52' : 'w-14')}>
          <div className="h-12 flex items-center gap-2 px-3 border-b border-[hsl(220,18%,15%)]">
            <Radio className="h-5 w-5 text-primary flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-bold tracking-tight text-foreground">WohnungsRadar</span>}
          </div>
          <nav className="flex-1 py-2 space-y-0.5 px-1.5">
            {NAV_ITEMS.map(item => (
              <button key={item.key} onClick={() => setActiveNav(item.key)} className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-colors', activeNav === item.key ? 'bg-[hsl(220,15%,15%)] text-primary font-semibold' : 'text-[hsl(220,15%,85%)] hover:bg-[hsl(220,15%,15%)]/50')}>
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => setSidebarOpen(p => !p)} className="h-10 flex items-center justify-center border-t border-[hsl(220,18%,15%)] text-muted-foreground hover:text-foreground transition-colors">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </aside>

        {/* ======== MAIN AREA ======== */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ---- Header ---- */}
          <header className="h-12 flex items-center justify-between px-4 border-b border-border flex-shrink-0 bg-card/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(p => !p)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground"><Menu className="h-5 w-5" /></button>
              <h1 className="text-sm font-semibold text-foreground capitalize">{NAV_ITEMS.find(n => n.key === activeNav)?.label}</h1>
              {activeAgentId && (
                <Badge variant="outline" className="text-[10px] gap-1 animate-pulse border-primary text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Agent aktiv
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Beispieldaten</Label>
                <Switch id="sample-toggle" checked={sampleData} onCheckedChange={setSampleData} />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Bell className="h-4 w-4" />
                      {topMatches.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-destructive rounded-full text-[8px] text-white flex items-center justify-center font-bold">{topMatches.length}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{topMatches.length} Top-Matches</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </header>

          {/* ---- Status bar ---- */}
          {statusMessage && (
            <div className={cn('px-4 py-1.5 text-xs flex items-center gap-2 border-b border-border', statusType === 'success' ? 'bg-green-500/10 text-green-400' : statusType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
              {statusType === 'success' && <CheckCircle2 className="h-3 w-3" />}
              {statusType === 'error' && <XCircle className="h-3 w-3" />}
              {statusType === 'info' && <Loader2 className="h-3 w-3 animate-spin" />}
              {statusMessage}
              <button onClick={() => setStatusMessage('')} className="ml-auto hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>
          )}

          {/* ---- Content ---- */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4 max-w-7xl mx-auto">

              {/* ================================================================ */}
              {/* DASHBOARD */}
              {/* ================================================================ */}
              {activeNav === 'dashboard' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Neue Treffer heute" value={sampleData ? 12 : 0} sub="aus 3 Portalen" icon={<Zap className="h-5 w-5" />} />
                    <KpiCard label="Top-Matches" value={sampleData ? topMatches.length : 0} sub="Score > 90%" icon={<Star className="h-5 w-5" />} />
                    <KpiCard label="Gesamt gescannt" value={sampleData ? 47 : 0} sub="letzte Suche" icon={<Search className="h-5 w-5" />} />
                    <KpiCard label="Naechste Suche in" value={countdown} sub="alle 6 Stunden" icon={<Clock className="h-5 w-5" />} />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button onClick={triggerSearch} disabled={searchLoading} className="gap-2" size="sm">
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Suche jetzt starten
                    </Button>
                    <Button onClick={() => setActiveNav('suchprofil')} variant="outline" size="sm" className="gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Suchprofil bearbeiten
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground"><TrendingUp className="h-4 w-4 text-green-400" /> Top-Matches</h3>
                      <div className="space-y-2">
                        {sampleData && topMatches.length > 0 ? topMatches.map(l => (
                          <ListingCard key={l.id} listing={l} onSelect={openDetail} onToggleFav={toggleFavorite} isFav={favorites.includes(l.id)} />
                        )) : (
                          <Card className="bg-card"><CardContent className="p-6 text-center text-muted-foreground text-sm">Noch keine Top-Matches. Starte eine Suche!</CardContent></Card>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground"><CircleDot className="h-4 w-4 text-primary" /> Neue Treffer</h3>
                      <div className="space-y-2">
                        {sampleData && recentListings.length > 0 ? recentListings.map(l => (
                          <ListingCard key={l.id} listing={l} onSelect={openDetail} onToggleFav={toggleFavorite} isFav={favorites.includes(l.id)} />
                        )) : (
                          <Card className="bg-card"><CardContent className="p-6 text-center text-muted-foreground text-sm">Keine neuen Treffer. Starte eine Suche!</CardContent></Card>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground"><Activity className="h-4 w-4 text-primary" /> Letzte Suchlaeufe</h3>
                    <Card className="bg-card">
                      <CardContent className="p-3 space-y-2">
                        {sampleData && searchRuns.length > 0 ? searchRuns.slice(0, 5).map(run => (
                          <div key={run.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border last:border-0">
                            {run.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" /> : run.status === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />}
                            <span className="text-muted-foreground font-mono">{formatTimestamp(run.timestamp)}</span>
                            <span className="text-foreground">{run.portals_scanned} Portale</span>
                            <span className="text-muted-foreground">{run.results_found} Treffer</span>
                            <Badge variant="secondary" className="text-[10px] ml-auto">{run.new_listings} neu</Badge>
                          </div>
                        )) : (
                          <p className="text-sm text-muted-foreground text-center py-4">Noch keine Suchlaeufe.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {/* ================================================================ */}
              {/* SUCHPROFIL */}
              {/* ================================================================ */}
              {activeNav === 'suchprofil' && (
                <Card className="bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Suchprofil konfigurieren</CardTitle>
                    <CardDescription className="text-xs">Definiere deine Suchkriterien fuer die automatische Wohnungssuche.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs mb-1.5 block">Stadt</Label>
                          <Input value={profile.city} onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))} placeholder="Berlin" className="bg-input" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Bezirke</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_DISTRICTS.map(d => (
                              <Badge key={d} variant={profile.districts.includes(d) ? 'default' : 'outline'} className={cn('cursor-pointer text-[10px] px-2 py-0.5 transition-colors', profile.districts.includes(d) ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')} onClick={() => setProfile(prev => ({ ...prev, districts: prev.districts.includes(d) ? prev.districts.filter(x => x !== d) : [...prev.districts, d] }))}>
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Umkreis: {profile.radius} km</Label>
                          <input type="range" min={1} max={20} value={profile.radius} onChange={(e) => setProfile(prev => ({ ...prev, radius: Number(e.target.value) }))} className="w-full accent-[hsl(220,80%,55%)] h-1.5" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs mb-1.5 block">Groesse: {profile.size_min} - {profile.size_max} m2</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={profile.size_min} onChange={(e) => setProfile(prev => ({ ...prev, size_min: Number(e.target.value) }))} className="bg-input w-20 text-xs" />
                            <span className="text-muted-foreground text-xs">bis</span>
                            <Input type="number" value={profile.size_max} onChange={(e) => setProfile(prev => ({ ...prev, size_max: Number(e.target.value) }))} className="bg-input w-20 text-xs" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Max. Kaltmiete: {profile.max_rent} EUR</Label>
                          <input type="range" min={300} max={2000} step={50} value={profile.max_rent} onChange={(e) => setProfile(prev => ({ ...prev, max_rent: Number(e.target.value) }))} className="w-full accent-[hsl(220,80%,55%)] h-1.5" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Zimmer: {profile.rooms}</Label>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setProfile(prev => ({ ...prev, rooms: Math.max(1, prev.rooms - 0.5) }))} className="h-7 w-7 p-0">-</Button>
                            <span className="text-sm font-mono w-8 text-center">{profile.rooms}</span>
                            <Button variant="outline" size="sm" onClick={() => setProfile(prev => ({ ...prev, rooms: Math.min(6, prev.rooms + 0.5) }))} className="h-7 w-7 p-0">+</Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Ausstattung</Label>
                          <div className="space-y-1.5">
                            {ALL_FEATURES.map(f => (
                              <div key={f} className="flex items-center gap-2">
                                <Checkbox id={`feat-${f}`} checked={profile.features.includes(f)} onCheckedChange={(checked) => setProfile(prev => ({ ...prev, features: checked ? [...prev.features, f] : prev.features.filter(x => x !== f) }))} />
                                <Label htmlFor={`feat-${f}`} className="text-xs cursor-pointer">{f}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs mb-1.5 block">Portale</Label>
                      <div className="flex gap-2">
                        {ALL_PORTALS.map(p => (
                          <Card key={p} className={cn('cursor-pointer transition-all flex-1', profile.portals.includes(p) ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card hover:bg-secondary/50')} onClick={() => setProfile(prev => ({ ...prev, portals: prev.portals.includes(p) ? prev.portals.filter(x => x !== p) : [...prev.portals, p] }))}>
                            <CardContent className="p-3 text-center">
                              <Building2 className="h-5 w-5 mx-auto mb-1 text-foreground" />
                              <p className="text-xs font-medium">{getPortalShort(p)}</p>
                              <p className="text-[10px] text-muted-foreground">{p}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { try { localStorage.setItem('wr_profile', JSON.stringify(profile)) } catch {}; setStatusMessage('Suchprofil gespeichert'); setStatusType('success') }} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Profil speichern
                      </Button>
                      <Button variant="outline" size="sm" onClick={triggerSearch} disabled={searchLoading} className="gap-2">
                        {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Suche testen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ================================================================ */}
              {/* ERGEBNISSE */}
              {/* ================================================================ */}
              {activeNav === 'ergebnisse' && (
                <>
                  <Card className="bg-card">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Min. Score</Label>
                          <Input type="number" value={scoreFilter} onChange={(e) => setScoreFilter(Number(e.target.value))} className="bg-input w-16 h-7 text-xs" min={0} max={100} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Max. Miete</Label>
                          <Input type="number" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="bg-input w-20 h-7 text-xs" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Portal</Label>
                          <select value={portalFilter} onChange={(e) => setPortalFilter(e.target.value)} className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border h-7">
                            <option value="all">Alle</option>
                            {ALL_PORTALS.map(p => <option key={p} value={p}>{getPortalShort(p)}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Sortierung</Label>
                          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border h-7">
                            <option value="score">Score</option>
                            <option value="price">Preis</option>
                            <option value="size">Groesse</option>
                          </select>
                          <button onClick={() => setSortDir(p => p === 'asc' ? 'desc' : 'asc')} className="p-1 text-muted-foreground hover:text-foreground">
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Badge variant="secondary" className="text-xs ml-auto">{filteredListings.length} Ergebnisse</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {filteredListings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredListings.map(l => (
                        <ListingCard key={l.id} listing={l} onSelect={openDetail} onToggleFav={toggleFavorite} isFav={favorites.includes(l.id)} />
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-card">
                      <CardContent className="p-8 text-center">
                        <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Keine Ergebnisse gefunden. Passe deine Filter an oder starte eine neue Suche.</p>
                        <Button onClick={triggerSearch} disabled={searchLoading} className="mt-3 gap-2" size="sm">
                          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Suche starten
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* ================================================================ */}
              {/* FAVORITEN */}
              {/* ================================================================ */}
              {activeNav === 'favoriten' && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Heart className="h-4 w-4 text-red-400" /> Deine Favoriten ({favoriteListings.length})</h3>
                  </div>
                  {favoriteListings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {favoriteListings.map(l => (
                        <ListingCard key={l.id} listing={l} onSelect={openDetail} onToggleFav={toggleFavorite} isFav={true} />
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-card">
                      <CardContent className="p-8 text-center">
                        <Heart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Noch keine Favoriten gespeichert. Klicke das Herz-Symbol bei einem Inserat.</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* ================================================================ */}
              {/* SUCHVERLAUF */}
              {/* ================================================================ */}
              {activeNav === 'suchverlauf' && (
                <>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><History className="h-4 w-4 text-primary" /> Suchverlauf</h3>
                  <Card className="bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs">Zeitpunkt</TableHead>
                          <TableHead className="text-xs">Portale</TableHead>
                          <TableHead className="text-xs">Treffer</TableHead>
                          <TableHead className="text-xs">Neu</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(sampleData ? searchRuns : []).map(run => (
                          <React.Fragment key={run.id}>
                            <TableRow className="border-border hover:bg-secondary/30 cursor-pointer" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}>
                              <TableCell className="text-xs font-mono">{formatTimestamp(run.timestamp)}</TableCell>
                              <TableCell className="text-xs">{run.portals_scanned}</TableCell>
                              <TableCell className="text-xs">{run.results_found}</TableCell>
                              <TableCell className="text-xs"><Badge variant="secondary" className="text-[10px]">{run.new_listings}</Badge></TableCell>
                              <TableCell className="text-xs">
                                {run.status === 'success' ? <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-400">Erfolg</Badge> : <Badge variant="destructive" className="text-[10px]">Fehler</Badge>}
                              </TableCell>
                              <TableCell className="text-xs">
                                {expandedRun === run.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                              </TableCell>
                            </TableRow>
                            {expandedRun === run.id && (
                              <TableRow className="border-border">
                                <TableCell colSpan={6} className="p-3 bg-secondary/20">
                                  {Array.isArray(run.listings) && run.listings.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {run.listings.map((l: Listing) => (
                                        <div key={l.id} className="flex items-center gap-2 p-2 bg-card rounded text-xs">
                                          <span className="font-medium truncate flex-1">{l.title}</span>
                                          <span className="text-muted-foreground">{l.cold_rent} EUR</span>
                                          <Badge variant="outline" className="text-[10px]">{l.district}</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Keine Inserate fuer diesen Lauf gespeichert.</p>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                        {(!sampleData || searchRuns.length === 0) && (
                          <TableRow className="border-border">
                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Noch keine Suchlaeufe vorhanden.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}

              {/* ================================================================ */}
              {/* EINSTELLUNGEN / ZEITPLAN */}
              {/* ================================================================ */}
              {activeNav === 'einstellungen' && (
                <Tabs defaultValue="zeitplan" className="w-full">
                  <TabsList className="bg-secondary">
                    <TabsTrigger value="zeitplan" className="text-xs">Zeitplaene</TabsTrigger>
                    <TabsTrigger value="email" className="text-xs">E-Mail & Match-Analyse</TabsTrigger>
                    <TabsTrigger value="logs" className="text-xs">Ausfuehrungsprotokoll</TabsTrigger>
                  </TabsList>

                  <TabsContent value="zeitplan" className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Automatische Zeitplaene</h3>
                      <Button variant="outline" size="sm" onClick={loadSchedules} disabled={schedLoading} className="gap-1.5 text-xs">
                        <RefreshCw className={cn('h-3 w-3', schedLoading && 'animate-spin')} /> Aktualisieren
                      </Button>
                    </div>
                    {schedError && <p className="text-xs text-destructive">{schedError}</p>}

                    {schedLoading && schedules.length === 0 ? (
                      <div className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[
                          { id: SEARCH_SCHEDULE_ID, name: 'Immobilien-Suchagent', desc: 'Durchsucht Portale nach neuen Inseraten', cron: '0 */6 * * *', agentId: SEARCH_AGENT_ID },
                          { id: MATCH_SCHEDULE_ID, name: 'Match-Analyse Agent', desc: 'Bewertet Inserate und sendet E-Mails', cron: '0 8 * * *', agentId: MATCH_AGENT_ID },
                        ].map(sConfig => {
                          const liveSched = schedules.find(s => s.id === sConfig.id)
                          const isActive = liveSched?.is_active ?? true
                          const nextRun = liveSched?.next_run_time ?? null
                          return (
                            <Card key={sConfig.id} className="bg-card">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-sm font-semibold text-foreground">{sConfig.name}</h4>
                                      <Badge variant={isActive ? 'default' : 'secondary'} className={cn('text-[10px]', isActive ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground')}>
                                        {isActive ? 'Aktiv' : 'Pausiert'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2">{sConfig.desc}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {cronToHuman(liveSched?.cron_expression ?? sConfig.cron)}</span>
                                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Europe/Berlin</span>
                                      {nextRun && <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Naechster Lauf: {formatTimestamp(nextRun)}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {isActive ? (
                                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => liveSched && handleToggleSchedule(liveSched)} disabled={schedLoading || !liveSched}>
                                        <Pause className="h-3 w-3" /> Pausieren
                                      </Button>
                                    ) : (
                                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => liveSched && handleToggleSchedule(liveSched)} disabled={schedLoading || !liveSched}>
                                        <Play className="h-3 w-3" /> Fortsetzen
                                      </Button>
                                    )}
                                    <Button variant="secondary" size="sm" className="text-xs h-7 gap-1" onClick={() => handleTriggerNow(sConfig.id)} disabled={schedLoading}>
                                      <Zap className="h-3 w-3" /> Jetzt
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}

                        {schedules.filter(s => s.id !== SEARCH_SCHEDULE_ID && s.id !== MATCH_SCHEDULE_ID).map(sched => (
                          <Card key={sched.id} className="bg-card">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-foreground">{getScheduleName(sched)}</h4>
                                    <Badge variant={sched.is_active ? 'default' : 'secondary'} className="text-[10px]">{sched.is_active ? 'Aktiv' : 'Pausiert'}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{cronToHuman(sched.cron_expression)} | {sched.timezone}</p>
                                </div>
                                <div className="flex gap-1.5">
                                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleToggleSchedule(sched)} disabled={schedLoading}>
                                    {sched.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                  </Button>
                                  <Button variant="secondary" size="sm" className="text-xs h-7" onClick={() => handleTriggerNow(sched.id)} disabled={schedLoading}>
                                    <Zap className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="email" className="space-y-3 mt-3">
                    <Card className="bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> E-Mail-Benachrichtigungen</CardTitle>
                        <CardDescription className="text-xs">Konfiguriere die E-Mail-Adresse fuer Match-Benachrichtigungen. Der Match-Analyse Agent sendet dir automatisch E-Mails ueber Top-Treffer.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="email-input" className="text-xs mb-1.5 block">Empfaenger E-Mail *</Label>
                          <Input id="email-input" type="email" placeholder="deine@email.de" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="bg-input max-w-sm" />
                        </div>
                        <div>
                          <Button size="sm" onClick={() => { try { localStorage.setItem('wr_email', recipientEmail) } catch {}; setStatusMessage('E-Mail gespeichert'); setStatusType('success') }} className="gap-2 mr-2">
                            <CheckCircle2 className="h-4 w-4" /> E-Mail speichern
                          </Button>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Match-Analyse manuell starten</h4>
                          <p className="text-xs text-muted-foreground mb-3">Analysiert aktuelle Inserate gegen dein Suchprofil und sendet eine Zusammenfassung an die angegebene E-Mail.</p>
                          <Button onClick={triggerMatch} disabled={matchLoading || !recipientEmail} size="sm" className="gap-2">
                            {matchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Match-Analyse starten
                          </Button>
                          {!recipientEmail && <p className="text-xs text-destructive mt-1">Bitte zuerst E-Mail-Adresse angeben</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="logs" className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Ausfuehrungsprotokoll</h3>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => loadScheduleLogs(SEARCH_SCHEDULE_ID)} className="text-xs h-7">Such-Logs</Button>
                        <Button variant="outline" size="sm" onClick={() => loadScheduleLogs(MATCH_SCHEDULE_ID)} className="text-xs h-7">Match-Logs</Button>
                      </div>
                    </div>
                    <Card className="bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs">Zeitpunkt</TableHead>
                            <TableHead className="text-xs">Agent</TableHead>
                            <TableHead className="text-xs">Versuch</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Fehler</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scheduleLogs.length > 0 ? scheduleLogs.map(log => (
                            <TableRow key={log.id} className="border-border">
                              <TableCell className="text-xs font-mono">{formatTimestamp(log.executed_at)}</TableCell>
                              <TableCell className="text-xs">{log.agent_id === SEARCH_AGENT_ID ? 'Suchagent' : log.agent_id === MATCH_AGENT_ID ? 'Match-Agent' : (log?.agent_id?.slice(0, 8) ?? '---')}</TableCell>
                              <TableCell className="text-xs">{log.attempt}/{log.max_attempts}</TableCell>
                              <TableCell className="text-xs">
                                {log.success ? <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-400">Erfolg</Badge> : <Badge variant="destructive" className="text-[10px]">Fehler</Badge>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{log.error_message ?? '---'}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow className="border-border">
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Klicke oben auf eine Schaltflaeche um Logs zu laden.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {/* ================================================================ */}
              {/* AGENT INFO FOOTER */}
              {/* ================================================================ */}
              <Separator className="my-2" />
              <Card className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', activeAgentId === SEARCH_AGENT_ID ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/30')} />
                        <span className="text-[10px] text-muted-foreground">Immobilien-Suchagent</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', activeAgentId === MATCH_AGENT_ID ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/30')} />
                        <span className="text-[10px] text-muted-foreground">Match-Analyse Agent</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">WohnungsRadar v1.0</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>

        {/* ======== DETAIL SHEET ======== */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-base leading-tight pr-6">{selectedListing?.title ?? 'Inserat'}</SheetTitle>
              <SheetDescription className="text-xs">{selectedListing?.address ?? ''}</SheetDescription>
            </SheetHeader>
            {selectedListing && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-4">
                  <CircularScore score={selectedListing.match_score ?? 0} size={64} />
                  <div>
                    <p className="text-sm font-semibold">Match-Score: {selectedListing.match_score ?? 0}%</p>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">{selectedListing.category ?? 'unbewertet'}</Badge>
                  </div>
                </div>

                {selectedListing.score_breakdown && (
                  <Card className="bg-secondary/30">
                    <CardContent className="p-3 space-y-1.5">
                      <h4 className="text-xs font-semibold mb-1">Score-Aufschluesselung</h4>
                      {Object.entries(selectedListing.score_breakdown).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-20 capitalize">{key.replace('_score', '')}</span>
                          <Progress value={typeof val === 'number' ? val : 0} className="h-1.5 flex-1" />
                          <span className="text-[10px] font-mono w-8 text-right">{typeof val === 'number' ? val : 0}%</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Kaltmiete</p>
                    <p className="text-sm font-bold">{selectedListing.cold_rent} EUR</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Warmmiete</p>
                    <p className="text-sm font-bold">{selectedListing.warm_rent} EUR</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Groesse</p>
                    <p className="text-sm font-bold">{selectedListing.size_sqm} m2</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Zimmer</p>
                    <p className="text-sm font-bold">{selectedListing.rooms}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Bezirk</p>
                    <Badge variant="secondary" className="text-xs">{selectedListing.district}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Verfuegbar ab</p>
                    <p className="text-sm">{selectedListing.availability}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Ausstattung</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(selectedListing.features) && selectedListing.features.map(f => (
                      <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Portal</p>
                    <Badge variant="outline" className="text-xs">{selectedListing.portal}</Badge>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Kontakt</p>
                    <p className="text-xs">{selectedListing.contact_info}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" asChild className="gap-2 flex-1">
                    <a href={selectedListing.listing_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Auf Portal oeffnen
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleFavorite(selectedListing.id)} className="gap-2">
                    <Heart className={cn('h-4 w-4', favorites.includes(selectedListing.id) ? 'fill-red-500 text-red-500' : '')} />
                    {favorites.includes(selectedListing.id) ? 'Entfernen' : 'Favorit'}
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </ErrorBoundary>
  )
}
