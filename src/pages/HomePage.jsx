import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSets } from '../hooks/useSets'
import { useLang } from '../hooks/useLang'
import Layout from '../components/Layout'
import { getXPProgress, getSetLevel, MILESTONES, getNextMilestone, DAILY_GOAL, getLevelFromXP } from '../lib/xp'
import { supabase } from '../lib/supabase'

const COLORS = [['#edeafd','#5b4fe9'],['#dcfce7','#16a34a'],['#fef3c7','#d97706'],['#fee2e2','#dc2626'],['#dbeafe','#2563eb'],['#fce7f3','#be185d']]

function greetKey() {
  const h = new Date().getHours()
  return h < 12 ? 'good_morning' : h < 17 ? 'good_afternoon' : 'good_evening'
}

// ── Daily Goal Ring ────────────────────────────────────────────────────────────
function GoalRing({ count, goal, streak }) {
  const pct     = Math.min(1, count / goal)
  const radius  = 26
  const circ    = 2 * Math.PI * radius
  const done    = pct >= 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--s3)" strokeWidth="7" />
          <circle cx="32" cy="32" r={radius} fill="none"
            stroke={done ? 'var(--gn)' : 'var(--ac)'}
            strokeWidth="7"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: done ? 20 : 13, fontWeight: 900, color: done ? 'var(--gn)' : 'var(--ac)' }}>
          {done ? '✓' : `${count}`}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
        Daily goal<br/>{done ? '🎉 Done!' : `${count}/${goal}`}
      </div>
      {streak > 0 && (
        <div style={{ fontSize: 9, color: 'var(--am)', fontWeight: 700 }}>{streak}🔥</div>
      )}
    </div>
  )
}

// ── Activity Graph (GitHub-style contribution graph) ──────────────────────────
const ACTIVITY_LEVELS = [
  { min: 0,  max: 0,   bg: 'var(--s3)',              label: 'No activity' },
  { min: 1,  max: 4,   bg: 'rgba(74,222,128,.25)',   label: '1–4 cards' },
  { min: 5,  max: 9,   bg: 'rgba(74,222,128,.50)',   label: '5–9 cards' },
  { min: 10, max: 19,  bg: 'rgba(74,222,128,.75)',   label: '10–19 cards' },
  { min: 20, max: Infinity, bg: '#4ade80',           label: '20+ cards' },
]
function activityLevel(count) {
  return ACTIVITY_LEVELS.find(l => count >= l.min && count <= l.max) || ACTIVITY_LEVELS[0]
}

