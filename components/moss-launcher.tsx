'use client'

import { useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  Cpu,
  Gauge,
  Gamepad2,
  HardDrive,
  Home,
  Layers3,
  Play,
  Settings,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Wrench,
  X,
} from 'lucide-react'

type PageKey = 'Home' | 'Instances' | 'Mods' | 'Performance' | 'Settings'

const navigation: { label: PageKey; icon: typeof Home }[] = [
  { label: 'Home', icon: Home },
  { label: 'Instances', icon: Layers3 },
  { label: 'Mods', icon: Boxes },
  { label: 'Performance', icon: Gauge },
  { label: 'Settings', icon: Settings },
]

function Sidebar({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-moss-border bg-moss-sidebar px-4 py-5 md:w-[220px] md:border-b-0 md:border-r md:px-3 lg:w-[236px]">
      <div className="flex items-center gap-3 px-3 pb-9">
        <div className="grid size-9 place-items-center rounded-xl bg-moss-accent text-moss-sidebar shadow-[0_8px_22px_rgba(128,159,102,0.18)]">
          <span className="font-mono text-sm font-black">M</span>
        </div>
        <div>
          <div className="text-[17px] font-semibold tracking-[0.18em] text-moss-text">MOSS</div>
          <div className="mt-0.5 text-[9px] font-medium tracking-[0.2em] text-moss-muted">PERFORMANCE CLIENT</div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto md:flex-col">
        {navigation.map(({ label, icon: Icon }) => {
          const active = activePage === label
          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              className={`group flex min-w-fit items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${active ? 'bg-moss-active text-moss-text shadow-[inset_0_0_0_1px_rgba(128,159,102,0.1)]' : 'text-moss-muted hover:bg-moss-card/70 hover:text-moss-text'}`}
            >
              <Icon className={`size-[17px] transition-colors ${active ? 'text-moss-accent' : 'text-moss-muted group-hover:text-moss-text'}`} strokeWidth={1.8} />
              <span>{label}</span>
              {active && <span className="ml-auto hidden size-1.5 rounded-full bg-moss-accent md:block" />}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto hidden flex-col gap-4 px-3 md:flex">
        <div className="h-px bg-moss-border" />
        <button type="button" className="flex items-center gap-3 text-left text-xs text-moss-muted transition-colors hover:text-moss-text">
          <CircleHelp className="size-4" strokeWidth={1.8} />
          <span>Help center</span>
        </button>
        <div className="rounded-xl border border-moss-border bg-moss-card/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-moss-muted"><Activity className="size-3 text-moss-accent" /> System ready</div>
          <div className="flex items-center justify-between text-[11px] text-moss-text"><span>Launcher build</span><span className="font-mono text-moss-muted">0.8.4</span></div>
        </div>
      </div>
    </aside>
  )
}

function SectionHeader({ page }: { page: PageKey }) {
  const subtitles: Record<PageKey, string> = {
    Home: 'Your setup, ready when you are.',
    Instances: 'Organize your Minecraft installations.',
    Mods: 'Manage your performance stack.',
    Performance: 'Tune every frame with intention.',
    Settings: 'Shape MOSS around your setup.',
  }
  return (
    <header className="mb-7 flex items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-moss-accent">{page === 'Home' ? 'Launcher overview' : 'MOSS workspace'}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-moss-text sm:text-[34px]">{page === 'Home' ? 'Welcome back.' : page}</h1>
        <p className="mt-2 text-sm text-moss-muted">{subtitles[page]}</p>
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-moss-border bg-moss-card/50 px-3 py-2 text-[11px] text-moss-muted sm:flex">
        <span className="size-1.5 rounded-full bg-moss-accent shadow-[0_0_0_3px_rgba(128,159,102,0.12)]" /> Launcher ready
      </div>
    </header>
  )
}

function HomeView() {
  const [notice, setNotice] = useState(false)
  return (
    <>
      <section className="relative overflow-hidden rounded-[18px] border border-moss-border bg-moss-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-moss-accent/5 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <div className="mb-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-moss-muted"><Gamepad2 className="size-3.5 text-moss-accent" /> Java Edition</div>
            <div className="flex items-center gap-3"><h2 className="text-[26px] font-semibold tracking-[-0.03em] text-moss-text">Latest Release</h2><span className="rounded-full border border-moss-border bg-moss-bg px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-moss-muted">Stable</span></div>
            <p className="mt-2 text-sm text-moss-muted">Minecraft 1.21.4 <span className="mx-1.5 text-moss-border">•</span> Fabric 0.16.9</p>
          </div>
          <button type="button" onClick={() => setNotice(true)} className="group flex items-center justify-center gap-3 rounded-xl bg-moss-accent px-5 py-3.5 text-sm font-semibold text-moss-sidebar transition-all hover:bg-[#91b476] active:scale-[0.98] sm:min-w-[184px]">
            <Play className="size-4 fill-current" data-icon="inline-start" /> PLAY MINECRAFT <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>
        {notice && <div className="relative mt-6 flex items-center justify-between gap-3 rounded-xl border border-moss-accent/25 bg-moss-bg/70 px-4 py-3 text-xs text-moss-muted"><span>Launch is not connected yet. This is a preview of the launcher experience.</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice(false)}><X className="size-4" /></button></div>}
        <div className="relative mt-8 flex flex-wrap gap-x-7 gap-y-2 border-t border-moss-border pt-4 text-[11px] text-moss-muted"><span className="flex items-center gap-2"><HardDrive className="size-3.5" /> 4.8 GB allocated</span><span className="flex items-center gap-2"><Cpu className="size-3.5" /> Java 21</span><span className="flex items-center gap-2"><TerminalSquare className="size-3.5" /> Fabric loader</span></div>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <InfoCard icon={Gauge} eyebrow="Performance profile" title="Balanced FPS" detail="Optimized for smooth gameplay" action="Adjust profile" />
        <InfoCard icon={Activity} eyebrow="Instance status" title="Not installed" detail="Choose an instance to get started" action="View instances" />
      </div>

      <section className="mt-4 rounded-[16px] border border-moss-border bg-moss-card/65 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-moss-accent/10 text-moss-accent"><Sparkles className="size-4" /></div><div><p className="text-xs font-medium text-moss-text">MOSS build status</p><p className="mt-0.5 text-[11px] text-moss-muted">Everything is up to date</p></div></div><div className="flex items-center gap-3 text-[11px] text-moss-muted"><span className="flex items-center gap-1.5"><Check className="size-3.5 text-moss-accent" /> v0.8.4 stable</span><span className="hidden text-moss-border sm:inline">|</span><span>Updated today</span><ChevronRight className="size-4" /></div></div>
      </section>
    </>
  )
}

function InfoCard({ icon: Icon, eyebrow, title, detail, action }: { icon: typeof Gauge; eyebrow: string; title: string; detail: string; action: string }) {
  return <article className="group rounded-[16px] border border-moss-border bg-moss-card p-5 transition-colors hover:border-moss-accent/35"><div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-xl bg-moss-bg text-moss-accent"><Icon className="size-[17px]" strokeWidth={1.8} /></div><button type="button" aria-label={action} className="text-moss-muted transition-colors hover:text-moss-text"><ArrowUpRight className="size-4" /></button></div><p className="mt-5 text-[10px] font-medium uppercase tracking-[0.16em] text-moss-muted">{eyebrow}</p><h3 className="mt-1.5 text-lg font-medium text-moss-text">{title}</h3><p className="mt-1 text-xs text-moss-muted">{detail}</p></article>
}

function PlaceholderView({ page }: { page: PageKey }) {
  const Icon = page === 'Mods' ? Boxes : page === 'Performance' ? SlidersHorizontal : page === 'Settings' ? Wrench : Layers3
  return <div className="grid min-h-[460px] place-items-center rounded-[18px] border border-dashed border-moss-border bg-moss-card/40 p-8 text-center"><div className="max-w-sm"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-moss-accent/10 text-moss-accent"><Icon className="size-5" /></div><h2 className="mt-5 text-lg font-medium text-moss-text">{page} is ready to be configured</h2><p className="mt-2 text-sm leading-6 text-moss-muted">This workspace is part of the MOSS preview. Connect your Minecraft setup to begin managing it here.</p><button type="button" className="mt-6 rounded-lg border border-moss-border px-4 py-2 text-xs font-medium text-moss-text transition-colors hover:bg-moss-card">Explore workspace</button></div></div>
}

export function MossLauncher() {
  const [activePage, setActivePage] = useState<PageKey>('Home')
  return <div className="min-h-screen bg-moss-bg font-sans text-moss-text"><div className="mx-auto flex min-h-screen max-w-[1440px] flex-col md:flex-row"><Sidebar activePage={activePage} onNavigate={setActivePage} /><main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12 lg:py-10"><div className="mx-auto max-w-[940px]"><SectionHeader page={activePage} />{activePage === 'Home' ? <HomeView /> : <PlaceholderView page={activePage} />}</div></main></div></div>
}
