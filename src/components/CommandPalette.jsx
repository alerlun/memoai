import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSets } from '../hooks/useSets'

const QUICK_ACTIONS = [
  { id: 'new',      icon: '⚡', label: 'New set',         desc: 'Upload material',       path: '/upload' },
  { id: 'settings', icon: '⚙️', label: 'Settings',        desc: 'Account & preferences', path: '/settings' },
  { id: 'achieve',  icon: '🏆', label: 'Achievements',    desc: 'Your badges & progress', path: '/achievements' },
  { id: 'home',     icon: '🏠', label: 'Home',            desc: 'Go to dashboard',        path: '/' },
]

function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--al)', color: 'var(--ac)', borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery]   = useState('')
  const [sel, setSel]       = useState(0)
  const nav                 = useNavigate()
  const { sets }            = useSets()
  const inputRef            = useRef(null)
  const listRef             = useRef(null)

  // Reset on open
  useEffect(() => {
    if (open) { setQuery(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 60) }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const actions = QUICK_ACTIONS.filter(a =>
      !q || a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    ).map(a => ({ ...a, type: 'action' }))

    const setItems = sets.filter(s =>
      !q || s.title?.toLowerCase().includes(q)
    ).slice(0, 6).flatMap(s => {
      const base = { id: s.id, icon: s.icon || '📚', title: s.title, type: 'set' }
      if (!q) return [{ ...base, mode: 'learn', label: s.title, desc: 'Learn' }]
      return [
        { ...base, mode: 'learn',     label: s.title, desc: 'Learn' },
        { ...base, mode: 'flashcards',label: s.title, desc: 'Flashcards' },
        { ...base, mode: 'quiz',      label: s.title, desc: 'Quiz' },
      ].filter(x => !q || x.label.toLowerCase().includes(q) || x.desc.toLowerCase().includes(q))
    })

    return [...actions, ...setItems]
  }, [query, sets])

  // Keep selection in bounds
  useEffect(() => { setSel(s => Math.min(s, Math.max(0, results.length - 1))) }, [results])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[sel]
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  function pick(item) {
    if (item.type === 'action') nav(item.path)
    else nav(`/study/${item.id}?mode=${item.mode}`)
    onClose()
  }

  function onKey(e) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')      { if (results[sel]) pick(results[sel]) }
    if (e.key === 'Escape')     onClose()
  }

  if (!open) return null

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'12vh' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width:'100%', maxWidth:560, margin:'0 16px', background:'var(--sf)', border:'1px solid var(--bd2)', borderRadius:'var(--r)', boxShadow:'var(--s3s)', animation:'cmdIn .18s ease', overflow:'hidden' }}>
        {/* Search bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid var(--bd)' }}>
          <span style={{ fontSize:16, opacity:.5, flexShrink:0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSel(0) }}
            onKeyDown={onKey}
            placeholder="Search sets or actions…"
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:15, color:'var(--tx)', fontFamily:'inherit', fontWeight:500 }}
          />
          <kbd style={{ fontSize:10, color:'var(--t3)', background:'var(--s3)', border:'1px solid var(--bd)', borderRadius:5, padding:'2px 6px', flexShrink:0 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight:360, overflowY:'auto', padding:'6px 0' }}>
          {results.length === 0 && (
            <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>No results for "{query}"</div>
          )}
          {results.map((item, i) => (
            <div
              key={`${item.id}-${item.mode || ''}`}
              onMouseEnter={() => setSel(i)}
              onMouseDown={() => pick(item)}
              style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
                background: i === sel ? 'var(--al)' : 'transparent',
                borderLeft: `3px solid ${i === sel ? 'var(--ac)' : 'transparent'}`,
                cursor:'pointer', transition:'background .1s',
              }}
            >
              <span style={{ fontSize:18, flexShrink:0, width:24, textAlign:'center' }}>{item.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--tx)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {highlight(item.label, query)}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
                  {item.type === 'set'
                    ? <><span style={{ color:'var(--ac)', fontWeight:600 }}>{item.desc}</span> · {item.title}</>
                    : item.desc
                  }
                </div>
              </div>
              {i === sel && <span style={{ fontSize:10, color:'var(--t3)', flexShrink:0 }}>↵</span>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'8px 16px', borderTop:'1px solid var(--bd)', display:'flex', gap:16, fontSize:10, color:'var(--t3)' }}>
          <span><kbd style={{ background:'var(--s3)', border:'1px solid var(--bd)', borderRadius:3, padding:'1px 5px' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background:'var(--s3)', border:'1px solid var(--bd)', borderRadius:3, padding:'1px 5px' }}>↵</kbd> open</span>
          <span><kbd style={{ background:'var(--s3)', border:'1px solid var(--bd)', borderRadius:3, padding:'1px 5px' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