function ActivityGraph() {
  const [tooltip, setTooltip] = useState(null)

  const { activity, weeks, months, totalCards, activeDays } = useMemo(() => {
    const activity = JSON.parse(localStorage.getItem('memoai_activity') || '{}')
    const WEEKS = 20  // show ~5 months
    const totalDays = WEEKS * 7

    // Build grid: sunday-first, ending today
    const today = new Date(); today.setHours(0,0,0,0)
    const startOffset = today.getDay() // days past Sunday of current week
    // Pad so grid ends exactly on today's column
    const cells = []
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      cells.push({ key: d.toDateString(), date: d, count: activity[d.toDateString()] || 0 })
    }

    // Group into weeks (columns of 7)
    const weeks = []
    for (let w = 0; w < WEEKS; w++) {
      weeks.push(cells.slice(w * 7, w * 7 + 7))
    }

    // Month labels: find first cell of each month
    const months = []
    weeks.forEach((week, wi) => {
      week.forEach((cell, di) => {
        if (cell.date.getDate() === 1 || (wi === 0 && di === 0)) {
          const label = cell.date.toLocaleDateString('en', { month: 'short' })
          if (!months.length || months[months.length - 1].label !== label) {
            months.push({ label, col: wi })
          }
        }
      })
    })

    const totalCards = Object.values(activity).reduce((a, b) => a + b, 0)
    const activeDays = Object.values(activity).filter(v => v > 0).length

    return { activity, weeks, months, totalCards, activeDays }
  }, [])

  if (!Object.keys(JSON.parse(localStorage.getItem('memoai_activity') || '{}')).length) return null

  const CELL = 11  // px per cell
  const GAP  = 2   // px gap

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="sechd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>📊 Study Activity</span>
        <span style={{ fontSize:11, color:'var(--t3)', fontWeight:500 }}>{activeDays} active days · {totalCards} cards total</span>
      </div>

      <div style={{ overflowX:'auto', paddingBottom:4 }}>
        <div style={{ display:'inline-block', position:'relative' }}>
          {/* Month labels */}
          <div style={{ display:'flex', marginBottom:3, paddingLeft:18 }}>
            {weeks.map((_, wi) => {
              const mo = months.find(m => m.col === wi)
              return (
                <div key={wi} style={{ width: CELL + GAP, fontSize: 9, color:'var(--t3)', fontWeight:600, flexShrink:0 }}>
                  {mo ? mo.label : ''}
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', gap:0 }}>
            {/* Day labels */}
            <div style={{ display:'flex', flexDirection:'column', gap:GAP, marginRight:4, paddingTop:1 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ height:CELL, fontSize:8, color:'var(--t3)', fontWeight:600, display:'flex', alignItems:'center', lineHeight:1 }}>
                  {i % 2 === 1 ? d : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display:'flex', gap:GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display:'flex', flexDirection:'column', gap:GAP }}>
                  {week.map((cell, di) => {
                    const lv = activityLevel(cell.count)
                    const isFuture = cell.date > new Date()
                    return (
                      <div
                        key={di}
                        title={`${cell.date.toLocaleDateString('en', { month:'short', day:'numeric' })}: ${cell.count} cards`}
                        onMouseEnter={e => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setTooltip({ text: `${cell.date.toLocaleDateString('en',{month:'short',day:'numeric'})}: ${cell.count} card${cell.count!==1?'s':''}`, x: rect.left, y: rect.top })
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          width: CELL, height: CELL,
                          borderRadius: 2,
                          background: isFuture ? 'transparent' : lv.bg,
                          border: isFuture ? 'none' : cell.count === 0 ? '1px solid var(--bd)' : 'none',
                          cursor: cell.count > 0 ? 'default' : 'default',
                          transition: 'transform .1s',
                          flexShrink: 0,
                        }}
                        onMouseOver={e => { if (cell.count > 0) e.currentTarget.style.transform = 'scale(1.3)' }}
                        onMouseOut={e => { e.currentTarget.style.transform = '' }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, paddingLeft:18 }}>
            <span style={{ fontSize:9, color:'var(--t3)' }}>Less</span>
            {ACTIVITY_LEVELS.map((l, i) => (
              <div key={i} style={{ width:10, height:10, borderRadius:2, background:l.bg, border:i===0?'1px solid var(--bd)':'none' }} />
            ))}
            <span style={{ fontSize:9, color:'var(--t3)' }}>More</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{ position:'fixed', left:tooltip.x, top:tooltip.y - 28, background:'var(--s3)', border:'1px solid var(--bd2)', borderRadius:6, padding:'3px 8px', fontSize:11, color:'var(--tx)', fontWeight:600, pointerEvents:'none', zIndex:9999, whiteSpace:'nowrap', transform:'translateX(-50%)' }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

// ── Leaderboard widget ─────────────────────────────────────────────────────────
function LeaderboardWidget({ currentUserId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_weekly_leaderboard')
      .then(({ data }) => { setRows(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!rows.length) return null

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="sechd">🏅 Weekly XP Leaderboard</div>
      {rows.map((r, i) => {
        const isMe = false // We don't have user id in leaderboard data easily
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: i === 0 ? 'var(--al)' : 'var(--sf)', border: `1px solid ${i === 0 ? 'var(--ac)' : 'var(--bd)'}`, borderRadius: 'var(--rs)', marginBottom: 6 }}>
            <span style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{medal}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,var(--ac),#a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {r.avatar_char}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.display_name}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>Lv.{getLevelFromXP(r.total_xp)}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ac)' }}>⚡ {r.xp_this_week}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function HomePage() {
  const { user, profile, isPro, uploadsThisWeek, FREE_UPLOAD_LIMIT, totalXP } = useAuth()
  const { sets, loading, deleteSet } = useSets()
  const { t } = useLang()
  const nav = useNavigate()

  const name = profile?.full_name || user?.user_metadata?.full_name || ''
  const firstName = name.split(' ')[0] || ''
  const totalCards = sets.reduce((a, s) => a + (s.flashcards?.length || 0), 0)
  const uploadsLeft = Math.max(0, FREE_UPLOAD_LIMIT - uploadsThisWeek)

  // Streak
  const streak = parseInt(localStorage.getItem('memoai_streak') || '0')
  const lastStudy = localStorage.getItem('memoai_last_study') || ''
  const today = new Date().toDateString()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const isStreakActive = lastStudy === today || lastStudy === yesterday.toDateString()
  const displayStreak = isStreakActive ? streak : 0

  // Daily goal
  const goalDate   = localStorage.getItem('memoai_goal_date') || ''
  const goalCount  = goalDate === today ? parseInt(localStorage.getItem('memoai_goal_count') || '0') : 0
  const goalStreak = parseInt(localStorage.getItem('memoai_goal_streak') || '0')

  // ── Daily Smart Review ────────────────────────────────────────────────────
  const dailyReview = useMemo(() => {
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    // Collect all cards with set info, filter to due/struggling
    const candidates = sets.flatMap(s =>
      (s.flashcards || []).map(c => ({ ...c, setId: s.id, setTitle: s.title }))
    ).filter(c =>
      (c.nextReview && new Date(c.nextReview) <= now) ||   // due today or overdue
      (!c.nextReview && (c.repetitions || 0) > 0) ||       // reviewed before but no nextReview
      ((c.memoryScore || 0) < 30 && (c.repetitions || 0) > 0) // struggling
    ).sort((a, b) => {
      // Sort: most overdue first, then by lowest memoryScore
      const aDate = a.nextReview ? new Date(a.nextReview) : new Date(0)
      const bDate = b.nextReview ? new Date(b.nextReview) : new Date(0)
      if (aDate - bDate !== 0) return aDate - bDate
      return (a.memoryScore || 0) - (b.memoryScore || 0)
    }).slice(0, 10)

    if (!candidates.length) return null
    // Pick the set with the most due cards
    const setCounts = {}
    candidates.forEach(c => { setCounts[c.setId] = (setCounts[c.setId] || 0) + 1 })
    const bestSetId = Object.entries(setCounts).sort((a, b) => b[1] - a[1])[0][0]
    return { cards: candidates, bestSetId, count: candidates.length }
  }, [sets])

  // ── Review Forecast (7 days, pure client-side) ─────────────────────────────
  const forecast = useMemo(() => {
    const allCards = sets.flatMap(s => s.flashcards || [])
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + i)
      const next = new Date(day); next.setDate(next.getDate() + 1)
      const count = allCards.filter(c => {
        if (!c.nextReview) return false
        const r = new Date(c.nextReview)
        return r >= day && r < next
      }).length
      const label = i === 0 ? 'Today' : i === 1 ? 'Tmrw'
        : day.toLocaleDateString('en', { weekday: 'short' })
      return { label, count, isToday: i === 0 }
    })
  }, [sets])

  return (
    <Layout active="home">
      <div className="page screen">
        {/* Greeting */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.4px' }}>{t(greetKey())}{firstName ? `, ${firstName}` : ''} 👋</h1>
          <p style={{ color: 'var(--t2)', fontSize: 14, marginTop: 3 }}>
            {sets.length} {sets.length === 1 ? t('study_set') : t('study_sets')} {t('study_sets_ready')}
          </p>
        </div>

        {/* Upload limit banner */}
        {!isPro && (
          <div style={{ background: uploadsLeft === 0 ? 'var(--rl)' : 'var(--aml)', border: `1px solid ${uploadsLeft === 0 ? 'var(--rd)' : 'var(--am)'}`, borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: uploadsLeft === 0 ? 'var(--rd)' : 'var(--am)' }}>
                {uploadsLeft === 0 ? `⚠️ ${t('upload_limit_reached')}` : `📤 ${uploadsLeft} ${t('uploads_left')}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                {uploadsLeft === 0 ? t('upgrade_unlimited') : t('free_plan_limit')}
              </div>
            </div>
            <button className="btn btn-pro btn-sm" onClick={() => nav('/settings')}>{t('upgrade')}</button>
          </div>
        )}

        {/* Stats + Daily Goal Ring */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, margin: '0 0 18px', alignItems: 'stretch' }}>
          {[
            { v: sets.length,   l: sets.length === 1 ? t('study_set') : t('study_sets'), icon: '📚' },
            { v: totalCards,    l: t('cards'),    icon: '🃏' },
            { v: isPro ? '∞' : `${uploadsThisWeek}/${FREE_UPLOAD_LIMIT}`, l: t('uploads'), icon: '📤' },
          ].map(({ v, l }) => (
            <div key={l} className="card" style={{ padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ac)', letterSpacing: -1 }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 3, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
          {/* Daily Goal Ring — replaces streak in the grid */}
          <div className="card" style={{ padding: '10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GoalRing count={goalCount} goal={DAILY_GOAL} streak={goalStreak} />
          </div>
        </div>

        {/* Streak + XP Level Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {/* Streak pill */}
          <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>🔥</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: displayStreak > 0 ? 'var(--am)' : 'var(--t3)', lineHeight: 1 }}>{displayStreak}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600 }}>day streak</div>
            </div>
          </div>

          {/* XP Level Bar */}
          {(() => {
            const { level, progress, required, pct } = getXPProgress(totalXP)
            const next = getNextMilestone(level)
            const cur  = MILESTONES.find(m => m.level === level)
            return (
              <div className="card" style={{ padding: '10px 14px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ background: 'linear-gradient(135deg,var(--ac),#a855f7)', borderRadius: 7, padding: '3px 9px', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                    Lv.{level}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 7, borderRadius: 5, background: 'var(--s3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--ac),#a855f7)', borderRadius: 5, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, flexShrink: 0 }}>
                    {progress}/{required}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                  {cur ? `${cur.icon} ${cur.label} · ` : ''}
                  {next ? `Next: ${next.icon} Lv.${next.level}` : '🏆 Max!'}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Activity Graph */}
        <ActivityGraph />

        {/* ── Today's Focus (Daily Smart Review) ── */}
        {dailyReview && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 18, background: 'linear-gradient(135deg,var(--al),rgba(168,85,247,.07))', border: '1px solid var(--ac)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ac)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                  🎯 Today's Focus
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', marginBottom: 2 }}>
                  {dailyReview.count} card{dailyReview.count !== 1 ? 's' : ''} waiting for review
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                  AI-selected: most overdue + lowest memory scores
                </div>
              </div>
              <button className="btn btn-p" style={{ flexShrink: 0 }}
                onClick={() => nav(`/study/${dailyReview.bestSetId}?mode=learn`)}>
                Start →
              </button>
            </div>
            {/* Top 3 preview */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dailyReview.cards.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <div style={{ width: 28, height: 18, borderRadius: 4, background: (c.memoryScore || 0) < 30 ? 'var(--rl)' : 'var(--aml)', color: (c.memoryScore || 0) < 30 ? 'var(--rd)' : 'var(--am)', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {c.memoryScore || 0}%
                  </div>
                  <span style={{ color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.q}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Review Forecast Calendar ── */}
        {sets.length > 0 && forecast.some(d => d.count > 0) && (
          <div style={{ marginBottom: 18 }}>
            <div className="sechd">📅 Review Forecast</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {forecast.map((d, i) => {
                const maxCount = Math.max(...forecast.map(x => x.count), 1)
                const intensity = d.count / maxCount
                const hasCards = d.count > 0
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? 'var(--ac)' : 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                      {d.label}
                    </div>
                    <div style={{
                      height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                      background: hasCards ? 'var(--al)' : 'var(--s2)',
                    opacity: hasCards ? 0.4 + intensity * 0.6 : 1,
                      border: `1.5px solid ${d.isToday ? 'var(--ac)' : hasCards ? 'rgba(99,102,241,.3)' : 'var(--bd)'}`,
                    }}>
                      <span style={{ fontSize: hasCards ? 13 : 11, fontWeight: 900, color: hasCards ? 'var(--ac)' : 'var(--t3)', lineHeight: 1 }}>
                        {hasCards ? d.count : '·'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Weak Areas */}
        {(() => {
          const weakCards = sets
            .flatMap(s => (s.flashcards || []).map(c => ({ ...c, setTitle: s.title, setId: s.id })))
            .filter(c => (c.memoryScore || 0) < 40 && c.repetitions > 0)
            .sort((a, b) => (a.memoryScore || 0) - (b.memoryScore || 0))
            .slice(0, 3)
          if (!weakCards.length) return null
          return (
            <div style={{ marginBottom: 18 }}>
              <div className="sechd">⚠️ Needs Review</div>
              {weakCards.map((c, i) => (
                <div key={i} className="card card-tap" style={{ padding: '11px 14px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid var(--rd)' }}
                  onClick={() => nav(`/study/${c.setId}?mode=learn`)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.q}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{c.setTitle}</div>
                  </div>
                  <div style={{ background: 'var(--rl)', borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'var(--rd)', flexShrink: 0 }}>
                    {c.memoryScore || 0}%
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
          <div onClick={() => nav('/upload')} style={{ background: 'var(--ac)', borderRadius: 'var(--r)', padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--s1)', transition: 'all .18s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--s2s)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--s1)' }}>
            <span style={{ fontSize: 26 }}>⚡</span>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t('new_set')}</div><div style={{ fontSize: 12, opacity: .72, color: '#fff' }}>{t('upload_material')}</div></div>
          </div>
          <div onClick={() => sets.length && nav(`/study/${sets[0].id}`)} className={`card${sets.length ? ' card-tap' : ''}`} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, opacity: sets.length ? 1 : .5 }}>
            <span style={{ fontSize: 26 }}>▶️</span>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{t('continue_studying')}</div><div style={{ fontSize: 12, color: 'var(--t2)' }}>{t('resume_last')}</div></div>
          </div>
        </div>

        {/* Weekly Leaderboard */}
        <LeaderboardWidget currentUserId={user?.id} />

        {/* Sets list */}
        <div className="sechd">{t('your_study_sets')} <a onClick={() => nav('/upload')}>+ {t('new_set')}</a></div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>Loading…</div>
        ) : sets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
            <p style={{ fontSize: 14 }}>{t('no_sets_yet')}<br />{t('upload_to_start')}</p>
            <button className="btn btn-p" style={{ marginTop: 16 }} onClick={() => nav('/upload')}>{t('create_first_set')}</button>
          </div>
        ) : sets.map(s => {
          const ci = s.id ? (s.id.charCodeAt(0) + s.id.charCodeAt(1)) % COLORS.length : 0
          const [bg, fg] = COLORS[ci]
          const sCards = s.flashcards || []
          const sTotal = sCards.length
          const sMastered = sCards.filter(c => (c.memoryScore || 0) >= 70).length
          const sLearning = sCards.filter(c => (c.repetitions || 0) > 0 && (c.memoryScore || 0) < 70).length
          const masteredPct = sTotal ? (sMastered / sTotal) * 100 : 0
          const learningPct = sTotal ? (sLearning / sTotal) * 100 : 0
          return (
            <div key={s.id} className="card card-tap" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}
              onClick={() => nav(`/study/${s.id}`)}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {s.icon || '📚'}
              </div>
              {(() => {
                const lvl = getSetLevel(s.progress || 0)
                return (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{s.title}</div>
                      <span style={{ flexShrink: 0, background: lvl.bg, color: lvl.color, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>
                        {lvl.icon} {lvl.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{sTotal} {t('cards')} · {s.quiz?.length || 0} quiz</div>
                  </div>
                )
              })()}
              <div style={{ width: 64, flexShrink: 0 }}>
                <div style={{ height: 5, borderRadius: 4, background: 'var(--s3)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${masteredPct}%`, background: 'var(--gn)', animation: 'barGrow .8s ease' }} />
                  <div style={{ width: `${learningPct}%`, background: 'var(--am)', animation: 'barGrow .8s ease .1s both' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'right', marginTop: 3 }}>{sMastered}/{sTotal}</div>
              </div>
              <button className="btn btn-g btn-sm" style={{ flexShrink: 0, fontSize: 15 }}
                onClick={e => { e.stopPropagation(); if (window.confirm(t('delete_confirm'))) deleteSet(s.id) }}>
                🗑
              </button>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
