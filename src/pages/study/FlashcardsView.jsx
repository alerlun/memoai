import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../hooks/useLang'
import { XP_VALUES } from '../../lib/xp'

const FLIP_HALF_MS = 265
const SWIPE_THRESHOLD = 75   // px to trigger action
const SWIPE_MAX_TILT  = 18   // max degrees of tilt

export default function FlashcardsView({ set, onUpdateCards, onXPGain, onCardsStudied }) {
  const nav = useNavigate()
  const { t } = useLang()
  const cards = set.flashcards || []
  const [idx, setIdx]       = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [marks, setMarks]   = useState({})
  const [done, setDone]     = useState(false)
  const [swipeFlash, setSwipeFlash] = useState(null) // 'got' | 'again' | null

  const navTimerRef  = useRef(null)
  const cardRef      = useRef(null)
  const swipeRef     = useRef({ active: false, startX: 0, startY: 0, dx: 0 })

  const card    = cards[idx]
  const isLast  = idx === cards.length - 1
  const gotCount   = Object.values(marks).filter(v => v === 'got').length
  const againCount = Object.values(marks).filter(v => v === 'again').length

  function goTo(newIdx) {
    clearTimeout(navTimerRef.current)
    if (flipped) {
      setFlipped(false)
      navTimerRef.current = setTimeout(() => setIdx(newIdx), FLIP_HALF_MS)
    } else {
      setIdx(newIdx)
    }
  }

  function mark(r) {
    if (r === 'got' && flipped) onXPGain?.(XP_VALUES.FLASHCARD_GOT)
    if (r !== 'skip') onCardsStudied?.(1)
    setMarks(m => ({ ...m, [idx]: r }))
    if (!isLast) goTo(idx + 1)
  }

  function complete() {
    const finalMarks = { ...marks, [idx]: 'got' }
    if (flipped) onXPGain?.(XP_VALUES.FLASHCARD_GOT)
    onCardsStudied?.(1)
    setMarks(finalMarks)
    if (onUpdateCards) {
      const updatedCards = cards.map((c, i) => {
        const m = finalMarks[i]
        if (m === 'got')   return { ...c, memoryScore: Math.max(c.memoryScore || 0, 75), repetitions: (c.repetitions || 0) + 1 }
        if (m === 'again') return { ...c, memoryScore: Math.min(c.memoryScore || 0, 20) }
        return c
      })
      onUpdateCards(updatedCards)
    }
    setDone(true)
  }

  // ── Swipe handlers ──────────────────────────────────────────────────────────
  function onTouchStart(e) {
    const t = e.touches[0]
    swipeRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0 }
  }

  function onTouchMove(e) {
    if (!swipeRef.current.active) return
    const dx = e.touches[0].clientX - swipeRef.current.startX
    const dy = e.touches[0].clientY - swipeRef.current.startY
    // If mostly vertical scroll, cancel swipe
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dx) < 20) {
      swipeRef.current.active = false
      resetCardTransform()
      return
    }
    e.preventDefault()
    swipeRef.current.dx = dx
    applyCardDrag(dx)
  }

  function onTouchEnd() {
    if (!swipeRef.current.active) return
    swipeRef.current.active = false
    const dx = swipeRef.current.dx

    if (Math.abs(dx) < 10) {
      // Tap — flip the card
      resetCardTransform()
      setFlipped(f => !f)
      return
    }

    if (Math.abs(dx) >= SWIPE_THRESHOLD && flipped) {
      const action = dx > 0 ? 'got' : 'again'
      // Flash and fly card off screen
      flyCard(dx)
      setSwipeFlash(action)
      setTimeout(() => setSwipeFlash(null), 600)
      setTimeout(() => {
        resetCardTransform()
        mark(action)
      }, 280)
    } else {
      // Spring back
      springBack()
    }
  }

  function applyCardDrag(dx) {
    if (!cardRef.current) return
    const tilt = Math.min(SWIPE_MAX_TILT, Math.abs(dx) / 10) * Math.sign(dx)
    cardRef.current.style.transition = 'none'
    cardRef.current.style.transform  = `translateX(${dx}px) rotate(${tilt}deg)`
    cardRef.current.style.opacity    = String(1 - Math.min(0.4, Math.abs(dx) / 300))
  }

  function flyCard(dx) {
    if (!cardRef.current) return
    const dir = dx > 0 ? 1 : -1
    cardRef.current.style.transition = 'transform .28s ease-in, opacity .28s ease-in'
    cardRef.current.style.transform  = `translateX(${dir * 120}%) rotate(${dir * 28}deg)`
    cardRef.current.style.opacity    = '0'
  }

  function springBack() {
    if (!cardRef.current) return
    cardRef.current.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s ease'
    cardRef.current.style.transform  = ''
    cardRef.current.style.opacity    = '1'
  }

  function resetCardTransform() {
    if (!cardRef.current) return
    cardRef.current.style.transition = ''
    cardRef.current.style.transform  = ''
    cardRef.current.style.opacity    = '1'
  }

  if (!cards.length) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>No flashcards available.</div>
  )

  if (done) {
    const total = cards.length
    const pct = Math.round(gotCount / total * 100)
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          {pct >= 80 ? t('outstanding') : pct >= 50 ? t('good_work') : t('keep_going')}
        </div>
        <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 24 }}>
          {t('you_scored')} {gotCount} / {total}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ background: 'var(--gl)', border: '1px solid var(--gn)', borderRadius: 'var(--r)', padding: '12px 20px', minWidth: 90 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gn)' }}>{gotCount}</div>
            <div style={{ fontSize: 11, color: 'var(--gn)', fontWeight: 600 }}>{t('got_it')}</div>
          </div>
          <div style={{ background: 'var(--rl)', border: '1px solid var(--rd)', borderRadius: 'var(--r)', padding: '12px 20px', minWidth: 90 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--rd)' }}>{againCount}</div>
            <div style={{ fontSize: 11, color: 'var(--rd)', fontWeight: 600 }}>{t('again')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-s btn-lg" onClick={() => nav('/')}>🏠 {t('home')}</button>
          <button className="btn btn-p btn-lg" onClick={() => { setIdx(0); setFlipped(false); setMarks({}); setDone(false) }}>{t('retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Swipe hint labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, opacity: 0.35, pointerEvents: 'none' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rd)' }}>← Again</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gn)' }}>Got it →</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8, gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gn)' }}>✓ {gotCount}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rd)' }}>↩ {againCount}</span>
      </div>

      <div className="prog" style={{ marginBottom: 18 }}>
        <div className="prog-fill" style={{ width: `${(idx + 1) / cards.length * 100}%` }} />
      </div>

      {/* Swipe flash overlay */}
      {swipeFlash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, borderRadius: 'var(--r)',
          background: swipeFlash === 'got' ? 'rgba(52,211,153,.22)' : 'rgba(248,113,113,.22)',
          border: `2px solid ${swipeFlash === 'got' ? 'var(--gn)' : 'var(--rd)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56, animation: 'fadeIn .1s ease', pointerEvents: 'none',
          borderRadius: 20,
        }}>
          {swipeFlash === 'got' ? '✓' : '↩'}
        </div>
      )}

      {/* Card — touch events here */}
      <div
        ref={cardRef}
        className="fc-scene"
        style={{ marginBottom: 12, touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={e => {
          // Only flip on desktop click (touch is handled above)
          if (e.pointerType !== 'touch') setFlipped(f => !f)
        }}
      >
        <div className={`fc-card${flipped ? ' flipped' : ''}`}>
          <div className="fc-face fc-front">
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: .4, marginBottom: 12 }}>{t('question')}</div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.55 }}>{card?.q}</div>
          </div>
          <div className="fc-face fc-back">
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: .5, marginBottom: 12 }}>{t('answer')}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{card?.a}</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginBottom: 18 }}>
        {flipped ? '💡 Rate yourself below or swipe' : `${t('tap_to_reveal')} · swipe to rate`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <button onClick={() => mark('skip')}
          style={{ padding: '13px 4px', borderRadius: 'var(--rs)', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--bd)', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--sf)', color: 'var(--t2)' }}>
          {t('skip')}
        </button>
        <button onClick={() => flipped && mark('again')} disabled={!flipped}
          style={{ padding: '13px 4px', borderRadius: 'var(--rs)', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--rd)', cursor: flipped ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: 'var(--rl)', color: 'var(--rd)', opacity: flipped ? 1 : 0.35, transition: 'opacity .2s' }}>
          {t('again')}
        </button>
        {isLast ? (
          <button onClick={() => flipped && complete()} disabled={!flipped}
            style={{ padding: '13px 4px', borderRadius: 'var(--rs)', fontSize: 13, fontWeight: 700, border: 'none', cursor: flipped ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: 'var(--ac)', color: '#fff', opacity: flipped ? 1 : 0.35, transition: 'opacity .2s' }}>
            ✓ Done
          </button>
        ) : (
          <button onClick={() => flipped && mark('got')} disabled={!flipped}
            style={{ padding: '13px 4px', borderRadius: 'var(--rs)', fontSize: 13, fontWeight: 700, border: `1.5px solid ${flipped ? 'var(--gn)' : 'var(--bd)'}`, cursor: flipped ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: flipped ? 'var(--gl)' : 'var(--s3)', color: flipped ? 'var(--gn)' : 'var(--t3)', opacity: flipped ? 1 : 0.35, transition: 'all .2s' }}>
            {t('got_it')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <button disabled={idx === 0} onClick={() => goTo(idx - 1)}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid var(--bd2)', background: 'var(--s3)', color: 'var(--tx)', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 20, fontWeight: 700, opacity: idx === 0 ? .25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{idx + 1} / {cards.length}</span>
        <button disabled={isLast} onClick={() => goTo(idx + 1)}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid var(--bd2)', background: 'var(--s3)', color: 'var(--tx)', cursor: isLast ? 'not-allowed' : 'pointer', fontSize: 20, fontWeight: 700, opacity: isLast ? .25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
    </div>
  )
}
