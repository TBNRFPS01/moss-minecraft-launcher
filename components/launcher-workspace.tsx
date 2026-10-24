'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  ArrowDownToLine, Check, ChevronDown, CircleHelp, Clock3, Cpu, Download,
  FolderOpen, Gamepad2, HardDrive, Layers3, LoaderCircle, Pencil, Plus,
  RefreshCw, Sparkles, Trash2, TreePine, Wifi, X,
} from 'lucide-react'

type LauncherPage = 'Home' | 'Instances'
type MinecraftVersion = { id: string; versionType: string; releaseTime: string }
type Instance = {
  id: string
  name: string
  minecraftVersion: string
  gameDirectory: string
  javaPath: string | null
  maxMemoryMb: number
  installed: boolean
}
type JavaStatus = { installed: boolean; executable: string; version: string | null; details: string }
type InstallProgress = { instanceId: string; completed: number; total: number; currentFile: string }

const panel = 'rounded-2xl border border-[var(--border)] bg-[var(--card)]'
const field = 'min-w-0 w-full rounded-xl border border-[var(--border)] bg-[#111710] px-3.5 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[#78816f] focus:border-[var(--accent)]'

function WorldArtwork({ variant = 0 }: { variant?: number }) {
  const skies = [
    'from-[#435849] via-[#283b30] to-[#17231c]',
    'from-[#59634c] via-[#354633] to-[#1b291e]',
    'from-[#4b5960] via-[#293c3c] to-[#172522]',
  ]
  return <div className={'relative h-full min-h-[116px] overflow-hidden bg-gradient-to-b ' + skies[variant % skies.length]}>
    <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 70% 24%, rgba(222,202,143,.38), transparent 34%)' }} />
    <div className="absolute right-[17%] top-[18%] size-8 rounded-full border border-[#e0d0a0]/30 bg-[#d9c997]/20 blur-[1px]" />
    <div className="absolute -bottom-10 -left-8 h-28 w-[120%] rotate-[-7deg] rounded-[50%] bg-[#18251b]" />
    <div className="absolute -bottom-12 left-[28%] h-32 w-[90%] rotate-[8deg] rounded-[50%] bg-[#223326]" />
    <div className="absolute bottom-0 left-0 right-0 flex h-[70%] items-end justify-around opacity-80">
      {[0,1,2,3,4,5,6,7,8].map((n) => <div key={n} className="relative w-[9%]" style={{ height: (42 + ((n * 19 + variant * 13) % 46)) + '%' }}>
        <div className="absolute inset-x-0 top-0 mx-auto h-[70%] w-full bg-[#111d16]" style={{ clipPath: 'polygon(50% 0, 100% 62%, 70% 62%, 100% 100%, 0 100%, 30% 62%, 0 62%)' }} />
        <div className="absolute bottom-0 left-[42%] h-[35%] w-[16%] bg-[#111d16]" />
      </div>)}
    </div>
    <div className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/75 backdrop-blur-md"><TreePine className="size-3 text-[var(--accent)]" /> World preview</div>
  </div>
}

