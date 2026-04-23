import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSets } from '../hooks/useSets'
import { useLang } from '../hooks/useLang'
import { useAuth } from '../hooks/useAuth'
import { XP_VALUES, DAILY_GOAL, getLevelFromXP, getMilestone, getNextMilestone } from '../lib/xp'
import { ACHIEVEMENTS, RARITY } from '../lib/achievements'
import FlashcardsView from './study/FlashcardsView'
import LearnView from './study/LearnView'
import QuizView from './study/QuizView'
import PracticeTestView from './study/PracticeTestView'
import MagicNotesView from './study/MagicNotesView'

const MODES = [
  { id:'cards', icon:'🃏', label:'Flashcards' },
  { id:'learn', icon:'🧠', label:'Learn' },
  { id:'quiz',  icon:'🎯', label:'Quiz' },
  { id:'test',  icon:'📝', label:'Test' },
  { id:'notes', icon:'✨', label:'Notes' },
]

export default function StudyPage() {
  const { id } = useParams()
  const { sets, updateProgress, updateSet } = useSets()
  const { t } = useLang()
  const { totalXP, addXP, achievements, unlockAchievements,
          totalCardsStudied, perfectQuizzes, quizzesCompleted,
          addCardsStudied, recordQuizComplete, profile } = useAuth()
  const nav = useNavigate()
  const [mode, setMode]           = useState('cards')
  const [preStudy, setPreStudy]   = useState(true)
  const [xpToast, setXPToast]     = useState(null)
  const [levelUp, setLevelUp]     = useState(null)
  const [achToast, setAchToast]   = useState(null)
  const [achLeaving, setAchLeaving] = useState(false)
  const toastTimerRef   = useRef(null)
  const achTimerRef     = useRef(null)
  const achQueueRef     = useRef([])
  const showingAchRef   = useRef(false)
  const localXPRef      = useRef(totalXP)
  const goalCountRef    = useRef(0)  // cards studied this session toward goal

  const set = sets.find(s => s.id === id)

  if (!set) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ fontSize:40 }}>📚</div>
      <p style={{ color:'var(--t2)' }}>{t('set_not_found')}</p>
      <button className="btn btn-p" onClick={() => nav('/')}>{t('go_home')}</button>
    </div>
  )

  const cards = set.flashcards || []
  const avgMemory = cards.length ? Math.round(cards.reduce((a,c) => a+(c.memoryScore||0),0)/cards.length) : 0
  const masteredCount   = cards.filter(c => (c.memoryScore || 0) >= 70).length
  const learningCount   = cards.filter(c => (c.repetitions || 0) > 0 && (c.memoryScore || 0) < 70).length
  const notStartedCount = cards.length - masteredCount - learningCount

  // ── Achievement toast queue ──────────────────────────────────────────────
  const ACH_SHOW_MS = 3800  // how long it's fully visible
  const ACH_OUT_MS  = 500   // exit animation duration

  function showNextAchToast() {
    if (!achQueueRef.current.length) { showingAchRef.current = false; return }
    showingAchRef.current = true
    const next = achQueueRef.current.shift()
    setAchLeaving(false)
    setAchToast(next)
    // Trigger exit animation before unmounting
    achTimerRef.current = setTimeout(() => {
      setAchLeaving(true)
      setTimeout(() => {
        setAchToast(null)
        setAchLeaving(false)
        setTimeout(showNextAchToast, 200)
      }, ACH_OUT_MS)
    }, ACH_SHOW_MS)
  }

  function queueAchToast(ach) {
    achQueueRef.current.push(ach)
    if (!showingAchRef.current) showNextAchToast()
  }

  // ── Achievement checking ─────────────────────────────────────────────────
  function checkAchievements(extraStats = {}) {
    // Build stats from profile + sets data + session extras
    const streak    = (() => {
      const s = parseInt(localStorage.getItem('memoai_streak') || '0')
      const last = localStorage.getItem('memoai_last_study') || ''
      const today = new Date().toDateString()
      const yest  = new Date(); yest.setDate(yest.getDate() - 1)
      return (last === today || last === yest.toDateString()) ? s : 0
    })()

    const goalDate  = localStorage.getItem('memoai_goal_date') || ''
    const goalCount = parseInt(localStorage.getItem('memoai_goal_count') || '0')
    const goalStreak = parseInt(localStorage.getItem('memoai_goal_streak') || '0')
    const goalCompleted = goalDate === new Date().toDateString() && goalCount >= DAILY_GOAL

    const allCards = sets.flatMap(s => s.flashcards || [])
    const masteredCards = allCards.filter(c => (c.memoryScore || 0) >= 70).length
    const masteredSets  = sets.filter(s => {
      const sc = s.flashcards || []
      return sc.length > 0 && sc.every(c => (c.memoryScore || 0) >= 70)
    }).length

    const level = getLevelFromXP(localXPRef.current)

    const stats = {
      streak,
      level,
      totalCardsStudied: (totalCardsStudied || 0) + (extraStats.cardsStudied || 0),
      masteredCards,
      setsCount: sets.length,
      masteredSets,
      perfectQuizzes: (perfectQuizzes || 0) + (extraStats.perfect ? 1 : 0),
      quizzesCompleted: (quizzesCompleted || 0) + (extraStats.quizCompleted ? 1 : 0),
      goalCompleted,
      goalStreak,
      ironHeart:  extraStats.ironHeart  || false,
      speedDemon: extraStats.speedDemon || false,
      ultraSpeed: extraStats.ultraSpeed || false,
      earlyBird:  new Date().getHours() < 8,
      nightOwl:   new Date().getHours() >= 23,
    }

    const unlockedIds = achievements || []
    stats.unlockedCount = unlockedIds.length
    const newlyUnlocked = ACHIEVEMENTS.filter(a =>
      !unlockedIds.includes(a.id) && a.check(stats)
    )

    if (newlyUnlocked.length) {
      unlockAchievements(newlyUnlocked.map(a => a.id))
      newlyUnlocked.forEach(a => queueAchToast(a))
    }
  }

  // ── XP gain ──────────────────────────────────────────────────────────────
  function handleXPGain(amount) {
    if (!amount || amount <= 0) return
    const prevLevel = getLevelFromXP(localXPRef.current)
    localXPRef.current += amount
    const newLevel = getLevelFromXP(localXPRef.current)
    addXP(amount)

    clearTimeout(toastTimerRef.current)
    setXPToast({ amount, key: Date.now() })
    toastTimerRef.current = setTimeout(() => setXPToast(null), 1600)

    if (newLevel > prevLevel) {
      setLevelUp({ level: newLevel, milestone: getMilestone(newLevel), next: getNextMilestone(newLevel) })
      checkAchievements()
    }
  }

  // ── Streak ───────────────────────────────────────────────────────────────
  function updateStreak() {
    const today = new Date().toDateString()
    const lastStudy = localStorage.getItem('memoai_last_study') || ''
    if (lastStudy === today) return false
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const current = parseInt(localStorage.getItem('memoai_streak') || '0')
    const next = lastStudy === yesterday.toDateString() ? current + 1 : 1
    localStorage.setItem('memoai_streak', String(next))
    localStorage.setItem('memoai_last_study', today)
    // Record in 30-day history for streak calendar
    const hist = JSON.parse(localStorage.getItem('memoai_study_history') || '[]')
    if (!hist.includes(today)) {
      hist.push(today)
      // Keep only last 35 days
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 34)
      localStorage.setItem('memoai_study_history', JSON.stringify(
        hist.filter(d => new Date(d) >= cutoff)
      ))
    }
    return true
  }

  // ── Daily goal tracking ──────────────────────────────────────────────────
  function handleCardStudied(count = 1) {
    addCardsStudied(count)
    goalCountRef.current += count

    const today = new Date().toDateString()

    // Record per-day activity for contribution graph
    const activity = JSON.parse(localStorage.getItem('memoai_activity') || '{}')
    activity[today] = (activity[today] || 0) + count
    // Prune entries older than 366 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 365)
    Object.keys(activity).forEach(k => { if (new Date(k) < cutoff) delete activity[k] })
    localStorage.setItem('memoai_activity', JSON.stringify(activity))

    const storedDate  = localStorage.getItem('memoai_goal_date') || ''
    const storedCount = storedDate === today ? parseInt(localStorage.getItem('memoai_goal_count') || '0') : 0
    const newCount    = storedCount + count

    localStorage.setItem('memoai_goal_date',  today)
    localStorage.setItem('memoai_goal_count', String(newCount))

    // Goal just completed?
    if (storedCount < DAILY_GOAL && newCount >= DAILY_GOAL) {
      const storedStreak = parseInt(localStorage.getItem('memoai_goal_streak') || '0')
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const lastGoal  = localStorage.getItem('memoai_goal_last') || ''
      const newStreak = lastGoal === yesterday.toDateString() ? storedStreak + 1 : 1
      localStorage.setItem('memoai_goal_streak', String(newStreak))
      localStorage.setItem('memoai_goal_last',   today)
      handleXPGain(XP_VALUES.DAILY_GOAL_BONUS)
      checkAchievements()
    }
  }

  // ── Update cards ─────────────────────────────────────────────────────────
  function handleUpdateCards(updatedCards) {
    const newProgress = updatedCards.length
      ? Math.round(updatedCards.reduce((a, c) => a + (c.memoryScore || 0), 0) / updatedCards.length)
      : 0
    updateProgress(set.id, newProgress, updatedCards)
    const firstToday = updateStreak()
    if (firstToday) handleXPGain(XP_VALUES.STREAK_BONUS)
    checkAchievements()
  }

  // ── Quiz session complete ─────────────────────────────────────────────────
  function handleSessionComplete(stats) {
    recordQuizComplete(stats.perfect)
    checkAchievements(stats)
  }

  const MODE_INFO = [
    { id:'cards', icon:'🃏', label:'Flashcards', desc:'Flip & self-rate' },
    { id:'learn', icon:'🧠', label:'Learn',       desc:'Spaced repetition' },
    { id:'quiz',  icon:'🎯', label:'Quiz',        desc:'Multiple choice' },
    { id:'test',  icon:'📝', label:'Test',        desc:'Practice exam' },
    { id:'notes', icon:'✨', label:'Notes',       desc:'AI summary' },
  ]

  // ── Pre-study overview screen ────────────────────────────────────────────
  if (preStudy) return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <div className="nb">
        <button className="btn btn-g btn-sm" onClick={() => nav('/')}>← {t('home')}</button>
        <div style={{ flex:1 }} />
      </div>
      <div style={{ flex:1, padding:'20px', maxWidth:540, margin:'0 auto', width:'100%', paddingBottom:40 }}>
        {/* Set header */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>{set.icon || '📚'}</div>
          <h1 style={{ fontSize:22, fontWeight:900, letterSpacing:'-.4px', marginBottom:4 }}>{set.title}</h1>
          <div style={{ fontSize:13, color:'var(--t2)' }}>{cards.length} cards</div>
        </div>

        {/* Coverage widget */}
        {cards.length > 0 && (
          <div className="card" style={{ padding:'14px 16px', marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px' }}>Subject Coverage</span>
              <span style={{ fontSize:12, fontWeight:700, color: masteredCount===cards.length?'var(--gn)':'var(--t2)' }}>{masteredCount}/{cards.length} mastered</span>
            </div>
            <div style={{ height:8, borderRadius:6, background:'var(--s3)', overflow:'hidden', display:'flex', marginBottom:10 }}>
              <div style={{ width:`${cards.length?masteredCount/cards.length*100:0}%`, background:'var(--gn)', animation:'barGrow .9s ease', transition:'width .4s' }} />
              <div style={{ width:`${cards.length?learningCount/cards.length*100:0}%`, background:'var(--am)', animation:'barGrow .9s .1s ease', transition:'width .4s' }} />
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {[{v:masteredCount,l:'Mastered',bg:'var(--gl)',c:'var(--gn)'},{v:learningCount,l:'Learning',bg:'var(--aml)',c:'var(--am)'},{v:notStartedCount,l:'New',bg:'var(--s2)',c:'var(--t3)'}].map(x=>(
                <div key={x.l} style={{ flex:1, background:x.bg, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:x.c, lineHeight:1.1 }}>{x.v}</div>
                  <div style={{ fontSize:10, color:x.c, fontWeight:700, marginTop:2 }}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode picker */}
        <div style={{ marginBottom:20 }}>
          <div className="sechd" style={{ marginBottom:10 }}>Choose a mode</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {MODE_INFO.map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setPreStudy(false) }}
                style={{ padding:'14px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--bd)', background:'var(--sf)', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--ac)'; e.currentTarget.style.background='var(--al)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--bd)'; e.currentTarget.style.background='var(--sf)' }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{m.icon}</div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--tx)' }}>{m.label}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-p btn-lg btn-w" onClick={() => { setMode('learn'); setPreStudy(false) }}>
          🧠 Start Studying
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <div className="nb">
        <button className="btn btn-g btn-sm" onClick={() => setPreStudy(true)}>← Overview</button>
        <div style={{ flex:1, minWidth:0, textAlign:'center', padding:'0 8px' }}>
          <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{set.title}</div>
          <div style={{ fontSize:11, color:'var(--t3)' }}>{cards.length} {t('cards')}</div>
        </div>
        <div style={{ background: avgMemory>=70?'var(--gl)':avgMemory>=40?'var(--aml)':'var(--al)', borderRadius:20, padding:'4px 11px', fontSize:11, fontWeight:700, color: avgMemory>=70?'var(--gn)':avgMemory>=40?'var(--am)':'var(--ac)', flexShrink:0 }}>
          🧠 {avgMemory}%
        </div>
      </div>

      <div style={{ background:'var(--sf)', borderBottom:'1px solid var(--bd)', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ display:'flex', padding:'0 6px', minWidth:'max-content' }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`mode-tab${mode===m.id?' on':''}`}>
              <span className="icon">{m.icon}</span>
              <span className="lbl">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, padding:'16px 20px', maxWidth:640, margin:'0 auto', width:'100%', paddingBottom:40 }}>
        {cards.length > 0 && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Subject Coverage</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: masteredCount === cards.length && cards.length > 0 ? 'var(--gn)' : 'var(--t2)' }}>
                {masteredCount}/{cards.length} mastered
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'var(--s3)', overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
              <div style={{ width: `${cards.length ? masteredCount / cards.length * 100 : 0}%`, background: 'var(--gn)', transition: 'width .45s ease' }} />
              <div style={{ width: `${cards.length ? learningCount / cards.length * 100 : 0}%`, background: 'var(--am)', transition: 'width .45s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: 'var(--gl)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gn)', lineHeight: 1.1 }}>{masteredCount}</div>
                <div style={{ fontSize: 10, color: 'var(--gn)', fontWeight: 700, marginTop: 2 }}>Mastered</div>
              </div>
              <div style={{ flex: 1, background: 'var(--aml)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--am)', lineHeight: 1.1 }}>{learningCount}</div>
                <div style={{ fontSize: 10, color: 'var(--am)', fontWeight: 700, marginTop: 2 }}>Learning</div>
              </div>
              <div style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t3)', lineHeight: 1.1 }}>{notStartedCount}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, marginTop: 2 }}>New</div>
              </div>
            </div>
          </div>
        )}
        {mode==='cards' && <FlashcardsView set={set} onUpdateCards={handleUpdateCards} onXPGain={handleXPGain} onCardsStudied={handleCardStudied} />}
        {mode==='learn' && <LearnView set={set} onUpdateCards={handleUpdateCards} onXPGain={handleXPGain} onCardsStudied={handleCardStudied} />}
        {mode==='quiz'  && <QuizView set={set} onUpdateCards={handleUpdateCards} onXPGain={handleXPGain} onCardsStudied={handleCardStudied} onSessionComplete={handleSessionComplete} />}
        {mode==='test'  && <PracticeTestView set={set} onSaveTest={qs => updateSet(set.id, { practice_test: qs })} />}
        {mode==='notes' && <MagicNotesView set={set} onSaveNotes={notes => updateSet(set.id, { magic_notes: notes })} />}
      </div>

      {/* ── XP Toast ── */}
      {xpToast && (
        <div key={xpToast.key} style={{ position:'fixed', bottom:88, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,var(--ac),#a855f7)', color:'#fff', padding:'7px 18px', borderRadius:20, fontSize:14, fontWeight:800, boxShadow:'0 4px 24px rgba(139,127,245,.45)', animation:'xpToast 1.5s ease forwards', pointerEvents:'none', zIndex:600, whiteSpace:'nowrap', letterSpacing:'-.2px' }}>
          ⚡ +{xpToast.amount} XP
        </div>
      )}

      {/* ── Achievement Toast (Xbox-style, bottom-left) ── */}
      {achToast && (() => {
        const rarity = RARITY[achToast.rarity]
        return (
          <div style={{
            position: 'fixed', bottom: 24, left: 16, zIndex: 700,
            animation: achLeaving
              ? `achOut ${ACH_OUT_MS}ms cubic-bezier(.4,0,.6,1) forwards`
              : 'achIn .55s cubic-bezier(.34,1.42,.64,1) forwards',
            pointerEvents: 'none', maxWidth: 300, minWidth: 260,
          }}>
            {/* Card */}
            <div style={{
              background: 'rgba(8,8,16,.96)',
              border: `1.5px solid ${rarity.color}`,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: `0 8px 32px ${rarity.color}55, 0 2px 8px rgba(0,0,0,.6)`,
            }}>
              {/* Top row */}
              <div style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Icon with pop animation */}
                <div style={{
                  width: 48, height: 48, borderRadius: 11,
                  background: `radial-gradient(circle at 35% 35%, ${rarity.color}33, ${rarity.color}11)`,
                  border: `1.5px solid ${rarity.color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                  animation: 'achIconPop .5s .15s cubic-bezier(.34,1.56,.64,1) both',
                }}>
                  {achToast.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: rarity.color, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3, opacity: .9 }}>
                    Achievement Unlocked
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 2, letterSpacing: '-.2px' }}>
                    {achToast.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', lineHeight: 1.3 }}>
                    {achToast.desc}
                  </div>
                </div>
                {/* Gamerscore badge */}
                <div style={{
                  flexShrink: 0, background: rarity.color, borderRadius: 8,
                  padding: '4px 8px', textAlign: 'center',
                  animation: 'achBadgePop .4s .3s cubic-bezier(.34,1.56,.64,1) both',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#000', lineHeight: 1 }}>{achToast.gs}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(0,0,0,.6)', letterSpacing: '.5px' }}>G</div>
                </div>
              </div>
              {/* Rarity label */}
              <div style={{ paddingLeft: 14, paddingBottom: 9, fontSize: 10, fontWeight: 700, color: rarity.color, opacity: .75, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                {rarity.label}
              </div>
              {/* Countdown progress bar */}
              <div style={{ height: 3, background: `${rarity.color}22` }}>
                <div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${rarity.color}, ${rarity.color}aa)`,
                  animation: achLeaving ? 'none' : `achProgress ${ACH_SHOW_MS}ms linear forwards`,
                  transformOrigin: 'left',
                }} />
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Level-up Modal ── */}
      {levelUp && (
        <div onClick={() => setLevelUp(null)} style={{ position:'fixed', inset:0, zIndex:700, background:'rgba(0,0,0,.72)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn .2s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--sf)', borderRadius:'var(--r)', padding:'32px 28px', textAlign:'center', maxWidth:320, width:'90%', border:'1px solid var(--bd2)', boxShadow:'var(--s3s)', animation:'lvlUp .35s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ fontSize:54, marginBottom:6 }}>{levelUp.milestone?.icon ?? '⬆️'}</div>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--ac)', textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:4 }}>Level Up!</div>
            <div style={{ fontSize:56, fontWeight:900, lineHeight:1, marginBottom:6, background:'linear-gradient(135deg,var(--ac),#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{levelUp.level}</div>
            {levelUp.milestone && (
              <div style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>{levelUp.milestone.label}</div>
            )}
            {levelUp.milestone?.reward && (
              <div style={{ background:'linear-gradient(135deg,var(--al),rgba(168,85,247,.1))', border:'1px solid rgba(139,127,245,.35)', borderRadius:'var(--rs)', padding:'10px 14px', fontSize:13, fontWeight:600, color:'var(--ac)', marginBottom:16 }}>
                🎁 {levelUp.milestone.reward}
              </div>
            )}
            {!levelUp.milestone && levelUp.next && (
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:16 }}>
                Next milestone: <strong style={{ color:'var(--t2)' }}>{levelUp.next.icon} Lv.{levelUp.next.level} {levelUp.next.label}</strong>
              </div>
            )}
            <button className="btn btn-p btn-w" onClick={() => setLevelUp(null)}>Keep Going 🚀</button>
          </div>
        </div>
      )}
    </div>
  )
}
