const MODEL = 'gpt-5.4-nano'

async function callOpenAI(prompt, maxTokens = 2500, systemPrompt = null) {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, max_completion_tokens: maxTokens, messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI ${res.status}: ${err?.error?.message || 'Unknown error'}`)
  }
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content || ''
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
}

export async function generateMagicNotes(text) {
  const ctx = text.length > 5000 ? text.slice(0, 5000) + '…' : text
  const prompt = `You are an expert study guide creator. Transform the content below into a structured study guide.
CRITICAL: Detect the language of the CONTENT and write your ENTIRE response in that exact same language. If Finnish, respond in Finnish. If Swedish, respond in Swedish. Never default to English.

CONTENT:
${ctx}

Return this exact JSON structure (no markdown):
{
  "title": "Short descriptive title",
  "summary": "2-3 sentence overview of what this content covers",
  "keyTerms": [{ "term": "Term", "definition": "One short sentence definition." }],
  "sections": [{ "heading": "Section heading", "points": ["Key point as one short sentence"] }],
  "quickFacts": ["Short memorable fact"]
}

Rules: 5-10 keyTerms, 3-5 sections with 3-6 points each, 3-5 quickFacts. Return ONLY valid JSON.`
  const raw = await callOpenAI(prompt, 2500)
  return JSON.parse(raw)
}

export async function generateFlashcards(text) {
  const ctx = text.length > 5000 ? text.slice(0, 5000) + '…' : text
  const prompt = `Create 10-14 flashcards from this content.
CRITICAL: Detect the language of the CONTENT and write ALL questions and answers in that exact same language. Never default to English.

CONTENT:
${ctx}

Rules:
1. Questions must be SPECIFIC — ask about a concept, fact, term, cause, or effect. Never ask "What does the text say about X?"
2. Good starters: "What is...", "How does...", "Why does...", "What causes...", "Who..."
3. Answers must be SHORT — maximum 8 words. Just the core fact, no full sentences.
   BAD: "Photosynthesis is the process by which plants convert sunlight into glucose using chlorophyll"
   GOOD: "Converting sunlight into glucose"
   BAD: "Climate change refers to long-term shifts in global temperatures"
   GOOD: "Rising temps from human greenhouse emissions"
4. Vary question types: definitions, causes, effects, comparisons, processes
5. Cover the full content breadth

Return ONLY a JSON array:
[{ "q": "Specific question?", "a": "Max 8 word answer." }]`
  const raw = await callOpenAI(prompt, 2500)
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Bad flashcard response')
  return parsed.map((f, i) => ({
    id: i, q: String(f.q).trim(), a: String(f.a).trim(),
    interval: 1, easeFactor: 2.5, repetitions: 0, nextReview: null, memoryScore: 0,
  }))
}

export async function generateQuiz(text, flashcards) {
  const ctx = text.length > 4000 ? text.slice(0, 4000) + '…' : text
  const fcList = flashcards.slice(0, 12).map((f, i) => `${i + 1}. Q: ${f.q}\n   A: ${f.a}`).join('\n')
  const prompt = `Generate 8 multiple-choice questions from this content.
CRITICAL: Detect the language of the CONTENT and write everything in that exact same language. Never default to English.

CONTENT: ${ctx}
KEY FACTS: ${fcList}

Rules:
- All 4 options must be the SAME CATEGORY as the correct answer (all people, all dates, all terms, etc.)
- Wrong answers must be genuinely plausible, never obviously wrong
- Write proper questions (Who/What/When/Which/Why/How). No fill-in-the-blank.
- Vary difficulty: 2 easy, 4 medium, 2 hard
- "correct" is a ZERO-BASED index: 0=first option, 1=second option, 2=third option, 3=fourth option

Return ONLY JSON array (example — "Paris" is correct so correct=0):
[{"q":"Capital of France?","options":["Paris","London","Berlin","Rome"],"correct":0,"explanation":"Paris has been France's capital since 987.","difficulty":"easy"}]`
  const raw = await callOpenAI(prompt, 2500)
  const parsed = JSON.parse(raw)
  return parsed.map(q => ({
    q: String(q.q).trim(),
    options: Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : ['A', 'B', 'C', 'D'],
    correct: Math.max(0, Math.min(3, Number(q.correct) || 0)),
    explanation: String(q.explanation || '').trim(),
    difficulty: q.difficulty || 'medium',
  }))
}

export async function generatePracticeTest(text) {
  const ctx = text.length > 4000 ? text.slice(0, 4000) + '…' : text
  const prompt = `Create a 10-question practice exam from this content.
CRITICAL: Detect the language of the CONTENT and write everything in that exact same language. Never default to English.

CONTENT: ${ctx}

Mix: 4 multiple choice, 3 true/false, 3 short answer.
- For multiple_choice: "correct" is a ZERO-BASED index (0=first option, 1=second, 2=third, 3=fourth)
- For true_false: "correct" is boolean true or false

Return ONLY JSON array (example — "Berlin" is correct so correct=2):
[
  {"type":"multiple_choice","q":"Capital of Germany?","options":["Paris","London","Berlin","Rome"],"correct":2,"explanation":"Berlin is Germany's capital."},
  {"type":"true_false","q":"The Earth orbits the Sun.","correct":true,"explanation":"Earth orbits the Sun, not vice versa."},
  {"type":"short_answer","q":"Question?","sampleAnswer":"Brief model answer.","keyPoints":["point1","point2"]}
]`
  const raw = await callOpenAI(prompt, 2500)
  return JSON.parse(raw)
}

export async function askTutor(userMessage, history, studyContent) {
  const ctx = studyContent?.length > 3000 ? studyContent.slice(0, 3000) + '…' : (studyContent || '')
  const systemPrompt = `You are Memo, an expert encouraging AI tutor. Use the Socratic method to help students discover answers.
CRITICAL: Always respond in the same language the student writes in.
The student is studying: ${ctx}
Be warm, patient, encouraging. Keep responses 2-4 sentences. Give hints before full answers.`
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ]
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, max_completion_tokens: 600, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
  })
  if (!res.ok) throw new Error(`Tutor API ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || 'Please try again.'
}

