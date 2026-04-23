import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { ACHIEVEMENTS, RARITY } from '../lib/achievements'
import { getLevelFromXP } from '../lib/xp'

const CATEGORIES = [
  { key: 'streak',  label: '🔥 Streak',         ids: ['streak_3','streak_7','streak_30','streak_100'] },
  { key: 'goal',    label: '🎯 Daily Goal',       ids: ['goal_first','goal_7'] },
  { key: 'quiz',    label: '🎮 Quiz',             ids: ['quiz_first','quiz_10','quiz_50','perfect','perfect_3','perfect_10','iron_heart','speed','speed_60'] },
  { key: 'mastery', label: '🧠 Mastery',          ids: ['master_1','master_10','master_50','master_100','master_500','set_master','set_master3'] },
  { key: 'studied', label: '📖 Cards Studied',   ids: ['studied_10','studied_100','studied_500','studied_1000','studied_5000'] },
  { key: 'sets',    label: '📚 Study Sets',       ids: ['set_1','set_5','set_10'] },
  { key: 'levels',  label: '⬆️ Levels',           ids: ['level_5','level_10','level_25','level_50','level_100', 'gotta_catch_em_all'] },
  { key: 'time',    label: '⏰ Time-based',        ids: ['early_bird','night_owl'] },
]

function AchievementCard({ ach, unlocked }) {
  const rarity = RARITY[ach.rarity]
  return (
    <div style={{
      background: unlocked ? rarity.bg : 'var(--s2)',
      border: `1.5px solid ${unlocked ? rarity.color : 'var(--bd)'}`,
      borderRadius: 12,
      padding: '14px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 6,
      opacity: unlocked ? 1 : 0.45,
      transition: 'all .2s',
      position: 'relative',
    }}>
      {unlocked && (
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 800, color: rarity.color, background: 'rgba(0,0,0,.12)', borderRadius: 6, padding: '2px 5px', letterSpacing: '.5px' }}>
          {ach.gs}G
        </div>
      )}
      <div style={{ fontSize: 28, filter: unlocked ? 'none' : 'grayscale(1)' }}>{ach.icon}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: unlocked ? rarity.color : 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {rarity.label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: unlocked ? 'var(--tx)' : 'var(--t3)', lineHeight: 1.3 }}>{ach.title}</div>
      <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.4 }}>{ach.desc}</div>
    </div>
  )
}

export default function AchievementsPage() {
  const { achievements, totalXP, totalCardsStudied, quizzesCompleted, perfectQuizzes } = useAuth()
  const unlockedSet = new Set(achievements || [])
  const unlockedCount = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).length
  const totalGS = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).reduce((s, a) => s + a.gs, 0)
  const maxGS   = ACHIEVEMENTS.reduce((s, a) => s + a.gs, 0)
  const level   = getLevelFromXP(totalXP)

  return (
    <Layout active="achievements">
      <div className="page screen">
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', marginBottom: 4 }}>🏆 Achievements</h1>
          <p style={{ color: 'var(--t2)', fontSize: 13 }}>
            {unlockedCount} / {ACHIEVEMENTS.length} unlocked
          </p>
        </div>

        {/* Summary card */}
        <div className="card" style={{ padding: '16px 18px', marginBottom: 22, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ac)' }}>{unlockedCount}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>UNLOCKED</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--bd)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fbbf24' }}>{totalGS}G</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>GAMERSCORE</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--bd)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t2)' }}>Lv.{level}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>LEVEL</div>
          </div>
        </div>

        {/* Gamerscore bar */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginBottom: 5 }}>
            <span>Gamerscore progress</span>
            <span>{totalGS} / {maxGS}G</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: 'var(--s3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(totalGS / maxGS * 100)}%`, background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius: 6, transition: 'width .5s ease' }} />
          </div>
        </div>

        {/* By rarity quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 22 }}>
          {Object.entries(RARITY).map(([key, r]) => {
            const total    = ACHIEVEMENTS.filter(a => a.rarity === key).length
            const got      = ACHIEVEMENTS.filter(a => a.rarity === key && unlockedSet.has(a.id)).length
            return (
              <div key={key} style={{ background: r.bg, border: `1px solid ${r.color}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: r.color }}>{got}/{total}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '.4px' }}>{r.label}</div>
              </div>
            )
          })}
        </div>

        {/* Category sections */}
        {CATEGORIES.map(cat => {
          const catAchs = cat.ids.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
          const catUnlocked = catAchs.filter(a => unlockedSet.has(a.id)).length
          return (
            <div key={cat.key} style={{ marginBottom: 24 }}>
              <div className="sechd" style={{ marginBottom: 10 }}>
                {cat.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>
                  {catUnlocked}/{catAchs.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {catAchs.map(ach => (
                  <AchievementCard key={ach.id} ach={ach} unlocked={unlockedSet.has(ach.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
