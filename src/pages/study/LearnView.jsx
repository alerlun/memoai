import { useState, useEffect, useRef } from 'react'
import { sm2 } from '../../lib/smartQuiz'
import { explainCard, generateMnemonic } from '../../lib/ai'
import { useLang } from '../../hooks/useLang'
import { XP_VALUES } from '../../lib/xp'

const LAST_SESSION_KEY = 'memoai_last_session'

export default function LearnView({ set, onUpdateCards, onXPGain, onCardsStudied }) {
  const { t, lang } = useLang()
  const cards = set.flashcards || []

  const [queue, setQueue] = useState(() => {
    const today = new Date()
    return cards
      .filter(c => !c.nextReview || new Date(c.nextReview) <= today)
      .sort(() => Math.random() - 0.5)
  })
  const [current, setCurrent]     = useState(0)
  const [phase, setPhase]         = useState('question')
  const [sessionStats, setSessionStats] = useState({ correct: 0, hard: 0, again: 0 })
  const [showHint, setShowHint]   = useState(false)
  const [explanation, setExplanation]   = useState(null)
  const [loadingExplain, setLoadingExplain] = useState(false)
  const [mnemonic, setMnemonic]   = useState(null)
  const [loadingMnemonic, setLoadingMnemonic] = useState(false)

  // Track per-card again count to trigger mnemonic offer
  const againMapRef  = useRef({})   // { [cardId]: againCount }
  // Track per-card rating history for progress summary
  const ratingMapRef = useRef({})   // { [cardId]: { q: string, times: n, againCount: n } }
  const sessionStartRef = useRef(Date.now())

  const card = queue[current]
  const cardAgainCount = card ? (againMapRef.current[card.id ?? current] ?? 0) : 0
  const showMnemonicOffer = phase === 'answer' && cardAgainCount >= 2 && !mnemonic && !loadingMnemonic

  const progress = cards.length > 0 ? Math.round(
    cards.filter(c => c.memoryScore > 60).length / cards.length * 100
  ) : 0

  function rate(quality) {
    const cardKey = card.id ?? current
    // Track again count for mnemonic offer
    if (quality === 1) {
      againMapRef.current[cardKey] = (againMapRef.current[cardKey] ?? 0) + 1
    }
    // Track rating history for summary
    if (!ratingMapRef.current[cardKey]) {
      ratingMapRef.current[cardKey] = { q: card.q, times: 0, againCount: 0 }
    }
    ratingMapRef.current[cardKey].times++
    if (quality === 1) ratingMapRef.current[cardKey].againCount++

    const updated = sm2(card, quality)
    const updatedCard = { ...card, ...updated }
    if (mnemonic) updatedCard.mnemonic = mnemonic

    const xpMap = { 5: XP_VALUES.LEARN_EASY, 4: XP_VALUES.LEARN_GOOD, 3: XP_VALUES.LEARN_HARD, 1: XP_VALUES.LEARN_AGAIN }
    onXPGain?.(xpMap[quality] ?? XP_VALUES.LEARN_AGAIN)
    onCardsStudied?.(1)

    const updatedCards = cards.map(c => (c.id ?? cards.indexOf(c)) === cardKey ? updatedCard : c)
    onUpdateCards(updatedCards)

    setSessionStats(s => ({
      correct: s.correct + (quality >= 4 ? 1 : 0),
      hard:    s.hard    + (quality === 3 ? 1 : 0),
      again:   s.again   + (quality <= 2 ? 1 : 0),
    }))

    if (current + 1 >= queue.length) {
      setPhase('done')
    } else {
      setCurrent(i => i + 1)
      setPhase('question')
      setShowHint(false)
      setExplanation(null)
      setMnemonic(null)
      setLoadingExplain(false)
      setLoadingMnemonic(false)
    }
  }

  async function askExpert() {
    if (!card) return
    setLoadingExplain(true); setExplanation(null)
    try {
      const result = await explainCard(card.q, card.a, set.source_text || '', lang)
      setExplanation(result)
    } catch { setExplanation('Could not load explanation. Please try again.') }
    finally { setLoadingExplain(false) }
  }

  async function handleGenerateMnemonic() {
    if (!card) return
    setLoadingMnemonic(true); setMnemonic(null)
    try {
      const result = await generateMnemonic(card.q, card.a)
      setMnemonic(result)
    } catch { setMnemonic('Could not generate memory trick. Try again.') }
    finally { setLoadingMnemonic(false) }
  }

  // ── No cards due ───────────────────────────────────────────────────────────
  if (queue.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>All caught up!</div>
      <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 20 }}>
        No cards due for review right now. Come back later.
      </div>
      <MemoryScoreBar cards={cards} />
    </div>
  )

  // ── Session done ───────────────────────────────────────────────────────────
  if (phase === 'done') {
    const total        = queue.length
    const sessionScore = total > 0 ? sessionStats.correct / total : 0
    const elapsed      = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const elapsedStr   = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`

    // Hardest card this session
    const hardestEntry = Object.values(ratingMapRef.current).sort((a, b) => b.againCount - a.againCount)[0]
    const hardestCard  = hardestEntry?.againCount >= 1 ? hardestEntry : null

    // Compare to last session
    const lastSession = (() => {
      try { return JSON.parse(localStorage.getItem(LAST_SESSION_KEY) || 'null') } catch { return null }
    })()
    const improvement = lastSession
      ? Math.round((sessionScore - lastSession.score) * 100)
      : null

    // Save this session for next time
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify({
      score: sessionScore, date: new Date().toISOString(), cards: total, elapsed,
    }))

    return (
      <div style={{ padding: '28px 16px' }}>
        {/* Emoji + headline */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>
            {sessionScore >= 0.8 ? '🎉' : sessionScore >= 0.5 ? '👍' : '💪'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Session complete!</div>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>{elapsedStr} · {total} cards reviewed</div>
        </div>

        {/* Score pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
          <StatPill color="var(--gn)" label="Easy"  val={sessionStats.correct} />
          <StatPill color="var(--am)" label="Hard"  val={sessionStats.hard}    />
          <StatPill color="var(--rd)" label="Again" val={sessionStats.again}   />
        </div>

        {/* Comparison vs last session */}
        {improvement !== null && (
          <div style={{ background: improvement >= 0 ? 'var(--gl)' : 'var(--rl)', border: `1px solid ${improvement >= 0 ? 'var(--gn)' : 'var(--rd)'}`, borderRadius: 'var(--rs)', padding: '11px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: improvement >= 0 ? 'var(--gn)' : 'var(--rd)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{improvement >= 0 ? '📈' : '📉'}</span>
            <span>
              {improvement > 0
                ? `${improvement}% better than last session`
                : improvement === 0
                  ? 'Same score as last session'
                  : `${Math.abs(improvement)}% lower than last session — keep going!`}
            </span>
          </div>
        )}

        {/* Hardest card */}
        {hardestCard && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '11px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
              🔥 Hardest card — reviewed {hardestCard.times}× today
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx)', fontStyle: 'italic', lineHeight: 1.4 }}>
              "{hardestCard.q}"
            </div>
          </div>
        )}

        <MemoryScoreBar cards={cards} />

        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-p" onClick={() => {
            setCurrent(0); setPhase('question'); setShowHint(false)
            setSessionStats({ correct: 0, hard: 0, again: 0 })
            againMapRef.current = {}; ratingMapRef.current = {}
            sessionStartRef.current = Date.now()
          }}>
            🔄 Study Again
          </button>
        </div>
      </div>
    )
  }

  // ── Active card ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
          <span>{current + 1} / {queue.length} cards</span>
          <span>Memory: {progress}%</span>
        </div>
        <div className="prog"><div className="prog-fill" style={{ width: `${(current / queue.length) * 100}%` }} /></div>
      </div>

      {/* Card */}
      <div className="card" style={{ padding: 28, minHeight: 180, marginBottom: 16, textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
          {phase === 'question' ? 'QUESTION' : 'ANSWER'}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.55, marginBottom: phase === 'answer' ? 16 : 0 }}>
          {phase === 'question' ? card?.q : card?.a}
        </div>

        {/* Hint */}
        {phase === 'question' && showHint && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: 'var(--aml)', borderRadius: 'var(--rs)', fontSize: 12, color: 'var(--am)', fontStyle: 'italic' }}>
            Hint: {card?.a?.split(' ').slice(0, 5).join(' ')}…
          </div>
        )}

        {/* Stored mnemonic shown on answer side */}
        {phase === 'answer' && (card?.mnemonic || mnemonic) && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'linear-gradient(135deg,rgba(251,191,36,.12),rgba(245,158,11,.08))', border: '1px solid rgba(251,191,36,.35)', borderRadius: 'var(--rs)', fontSize: 12, color: '#fbbf24', lineHeight: 1.5, textAlign: 'left' }}>
            <span style={{ fontWeight: 800, marginRight: 6 }}>💡 Memory trick:</span>
            {card?.mnemonic || mnemonic}
          </div>
        )}
      </div>

      {phase === 'question' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-p btn-w btn-lg" onClick={() => setPhase('answer')}>
            Show Answer
          </button>
          {!showHint && (
            <button className="btn btn-s btn-w" onClick={() => setShowHint(true)} style={{ fontSize: 13 }}>
              💡 Show Hint
            </button>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textAlign: 'center', marginBottom: 10 }}>
            How well did you know this?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <button onClick={() => rate(1)} style={{ padding: '14px 8px', borderRadius: 'var(--r)', border: '2px solid var(--rd)', background: 'var(--rl)', color: 'var(--rd)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              😕 Again<br/><span style={{ fontSize: 11, fontWeight: 500 }}>Didn't know it</span>
            </button>
            <button onClick={() => rate(3)} style={{ padding: '14px 8px', borderRadius: 'var(--r)', border: '2px solid var(--am)', background: 'var(--aml)', color: 'var(--am)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              🤔 Hard<br/><span style={{ fontSize: 11, fontWeight: 500 }}>Got it with effort</span>
            </button>
            <button onClick={() => rate(4)} style={{ padding: '14px 8px', borderRadius: 'var(--r)', border: '2px solid var(--gn)', background: 'var(--gl)', color: 'var(--gn)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              😊 Good<br/><span style={{ fontSize: 11, fontWeight: 500 }}>Knew it well</span>
            </button>
            <button onClick={() => rate(5)} style={{ padding: '14px 8px', borderRadius: 'var(--r)', border: '2px solid var(--ac)', background: 'var(--al)', color: 'var(--ac)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              🚀 Easy<br/><span style={{ fontSize: 11, fontWeight: 500 }}>Perfect recall</span>
            </button>
          </div>

          {/* Mnemonic generator — shown after 2+ Again ratings */}
          {showMnemonicOffer && (
            <button onClick={handleGenerateMnemonic}
              style={{ width: '100%', padding: '11px', borderRadius: 'var(--r)', border: '1.5px solid #fbbf24', background: 'rgba(251,191,36,.1)', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, marginBottom: 10 }}>
              🧠 Generate Memory Trick — you've missed this {cardAgainCount}×
            </button>
          )}
          {loadingMnemonic && (
            <div style={{ textAlign: 'center', padding: '10px', fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>✨</span> Generating memory trick…
            </div>
          )}

          {/* Expert explanation */}
          <div>
            {!explanation && !loadingExplain && (
              <button onClick={askExpert}
                style={{ width: '100%', padding: '11px', borderRadius: 'var(--r)', border: '1.5px solid var(--ac)', background: 'var(--al)', color: 'var(--ac)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                💡 Expert Explanation
              </button>
            )}
            {loadingExplain && (
              <div style={{ textAlign: 'center', padding: '12px', fontSize: 13, color: 'var(--t2)' }}>
                <span style={{ animation: 'pulse 1s infinite' }}>✨</span> Generating explanation…
              </div>
            )}
            {explanation && (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--r)', background: 'linear-gradient(135deg,var(--al),#f0f4ff)', border: '1.5px solid var(--ac)', fontSize: 13, lineHeight: 1.65, color: 'var(--tx)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ac)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>💡 Expert Explanation</div>
                {explanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatPill({ color, label, val }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--t2)' }}>{label}</div>
    </div>
  )
}

function MemoryScoreBar({ cards }) {
  const avg = cards.length ? Math.round(cards.reduce((a, c) => a + (c.memoryScore || 0), 0) / cards.length) : 0
  const color = avg >= 70 ? 'var(--gn)' : avg >= 40 ? 'var(--am)' : 'var(--rd)'
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🧠 Memory Score</span>
        <span style={{ fontSize: 13, fontWeight: 900, color }}>{avg}%</span>
      </div>
      <div className="prog">
        <div className="prog-fill" style={{ width: `${avg}%`, background: color }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
        {cards.filter(c => c.memoryScore >= 70).length} of {cards.length} cards mastered
      </div>
    </div>
  )
}