export async function explainCard(question, answer, studyContent) {
  const ctx = studyContent?.length > 2000 ? studyContent.slice(0, 2000) + '…' : (studyContent || '')
  const prompt = `A student got this flashcard wrong and needs an expert explanation.
CRITICAL: Detect the language of the question/answer and respond in that exact same language.

Question: ${question}
Correct Answer: ${answer}
${ctx ? `\nStudy content context:\n${ctx}` : ''}

Give a clear, friendly explanation in 3-4 sentences:
1. Explain WHY the answer is correct
2. Break down the concept they missed
3. End with a memorable tip or analogy

Return only the explanation text, no labels or formatting.`
  return callOpenAI(prompt, 400)
}

export async function generateMnemonic(question, answer) {
  const prompt = `A student keeps forgetting this flashcard. Create ONE short, vivid memory trick to make the answer stick forever.
CRITICAL: Detect the language of the question/answer and respond in that exact same language.

Question: ${question}
Answer: ${answer}

Use a mnemonic, acronym, analogy, rhyme, or mini-story — whichever is most memorable.
Be creative, concrete and slightly silly (that helps recall). Max 35 words.

Return only the memory trick text, nothing else.`
  return callOpenAI(prompt, 120)
}

export async function generateTitle(text) {
  const ctx = text.slice(0, 600)
  const prompt = `Generate a short study set title for this content (max 6 words, no quotes, no period).
CRITICAL: Detect the language of the content and write the title in that exact same language. Never default to English.
Focus on the subject — do NOT copy the document filename or header verbatim.

${ctx}

Return only the title.`
  try { return (await callOpenAI(prompt, 40)).replace(/["'`*]/g, '').trim().slice(0, 55) }
  catch { return text.split(' ').slice(0, 5).join(' ') || 'My Study Set' }
}

export function sm2(card, quality) {
  let { interval, easeFactor, repetitions } = card
  if (quality >= 3) {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = 6
    else interval = Math.round(interval * easeFactor)
    repetitions += 1
  } else { repetitions = 0; interval = 1 }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)
  const memoryScore = Math.min(100, Math.round((easeFactor - 1.3) / (3.0 - 1.3) * 60 + Math.min(repetitions, 5) / 5 * 40))
  return { interval, easeFactor, repetitions, nextReview: nextReview.toISOString(), memoryScore }
}

export function generatePlan(text) {
  const sentences = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?])\s+/).filter(s => s.length > 30)
  const chunks = []
  const sz = Math.max(1, Math.ceil(sentences.length / 5))
  for (let i = 0; i < sentences.length; i += sz) {
    const ch = sentences.slice(i, i + sz)
    const lbl = ch[0].split(' ').slice(0, 5).join(' ').replace(/[^a-zA-Z0-9\s\u00C0-\u024F]/g, '').trim()
    chunks.push({ name: lbl || `Section ${chunks.length + 1}`, sub: `${ch.length} key concept${ch.length !== 1 ? 's' : ''}`, dur: `${15 + chunks.length * 5} min`, st: chunks.length === 0 ? 'cur' : 'up' })
  }
  if (!chunks.length) chunks.push({ name: 'Overview', sub: 'Introduction', dur: '15 min', st: 'cur' })
  return chunks
}
