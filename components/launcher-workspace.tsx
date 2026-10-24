'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Check, Download, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'

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

const panel = 'rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-5'
const field = 'min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]'

export function LauncherWorkspace({ page }: { page: LauncherPage }) {
  const [versions, setVersions] = useState<MinecraftVersion[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [java, setJava] = useState<JavaStatus | null>(null)
  const [version, setVersion] = useState('')
  const [name, setName] = useState('Vanilla')
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
      setMessage(`${instance.name} was created.`)
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
      setMessage(`${instance.name} is installed.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function remove(instance: Instance) {
    if (!window.confirm(`Delete ${instance.name} and all files in its MOSS instance directory?`)) return
    setBusy(true)
    setError('')
    try {
      const updated = await invoke<Instance[]>('delete_instance', { instanceId: instance.id })
      setInstances(updated)
      setMessage(`${instance.name} was deleted.`)
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
      setMessage(`Instance renamed to ${nextName}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!isDesktop && !error) return <div className={`${panel} flex items-center gap-3 text-sm text-[var(--text-secondary)]`}><LoaderCircle className="size-4 animate-spin text-[var(--accent)]" /> Connecting to the MOSS desktop service…</div>

  return <div className="flex flex-col gap-4">
    {error && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{error}{!isDesktop && <p className="mt-1 text-xs text-red-200/70">Minecraft management requires the installed MOSS desktop application.</p>}</div>}
    {message && <div role="status" className="flex items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm text-[var(--text-primary)]"><Check className="size-4 text-[var(--accent)]" />{message}</div>}

    {page === 'Home' && <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">Minecraft Java Edition</p><h2 className="mt-2 text-xl font-medium">Create an instance</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Each profile has a separate game directory and installation.</p></div>
        <button type="button" onClick={() => void refresh()} aria-label="Refresh launcher data" title="Refresh" className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><RefreshCw className="size-4" /></button>
      </div>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_190px_auto]" onSubmit={(event) => { event.preventDefault(); void createInstance() }}>
        <input className={field} value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="Instance name" aria-label="Instance name" />
        <select className={field} value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Minecraft version" disabled={!versions.length}>
          {versions.filter((item) => item.versionType === 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · Release</option>)}
          {versions.filter((item) => item.versionType !== 'release').map((item) => <option key={item.id} value={item.id}>{item.id} · {item.versionType}</option>)}
        </select>
        <button disabled={busy || !name.trim() || !version || !isDesktop} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--sidebar)] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Create</button>
      </form>
      <div className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-secondary)]">{java ? java.installed ? `Java detected: ${java.version ?? java.executable}` : 'Java was not found on PATH. Install a compatible Java runtime before launching.' : 'Checking Java runtime…'}</div>
    </section>}

    <section className={panel}>
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-medium">{page === 'Home' ? 'Your instances' : 'Instances'}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{instances.length} profile{instances.length === 1 ? '' : 's'} · stored in MOSS application data</p></div></div>
      {!instances.length ? <p className="mt-5 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">No instances yet. Create one above to get started.</p> : <div className="mt-4 divide-y divide-[var(--border)]">{instances.map((instance) => {
        const activeProgress = progress?.instanceId === instance.id
        const percent = activeProgress ? Math.min(100, Math.round(progress.completed / Math.max(1, progress.total) * 100)) : 0
        return <article key={instance.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-medium">{instance.name}</h3><span className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{instance.minecraftVersion}</span></div><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{instance.installed ? 'Installed' : 'Not installed'} · {instance.gameDirectory}</p>{activeProgress && <div className="mt-3 max-w-md"><div className="flex justify-between gap-3 text-[11px] text-[var(--text-secondary)]"><span className="truncate">{progress.currentFile}</span><span>{percent}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]"><div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${percent}%` }} /></div></div>}</div>
          <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => void install(instance)} disabled={busy || !isDesktop} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:border-[var(--accent)] disabled:opacity-50">{activeProgress ? <LoaderCircle className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}{instance.installed ? 'Repair / verify' : 'Install'}</button><button type="button" onClick={() => void rename(instance)} disabled={busy || !isDesktop} aria-label={`Rename ${instance.name}`} title="Rename instance" className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"><Pencil className="size-3.5" /></button><button type="button" onClick={() => void remove(instance)} disabled={busy || !isDesktop} aria-label={`Delete ${instance.name}`} title="Delete instance" className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"><Trash2 className="size-3.5" /></button></div>
        </article>
      })}</div>}
      <div className="mt-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-secondary)]">Game launch is unavailable until Microsoft account sign-in is configured. MOSS will not start authenticated versions without a verified Minecraft session.</div>
    </section>
  </div>
}