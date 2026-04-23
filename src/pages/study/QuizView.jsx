import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../hooks/useLang'
import { XP_VALUES } from '../../lib/xp'

const LABELS = ['A','B','C','D']

// ── CSS-only confetti ─────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#fbbf24','#f87171','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c']
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    left:     `${Math.random() * 100}%`,
    delay:    `${Math.random() * 0.7}s`,
    duration: `${0.9 + Math.random() * 1.1}s`,
    color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size:     `${5 + Math.random() * 7}px`,
    rotate:   Math.round(Math.random() * 360),
    circle:   Math.random() > 0.55,
  })), [])
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:900, overflow:'hidden' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position:'absolute', top:'-12px', left:p.left,
          width:p.size, height:p.size,
          background:p.color,
          borderRadius: p.circle ? '50%' : '2px',
          transform:`rotate(${p.rotate}deg)`,
          animation:`confettiFall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
    </div>
  )
}
const DIFF_COLOR = { easy: 'var(--gn)', medium: 'var(--am)', hard: 'var(--rd)' }
const MAX_HEARTS = 3

export default function QuizView({ set, onUpdateCards, onXPGain, onCardsStudied, onSessionComplete }) {
  const { t } = useLang()
  const nav = useNavigate()
  const quiz = set.quiz || []
  const [qi, setQi] = useState(0)
  const [qscore, setQscore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [quizDone, setQuizDone] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [selected, setSelected] = useState(null)
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [shakingHeart, setShakingHeart] = useState(false)
  const scoreRef    = useRef(0)
  const heartsRef   = useRef(MAX_HEARTS)
  const startTimeRef = useRef(Date.now())

  const q = quiz[qi]
  const pct = quiz.length ? Math.round(qscore / quiz.length * 100) : 0

  function answer(idx) {
    if (answered) return
    setAnswered(true)
    setSelected(idx)
    onCardsStudied?.(1)

    if (idx === q.correct) {
      scoreRef.current++
      setQscore(scoreRef.current)
      onXPGain?.(XP_VALUES.QUIZ_CORRECT)
    } else {
      heartsRef.current--
      setHearts(heartsRef.current)
      setShakingHeart(true)
      setTimeout(() => setShakingHeart(false), 500)
      if (heartsRef.current <= 0) {
        // Trigger game over after showing the wrong answer briefly
        setTimeout(() => setGameOver(true), 1200)
      }
    }
  }

  function next() {
    if (qi + 1 >= quiz.length) { finishQuiz(); return }
    setQi(i => i + 1)
    setAnswered(false)
    setSelected(null)
  }

  function finishQuiz() {
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    const finalPct = quiz.length ? Math.round(scoreRef.current / quiz.length * 100) : 0
    const perfect = finalPct === 100
    const ironHeart = perfect && heartsRef.current === MAX_HEARTS
    const speedDemon = elapsed < 90
    const ultraSpeed = elapsed < 60
    setQuizDone(true)
    if (perfect) onXPGain?.(XP_VALUES.QUIZ_PERFECT_BONUS)
    onSessionComplete?.({ quizCompleted: true, perfect, ironHeart, speedDemon, ultraSpeed })
    if (onUpdateCards && set.flashcards?.length) {
      const updatedCards = set.flashcards.map(card => ({
        ...card,
        memoryScore: perfect
          ? 100
          : Math.min(95, Math.max(card.memoryScore || 0, Math.round(finalPct * 0.9))),
      }))
      onUpdateCards(updatedCards)
    }
  }

  function retry() {
    setQi(0); setQscore(0); scoreRef.current = 0
    setAnswered(false); setSelected(null)
    setQuizDone(false); setGameOver(false)
    setHearts(MAX_HEARTS); heartsRef.current = MAX_HEARTS
    startTimeRef.current = Date.now()
  }

  if (!quiz.length) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>{t('no_quiz')}</div>
  )

  // ── Game Over ──────────────────────────────────────────────────────────────
  if (gameOver) return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>💔</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Out of hearts!</h2>
      <p style={{ color: 'var(--t2)', fontSize: 14, marginBottom: 8 }}>
        You answered {scoreRef.current} out of {qi + 1} correctly before running out.
      </p>
      <p style={{ color: 'var(--t3)', fontSize: 12, marginBottom: 24 }}>
        Practice in Learn mode to build up your memory before trying the quiz again.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-s" style={{ flex: 1 }} onClick={() => nav('/')}>🏠 {t('home')}</button>
        <button className="btn btn-p" style={{ flex: 1 }} onClick={retry}>Try Again</button>
      </div>
    </div>
  )

  // ── Quiz Done ──────────────────────────────────────────────────────────────
  if (quizDone) {
    const perfect = pct === 100
    return (
      <>
        {perfect && <Confetti />}
        {/* Full-screen celebration overlay for perfect score */}
        {perfect ? (
          <div style={{ textAlign:'center', padding:'32px 20px', animation:'celebIn .5s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ fontSize:72, marginBottom:12, animation:'float 2s ease-in-out infinite' }}>🏆</div>
            <div style={{ fontSize:28, fontWeight:900, letterSpacing:'-.5px', marginBottom:6, background:'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Perfect Score!
            </div>
            <div style={{ fontSize:15, color:'var(--t2)', marginBottom:20 }}>
              {qscore}/{quiz.length} correct · all hearts intact
            </div>
            {/* Big score ring */}
            <div style={{ width:110, height:110, borderRadius:'50%', background:'var(--gl)', border:'4px solid var(--gn)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', boxShadow:'0 0 40px rgba(52,211,153,.35)' }}>
              <div style={{ fontSize:30, fontWeight:900, color:'var(--gn)', lineHeight:1 }}>100%</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--gn)' }}>PERFECT</div>
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:24 }}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <span key={i} style={{ fontSize:22 }}>❤️</span>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button className="btn btn-s" style={{ flex:1 }} onClick={() => nav('/')}>🏠 {t('home')}</button>
              <button className="btn btn-p" style={{ flex:1 }} onClick={retry}>Play Again</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--al)', border: '4px solid var(--ac)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ac)', lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ac)' }}>{t('score')}</div>
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>
              {pct >= 80 ? t('outstanding') : pct >= 60 ? t('good_work') : t('keep_going')}
            </h2>
            <p style={{ color: 'var(--t2)', fontSize: 14, marginBottom: 20 }}>
              {t('you_scored')} {qscore} {t('out_of')} {quiz.length}.
            </p>
            <p style={{ color: 'var(--t3)', fontSize: 12, marginBottom: 16 }}>
              Get all questions correct to reach 100%.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <span key={i} style={{ fontSize: 20, opacity: i < hearts ? 1 : .25 }}>❤️</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-s" style={{ flex: 1 }} onClick={() => nav('/')}>🏠 {t('home')}</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={retry}>{t('retry')}</button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Active Quiz ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header: hearts + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, animation: shakingHeart ? 'heartShake .4s ease' : 'none' }}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <span key={i} style={{ fontSize: 20, opacity: i < hearts ? 1 : .2, transition: 'opacity .3s' }}>❤️</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--t2)' }}>{t('question_of')} {qi + 1} {t('of')} {quiz.length}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac)' }}>{t('score')}: {qscore}</span>
          {q?.difficulty && (
            <span style={{ fontSize: 10, fontWeight: 700, color: DIFF_COLOR[q.difficulty] || 'var(--t3)', background: 'var(--s2)', padding: '2px 8px', borderRadius: 10 }}>
              {q.difficulty}
            </span>
          )}
        </div>
      </div>

      <div className="prog" style={{ marginBottom: 14 }}>
        <div className="prog-fill" style={{ width: `${qi / quiz.length * 100}%` }} />
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.55 }}>{q?.q}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {q?.options.map((opt, i) => {
          const isCorrect = i === q.correct; const isSelected = i === selected
          let bg = 'var(--sf)', border = 'var(--bd)', col = 'var(--tx)'
          if (answered) {
            if (isCorrect) { bg='var(--gl)'; border='var(--gn)'; col='var(--gn)' }
            else if (isSelected) { bg='var(--rl)'; border='var(--rd)'; col='var(--rd)' }
          }
          return (
            <button key={i} className={`qopt${answered?' dis':''}`}
              style={{ background:bg, borderColor:border }}
              onClick={() => answer(i)}>
              <div style={{ width:26, height:26, borderRadius:'50%', background: answered&&isCorrect?'var(--gn)':answered&&isSelected?'var(--rd)':isSelected?'var(--ac)':'var(--s2)', color:(answered&&(isCorrect||isSelected))||isSelected?'#fff':'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                {LABELS[i]}
              </div>
              <span style={{ flex:1, fontSize:13, lineHeight:1.4, color:col }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div style={{ padding:'13px 15px', borderRadius:'var(--rs)', marginBottom:12, fontSize:13, lineHeight:1.5, background:selected===q.correct?'var(--gl)':'var(--rl)', borderLeft:`4px solid ${selected===q.correct?'var(--gn)':'var(--rd)'}`, color:selected===q.correct?'var(--gn)':'var(--rd)' }}>
          <strong>{selected===q.correct?t('correct'):t('not_quite')}</strong> {q?.explanation}
        </div>
      )}
      {answered && !gameOver && (
        <button className="btn btn-p btn-w" onClick={next}>
          {qi+1>=quiz.length ? t('see_results') : t('next')}
        </button>
      )}
    </div>
  )
}
