// ── Rarity tiers ─────────────────────────────────────────────────────────────
export const RARITY = {
  common:    { label: 'Common',    color: '#9ca3af', bg: 'rgba(156,163,175,.15)' },
  rare:      { label: 'Rare',      color: '#60a5fa', bg: 'rgba(96,165,250,.15)'  },
  epic:      { label: 'Epic',      color: '#a78bfa', bg: 'rgba(167,139,250,.15)' },
  legendary: { label: 'Legendary', color: '#fbbf24', bg: 'rgba(251,191,36,.15)'  },
  exotic: { label: 'Exotic', color: '#24fbcc', bg: 'rgba(36, 251, 161, 0.15)'  },
}

// ── All achievements ──────────────────────────────────────────────────────────
// check(stats) → boolean. stats shape at bottom of file.
export const ACHIEVEMENTS = [
  // ── Streak ────────────────────────────────────────────────────────────────
  { id: 'streak_3',   icon: '🔥', title: 'Dedicated',       desc: '3-day study streak',              rarity: 'common',    gs: 10,  check: s => s.streak >= 3   },
  { id: 'streak_7',   icon: '🔥', title: '7-Day Warrior',   desc: '7-day study streak',              rarity: 'rare',      gs: 20,  check: s => s.streak >= 7   },
  { id: 'streak_30',  icon: '💀', title: 'Unstoppable',     desc: '30-day study streak',             rarity: 'epic',      gs: 40,  check: s => s.streak >= 30  },
  { id: 'streak_100', icon: '👑', title: 'Immortal',        desc: '100-day study streak',            rarity: 'legendary', gs: 100, check: s => s.streak >= 100 },

  // ── Daily goal ────────────────────────────────────────────────────────────
  { id: 'goal_first', icon: '🎯', title: 'Goal Getter',     desc: 'Complete your first daily goal',  rarity: 'common',    gs: 5,   check: s => s.goalCompleted  },
  { id: 'goal_7',     icon: '🎯', title: 'Consistent',      desc: 'Hit daily goal 7 days running',   rarity: 'epic',      gs: 35,  check: s => s.goalStreak >= 7 },

  // ── Quiz ──────────────────────────────────────────────────────────────────
  { id: 'quiz_first', icon: '🎮', title: 'First Win',       desc: 'Complete your first quiz',        rarity: 'common',    gs: 5,   check: s => s.quizzesCompleted >= 1  },
  { id: 'quiz_10',    icon: '🎮', title: 'Quiz Addict',     desc: 'Complete 10 quizzes',             rarity: 'rare',      gs: 15,  check: s => s.quizzesCompleted >= 10 },
  { id: 'quiz_50',    icon: '🎮', title: 'Quiz Master',     desc: 'Complete 50 quizzes',             rarity: 'epic',      gs: 30,  check: s => s.quizzesCompleted >= 50 },
  { id: 'perfect',    icon: '💯', title: 'Flawless',        desc: 'Score 100% on a quiz',            rarity: 'rare',      gs: 20,  check: s => s.perfectQuizzes >= 1   },
  { id: 'perfect_3',  icon: '💎', title: 'Perfectionist',   desc: '3 perfect quizzes',               rarity: 'epic',      gs: 40,  check: s => s.perfectQuizzes >= 3   },
  { id: 'perfect_10', icon: '💎', title: 'Undefeated',      desc: '10 perfect quizzes',              rarity: 'legendary', gs: 75,  check: s => s.perfectQuizzes >= 10  },
  { id: 'iron_heart', icon: '❤️', title: 'Iron Heart',      desc: 'Perfect quiz — no hearts lost',   rarity: 'epic',      gs: 30,  check: s => s.ironHeart             },
  { id: 'speed',      icon: '⚡', title: 'Speed Demon',     desc: 'Finish quiz in under 90 seconds', rarity: 'rare',      gs: 25,  check: s => s.speedDemon            },
  { id: 'speed_60',   icon: '⚡', title: 'Lightning',       desc: 'Finish quiz in under 60 seconds', rarity: 'legendary', gs: 50,  check: s => s.ultraSpeed            },

  // ── Mastery ───────────────────────────────────────────────────────────────
  { id: 'master_1',   icon: '🧠', title: 'First Mastery',   desc: 'Master your first card',          rarity: 'common',    gs: 5,   check: s => s.masteredCards >= 1   },
  { id: 'master_10',  icon: '🧠', title: 'Sharp Mind',      desc: 'Master 10 cards',                 rarity: 'common',    gs: 10,  check: s => s.masteredCards >= 10  },
  { id: 'master_50',  icon: '🧠', title: 'Mastermind',      desc: 'Master 50 cards',                 rarity: 'rare',      gs: 25,  check: s => s.masteredCards >= 50  },
  { id: 'master_100', icon: '🧠', title: 'Genius',          desc: 'Master 100 cards',                rarity: 'epic',      gs: 40,  check: s => s.masteredCards >= 100 },
  { id: 'master_500', icon: '🧠', title: 'Omniscient',      desc: 'Master 500 cards',                rarity: 'legendary', gs: 100, check: s => s.masteredCards >= 500 },
  { id: 'set_master', icon: '🏆', title: 'Set Conqueror',   desc: 'Master an entire study set',      rarity: 'rare',      gs: 20,  check: s => s.masteredSets >= 1    },
  { id: 'set_master3',icon: '🏆', title: 'Set Dominator',   desc: 'Master 3 entire study sets',      rarity: 'epic',      gs: 40,  check: s => s.masteredSets >= 3    },

  // ── Cards studied (lifetime) ──────────────────────────────────────────────
  { id: 'studied_10',   icon: '📖', title: 'Getting Started', desc: 'Study 10 cards',               rarity: 'common',    gs: 5,   check: s => s.totalCardsStudied >= 10   },
  { id: 'studied_100',  icon: '📖', title: 'Diligent',        desc: 'Study 100 cards',              rarity: 'rare',      gs: 10,  check: s => s.totalCardsStudied >= 100  },
  { id: 'studied_500',  icon: '📖', title: 'Scholar',         desc: 'Study 500 cards',              rarity: 'epic',      gs: 25,  check: s => s.totalCardsStudied >= 500  },
  { id: 'studied_1000', icon: '📖', title: 'Devoted',         desc: 'Study 1,000 cards',            rarity: 'legendary', gs: 50,  check: s => s.totalCardsStudied >= 1000 },
  { id: 'studied_5000', icon: '📖', title: 'Eternal Student', desc: 'Study 5,000 cards',            rarity: 'legendary', gs: 100, check: s => s.totalCardsStudied >= 5000 },

  // ── Study sets created ────────────────────────────────────────────────────
  { id: 'set_1',  icon: '📚', title: 'Curious',       desc: 'Create your first study set',          rarity: 'common', gs: 5,  check: s => s.setsCount >= 1  },
  { id: 'set_5',  icon: '📚', title: 'Collector',     desc: 'Create 5 study sets',                  rarity: 'rare',   gs: 15, check: s => s.setsCount >= 5  },
  { id: 'set_10', icon: '📚', title: 'Librarian',     desc: 'Create 10 study sets',                 rarity: 'epic',   gs: 25, check: s => s.setsCount >= 10 },

  // ── Levels ────────────────────────────────────────────────────────────────
  { id: 'level_5',   icon: '⬆️', title: 'Rising Star',     desc: 'Reach Level 5',              rarity: 'common',    gs: 10,  check: s => s.level >= 5   },
  { id: 'level_10',  icon: '⬆️', title: 'On Fire',         desc: 'Reach Level 10',             rarity: 'rare',      gs: 20,  check: s => s.level >= 10  },
  { id: 'level_25',  icon: '💎', title: 'Knowledge Gem',   desc: 'Reach Level 25',             rarity: 'rare',      gs: 30,  check: s => s.level >= 25  },
  { id: 'level_50',  icon: '🦅', title: 'Scholar',         desc: 'Reach Level 50',             rarity: 'epic',      gs: 50,  check: s => s.level >= 50  },
  { id: 'level_100', icon: '🏆', title: 'Legend',          desc: 'Reach Level 100',            rarity: 'legendary', gs: 100, check: s => s.level >= 100 },
  { id: 'gotta_catch_em_all', icon: '👾', title: 'Gotta Catch Em All!', desc: 'Unlock All Achievements',          rarity: 'exotic', gs: 200, check: s => s.unlockedCount >= ACHIEVEMENTS.length - 1 },
  
  // ── Time-based ────────────────────────────────────────────────────────────
  { id: 'early_bird', icon: '🌅', title: 'Early Bird',   desc: 'Study before 8 AM',             rarity: 'common', gs: 10, check: s => s.earlyBird  },
  { id: 'night_owl',  icon: '🌙', title: 'Night Owl',    desc: 'Study after 11 PM',             rarity: 'common', gs: 10, check: s => s.nightOwl   },
]

/*
  stats shape expected by check():
  {
    streak:            number   // current day streak
    level:             number   // account level
    totalCardsStudied: number   // lifetime cards studied
    masteredCards:     number   // cards with memoryScore >= 70 across all sets
    setsCount:         number   // number of study sets
    masteredSets:      number   // sets where ALL cards are mastered
    perfectQuizzes:    number   // cumulative perfect quizzes
    quizzesCompleted:  number   // cumulative quizzes finished
    goalCompleted:     boolean  // daily goal done today
    goalStreak:        number   // consecutive days goal completed
    ironHeart:         boolean  // quiz finished perfect AND no hearts lost
    speedDemon:        boolean  // quiz finished in < 90 s
    ultraSpeed:        boolean  // quiz finished in < 60 s
    earlyBird:         boolean  // studied before 8 AM today
    nightOwl:          boolean  // studied after 23:00 today
  }
*/