export function LauncherWorkspace({ page }: { page: LauncherPage }) {
  const [versions, setVersions] = useState<MinecraftVersion[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [java, setJava] = useState<JavaStatus | null>(null)
  const [version, setVersion] = useState('')
  const [name, setName] = useState('Survival')
  const [showCreator, setShowCreator] = useState(false)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isDesktop, setIsDesktop] = useState(false)

  async function refresh() {
    setError('')
    try {
      const [available, saved, javaStatus] = await Promise.all([
        invoke<MinecraftVersion[]>('get_versions'),
        invoke<Instance[]>('list_instances'),
        invoke<JavaStatus>('detect_java'),
      ])
      setVersions(available)
      setInstances(saved)
      setJava(javaStatus)
      setVersion((current) => current || available.find((item) => item.versionType === 'release')?.id || '')
      setIsDesktop(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  useEffect(() => {
    void refresh()
    let unlisten: (() => void) | undefined
    void listen<InstallProgress>('install-progress', (event) => setProgress(event.payload)).then((stop) => { unlisten = stop })
    return () => unlisten?.()
  }, [])

  async function createInstance() {
    if (!name.trim() || !version) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const instance = await invoke<Instance>('create_instance', { name: name.trim(), minecraftVersion: version })
      setInstances((current) => [...current, instance])
      setName('')
      setShowCreator(false)
      setMessage(instance.name + ' was created.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function install(instance: Instance) {
    setBusy(true)
    setProgress({ instanceId: instance.id, completed: 0, total: 1, currentFile: 'Preparing installation' })
    setMessage('')
    setError('')
    try {
      await invoke('install_version', { instanceId: instance.id })
      setInstances((current) => current.map((item) => item.id === instance.id ? { ...item, installed: true } : item))
      setMessage(instance.name + ' is installed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function remove(instance: Instance) {
    if (!window.confirm('Delete ' + instance.name + ' and all files in its MOSS instance directory?')) return
    setBusy(true)
    setError('')
    try {
      const updated = await invoke<Instance[]>('delete_instance', { instanceId: instance.id })
      setInstances(updated)
      setMessage(instance.name + ' was deleted.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function rename(instance: Instance) {
    const nextName = window.prompt('Rename instance', instance.name)?.trim()
    if (!nextName || nextName === instance.name) return
    setBusy(true)
    setError('')
    try {
      const updated = await invoke<Instance[]>('rename_instance', { instanceId: instance.id, name: nextName })
      setInstances(updated)
      setMessage('Instance renamed to ' + nextName + '.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex flex-col gap-6">
    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-950/25 px-4 py-3 text-sm text-red-200"><X className="mt-0.5 size-4 shrink-0" /><div>{error}{!isDesktop && <p className="mt-1 text-xs text-red-200/70">Minecraft management requires the installed MOSS desktop application.</p>}</div></div>}
    {message && <div role="status" className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm text-[var(--text-primary)]"><Check className="size-4 text-[var(--accent)]" />{message}</div>}

    {page === 'Home' && <>
      <section className="relative isolate min-h-[300px] overflow-hidden rounded-[22px] border border-[#52614a] bg-[#1a291e]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#111a13] via-[#16251b]/95 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_30%,rgba(199,168,106,.18),transparent_35%)]" />
        <div className="absolute -right-4 bottom-0 top-0 w-[55%] opacity-80"><WorldArtwork variant={1} /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#172219] via-[#172219]/90 to-transparent" />
        <div className="relative z-10 flex min-h-[300px] flex-col justify-between gap-10 p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d1bb83]"><Sparkles className="size-3.5" /> Your world awaits</div>
          <div className="max-w-lg">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#b6bda9]">MOSS launcher / Java Edition</p>
            <h2 className="max-w-md text-4xl font-medium leading-[1.06] tracking-[-0.045em] text-[#f2f0e6] sm:text-5xl">A quieter way<br />to play.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#b7c0b1]">Your instances, your settings, your next world. All in one grounded space.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setShowCreator(true)} className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-[#1b2017] shadow-[0_8px_28px_rgba(199,168,106,.14)] transition hover:brightness-110 active:scale-[.98]"><Gamepad2 className="size-4" /> Create your world <Plus className="size-4" /></button>
              <button type="button" onClick={() => void refresh()} aria-label="Refresh launcher" className="rounded-xl border border-white/15 bg-white/[.04] p-3.5 text-[#e5e6d9] transition hover:bg-white/[.08]"><RefreshCw className="size-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#aeb7a7]">
            <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--accent)]" />{isDesktop ? 'Desktop service connected' : 'Desktop connection required'}</span>
            <span className="flex items-center gap-2"><Cpu className="size-3.5" />{java?.installed ? 'Java ' + (java.version ?? 'detected') : 'Java runtime check'}</span>
            <span className="flex items-center gap-2"><Layers3 className="size-3.5" />{instances.length} saved {instances.length === 1 ? 'instance' : 'instances'}</span>
          </div>
        </div>
      </section>

      {showCreator && <section className={panel + ' p-5 sm:p-6'}>
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">New instance</p><h3 className="mt-1 text-lg font-medium">Start with a fresh world</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">A separate directory keeps each setup independent.</p></div><button type="button" onClick={() => setShowCreator(false)} aria-label="Close create instance form" className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:text-white"><X className="size-4" /></button></div>
        <form className="grid gap-3 sm:grid-cols-[1fr_190px_auto]" onSubmit={(event) => { event.preventDefault(); void createInstance() }}>
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="Instance name" aria-label="Instance name" />
          <select className={field} value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Minecraft version" disabled={!versions.length}>
            {versions.filter((item) => item.versionType === 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · Release</option>)}
            {versions.filter((item) => item.versionType !== 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · {item.versionType}</option>)}
          </select>
          <button disabled={busy || !name.trim() || !version || !isDesktop} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#1b2017] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Create instance</button>
        </form>
      </section>}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Your library</p><h2 className="mt-1 text-xl font-medium tracking-tight">Pick up where you left off</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Every profile, kept separate.</p></div><button type="button" onClick={() => setShowCreator(true)} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"><Plus className="size-3.5 text-[var(--accent)]" />New</button></div>
        {instances.length === 0 ? <div className={panel + ' overflow-hidden'}>
          <div className="grid md:grid-cols-[.8fr_1fr]">
            <div className="min-h-[150px]"><WorldArtwork variant={0} /></div>
            <div className="flex flex-col justify-center p-5 sm:p-7"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"><TreePine className="size-3.5" /> A place to begin</div><h3 className="mt-2 text-lg font-medium">Your next world starts here.</h3><p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">Create an instance to give each version and play style its own home.</p><button type="button" onClick={() => setShowCreator(true)} className="mt-4 flex w-fit items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:brightness-125">Create first instance <ArrowDownToLine className="size-3.5 rotate-[-90deg]" /></button></div>
          </div>
        </div> : <div className="grid gap-4 lg:grid-cols-2">{instances.map((instance, index) => {
          const activeProgress = progress?.instanceId === instance.id
          const percent = activeProgress ? Math.min(100, Math.round(progress.completed / Math.max(1, progress.total) * 100)) : 0
          return <article key={instance.id} className={panel + ' group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/55'}>
            <div className="h-[132px]"><WorldArtwork variant={index} /></div>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-medium">{instance.name}</h3><span className="rounded-md border border-[var(--border)] bg-[#171d15] px-2 py-1 text-[10px] text-[#c5cbb9]">{instance.minecraftVersion}</span></div><p className="mt-1.5 truncate text-[11px] text-[var(--text-secondary)]">{instance.installed ? 'Installed and ready' : 'Not installed yet'}</p></div><span className={'mt-1 size-2 rounded-full ' + (instance.installed ? 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]' : 'bg-[#6c7565]')} title={instance.installed ? 'Installed' : 'Not installed'} /></div>
              {activeProgress && <div className="mt-4"><div className="mb-1.5 flex justify-between gap-3 text-[10px] text-[var(--text-secondary)]"><span className="truncate">{progress.currentFile}</span><span>{percent}%</span></div><div className="h-1 overflow-hidden rounded-full bg-[#171d15]"><div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: percent + '%' }} /></div></div>}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]"><HardDrive className="size-3.5" />{instance.maxMemoryMb} MB RAM</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void rename(instance)} disabled={busy || !isDesktop} aria-label={'Rename ' + instance.name} title="Rename" className="rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-white/[.05] hover:text-white disabled:opacity-40"><Pencil className="size-3.5" /></button>
                  <button type="button" onClick={() => void remove(instance)} disabled={busy || !isDesktop} aria-label={'Delete ' + instance.name} title="Delete" className="rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"><Trash2 className="size-3.5" /></button>
                  <button type="button" onClick={() => void install(instance)} disabled={busy || !isDesktop} className="ml-1 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-[#1b2017] transition hover:brightness-110 disabled:opacity-40">{activeProgress ? <LoaderCircle className="size-3.5 animate-spin" /> : instance.installed ? <RefreshCw className="size-3.5" /> : <Download className="size-3.5" />}{instance.installed ? 'Verify' : 'Install'}</button>
                </div>
              </div>
            </div>
          </article>
        })}</div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={panel + ' flex items-center gap-3 p-4'}><div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"><Wifi className="size-4" /></div><div><p className="text-xs font-medium">Connection</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">{isDesktop ? 'Desktop service online' : 'Open MOSS desktop app'}</p></div></div>
        <div className={panel + ' flex items-center gap-3 p-4'}><div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"><Cpu className="size-4" /></div><div><p className="text-xs font-medium">Java runtime</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">{java?.installed ? java.version ?? 'Detected' : 'Needs verification'}</p></div></div>
        <div className={panel + ' flex items-center gap-3 p-4'}><div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"><Clock3 className="size-4" /></div><div><p className="text-xs font-medium">MOSS status</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Local-first launcher preview</p></div></div>
      </div>
    </>}

    {page === 'Instances' && <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">World management</p><h2 className="mt-1 text-2xl font-medium">Your instances</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Separate versions, separate directories, one launcher.</p></div><button type="button" onClick={() => setShowCreator((current) => !current)} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[#1b2017]"><Plus className="size-4" />New instance <ChevronDown className={'size-3.5 transition ' + (showCreator ? 'rotate-180' : '')} /></button></div>
      {showCreator && <section className={panel + ' p-5'}><form className="grid gap-3 sm:grid-cols-[1fr_190px_auto]" onSubmit={(event) => { event.preventDefault(); void createInstance() }}><input className={field} value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="Instance name" aria-label="Instance name" /><select className={field} value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Minecraft version" disabled={!versions.length}>{versions.filter((item) => item.versionType === 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · Release</option>)}{versions.filter((item) => item.versionType !== 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · {item.versionType}</option>)}</select><button disabled={busy || !name.trim() || !version || !isDesktop} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#1b2017] disabled:opacity-50"><Plus className="size-4" />Create</button></form></section>}
      {instances.length ? <div className="grid gap-4 lg:grid-cols-2">{instances.map((instance, index) => <article key={instance.id} className={panel + ' overflow-hidden'}><div className="h-[132px]"><WorldArtwork variant={index} /></div><div className="p-5"><h3 className="font-medium">{instance.name}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Minecraft {instance.minecraftVersion} · {instance.installed ? 'Installed' : 'Not installed'}</p><p className="mt-2 break-all text-[10px] text-[var(--text-secondary)]">{instance.gameDirectory}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void install(instance)} disabled={busy || !isDesktop} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#1b2017] disabled:opacity-40"><Download className="size-3.5" />{instance.installed ? 'Verify files' : 'Install'}</button><button type="button" onClick={() => void rename(instance)} disabled={busy || !isDesktop} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs hover:border-[var(--accent)] disabled:opacity-40"><Pencil className="size-3.5" />Rename</button><button type="button" onClick={() => void remove(instance)} disabled={busy || !isDesktop} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-red-200 hover:border-red-400/40 disabled:opacity-40"><Trash2 className="size-3.5" />Delete</button></div></div></article>)}</div> : <div className={panel + ' p-10 text-center'}><FolderOpen className="mx-auto size-7 text-[var(--accent)]" /><h3 className="mt-3 text-base font-medium">No instances yet</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Create your first instance to get started.</p><button type="button" onClick={() => setShowCreator(true)} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-[#1b2017]">Create instance</button></div>}
      <p className="flex items-start gap-2 text-[11px] leading-5 text-[var(--text-secondary)]"><CircleHelp className="mt-0.5 size-3.5 shrink-0" />Launching a game requires Microsoft account authentication, which is not connected yet. MOSS will not launch a version without a verified Minecraft session.</p>
    </>}
  </div>
}