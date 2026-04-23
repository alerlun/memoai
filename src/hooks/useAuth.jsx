import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const FREE_UPLOAD_LIMIT = 3

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const refreshProfile = useCallback(() => {
    if (user) return fetchProfile(user.id)
  }, [user, fetchProfile])

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  // Reset upload count if month has changed
  async function checkMonthReset() {
    if (!profile || !user) return
    const resetAt = new Date(profile.week_reset_at || 0)
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    firstOfMonth.setHours(0, 0, 0, 0)
    if (resetAt < firstOfMonth) {
      await supabase.from('profiles').update({
        uploads_this_week: 0,
        week_reset_at: now.toISOString(),
      }).eq('id', user.id)
      await refreshProfile()
    }
  }

  useEffect(() => {
    if (profile) checkMonthReset()
  }, [profile?.id])

  // ── XP / Levels ─────────────────────────────────────────────────────────────
  const xpRef      = useRef(profile?.total_xp ?? 0)
  const xpTimerRef = useRef(null)

  useEffect(() => {
    if (profile?.total_xp != null) xpRef.current = profile.total_xp
  }, [profile?.total_xp])

  const addXP = useCallback((amount) => {
    if (!user || amount <= 0) return
    xpRef.current += amount
    const newXP = xpRef.current
    setProfile(p => p ? { ...p, total_xp: newXP, xp_this_week: (p.xp_this_week ?? 0) + amount } : p)
    clearTimeout(xpTimerRef.current)
    xpTimerRef.current = setTimeout(() => {
      supabase.from('profiles')
        .update({ total_xp: xpRef.current })
        .eq('id', user.id)
    }, 800)
  }, [user])

  // ── Achievements ─────────────────────────────────────────────────────────────
  // localStorage key is user-scoped so different accounts on same device don't share
  const achKey = user ? `memoai_achievements_${user.id}` : null

  // On profile load, merge Supabase achievements with localStorage
  useEffect(() => {
    if (!achKey) return
    const local  = JSON.parse(localStorage.getItem(achKey) || '[]')
    const remote = profile?.achievements ?? []
    if (!local.length && !remote.length) return
    const merged = [...new Set([...local, ...remote])]
    // Sync back if they differ
    if (merged.length !== local.length) localStorage.setItem(achKey, JSON.stringify(merged))
    if (merged.length !== remote.length) {
      setProfile(p => p ? { ...p, achievements: merged } : p)
    }
  }, [profile?.id, achKey])

  const unlockAchievements = useCallback(async (ids) => {
    if (!user || !ids.length || !achKey) return

    // 1. Read current from localStorage (always available)
    const local   = JSON.parse(localStorage.getItem(achKey) || '[]')
    const merged  = [...new Set([...local, ...ids])]

    // 2. Persist to localStorage immediately so reload never loses them
    localStorage.setItem(achKey, JSON.stringify(merged))

    // 3. Update local React state
    setProfile(p => p ? { ...p, achievements: merged } : p)

    // 4. Best-effort Supabase sync (requires achievements column to exist)
    try {
      const { data: cur, error } = await supabase
        .from('profiles').select('achievements').eq('id', user.id).single()
      if (!error) {
        const dbMerged = [...new Set([...(cur?.achievements ?? []), ...ids])]
        await supabase.from('profiles').update({ achievements: dbMerged }).eq('id', user.id)
      }
    } catch {
      // Column may not exist yet — localStorage copy is enough
    }
  }, [user, achKey])

  // ── Stats counters ───────────────────────────────────────────────────────────
  const statsTimerRef  = useRef(null)
  const statsDeltaRef  = useRef({})

  const updateProfileStats = useCallback((delta) => {
    if (!user) return
    // Merge delta into pending batch
    Object.entries(delta).forEach(([k, v]) => {
      statsDeltaRef.current[k] = (statsDeltaRef.current[k] ?? 0) + v
    })
    // Optimistic local update
    setProfile(p => {
      if (!p) return p
      const updated = { ...p }
      Object.entries(delta).forEach(([k, v]) => { updated[k] = (updated[k] ?? 0) + v })
      return updated
    })
    // Debounced DB write
    clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(async () => {
      const batch = { ...statsDeltaRef.current }
      statsDeltaRef.current = {}
      if (!Object.keys(batch).length) return
      // We need to fetch current values and add the delta
      const { data: cur } = await supabase.from('profiles').select(Object.keys(batch).join(',')).eq('id', user.id).single()
      if (!cur) return
      const update = {}
      Object.entries(batch).forEach(([k, v]) => { update[k] = (cur[k] ?? 0) + v })
      await supabase.from('profiles').update(update).eq('id', user.id)
    }, 1500)
  }, [user])

  const addCardsStudied = useCallback((count = 1) => {
    updateProfileStats({ total_cards_studied: count })
  }, [updateProfileStats])

  const recordQuizComplete = useCallback((perfect = false) => {
    const delta = { quizzes_completed: 1 }
    if (perfect) delta.perfect_quizzes = 1
    updateProfileStats(delta)
  }, [updateProfileStats])

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalXP           = profile?.total_xp ?? 0
  const xpThisWeek        = profile?.xp_this_week ?? 0
  // Always merge localStorage so achievements survive even before Supabase column exists
  const achievements      = achKey
    ? [...new Set([...JSON.parse(localStorage.getItem(achKey) || '[]'), ...(profile?.achievements ?? [])])]
    : (profile?.achievements ?? [])
  const totalCardsStudied = profile?.total_cards_studied ?? 0
  const perfectQuizzes    = profile?.perfect_quizzes ?? 0
  const quizzesCompleted  = profile?.quizzes_completed ?? 0

  const isPro           = profile?.is_pro === true
  const proExpiresAt    = profile?.pro_expires_at ?? null
  const uploadsThisWeek = profile?.uploads_this_week ?? 0
  const canUpload       = isPro || uploadsThisWeek < FREE_UPLOAD_LIMIT

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isPro, proExpiresAt,
      uploadsThisWeek, FREE_UPLOAD_LIMIT, canUpload,
      signUp, signIn, signOut, refreshProfile,
      totalXP, xpThisWeek, addXP,
      achievements, unlockAchievements,
      totalCardsStudied, perfectQuizzes, quizzesCompleted,
      addCardsStudied, recordQuizComplete,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
