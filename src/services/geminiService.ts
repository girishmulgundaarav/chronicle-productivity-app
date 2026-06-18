export interface DailyTaskLog {
  date: string;
  task_name: string;
  intended_hours: number;
  actual_hours: number;
  category: string;
  productivity_score: number;
  is_billable: boolean;
}

const getGeminiApiKey = (): string => {
  return (
    import.meta.env.VITE_GEMINI_API_KEY || 
    localStorage.getItem('VITE_GEMINI_API_KEY') || 
    ''
  );
};

export const isGeminiConfigured = (): boolean => {
  return !!getGeminiApiKey();
};

export const generateAISummary = async (
  startDate: string,
  endDate: string,
  tasks: DailyTaskLog[],
  tone: 'professional' | 'encouraging' | 'no-nonsense' | 'high-level'
): Promise<string> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please go to Settings to add your key.');
  }

  // Format daily task logs context
  const taskLogsContext = tasks
    .map(t => {
      const categoryText = t.category ? ` [${t.category}]` : '';
      const billableText = t.is_billable ? ' (Billable)' : '';
      return `- [${t.date}] "${t.task_name}": Planned: ${t.intended_hours}h | Completed: ${t.actual_hours}h${categoryText}${billableText} | Score: ${t.productivity_score}/5`;
    })
    .join('\n');

  const toneGuidelines: Record<typeof tone, string> = {
    professional: 
      'Write a formal, analytical performance summary suitable for an executive. ' +
      'Group achievements logically, outline time spent across categories, highlight productivity scores, and provide structured action items.',
    encouraging: 
      'Write in a warm, encouraging, and supportive coach voice. ' +
      'Focus on effort, celebrate consistency, list achievements, and offer mindful suggestions for self-improvement.',
    'no-nonsense': 
      'Write in a hyper-concise, direct, and brief coach voice. ' +
      'Get straight to the point, list accomplishments in bullet points, and specify immediate actions for next period. No fluff.',
    'high-level':
      'Write a high-level summary of achievements in exactly 4 to 5 bulleted professional sentences for a manager. ' +
      'Write objectively in the third person. Do NOT use pronouns like "you", "your", "I", "my", or "our". ' +
      'Do NOT use verbs like "contributed" or "advanced"—instead, state actions directly (e.g., "designed", "implemented", "resolved"). ' +
      'Do NOT include any metrics, time spent, hours, productivity scores, or categories in the summary. Focus purely on core qualitative accomplishments.'
  };

  const prompt = `
You are an expert executive coach. Analyze the user's task logs between ${startDate} and ${endDate} and synthesize them.

### Task Logs (${startDate} to ${endDate}):
${taskLogsContext}

### Persona Guideline:
${toneGuidelines[tone]}

### Instructions:
${tone === 'high-level' ? 'Generate exactly 4 to 5 bullet points (each containing one professional sentence) summarizing the accomplishments. Do not use words like "contributed" or "advanced". Omit all time metrics, hours, and scores. Do not output any headings, subheadings, introductory text, or other text sections.' : `
- Group tasks logically (e.g. development, operations, alignment).
- Assess overall achievements in this period.
- Deliver the response in clean, formatted Markdown.
- Provide 3 concrete recommendations for next week / next period.
`}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMessage = errorJson?.error?.message || `HTTP error ${response.status}`;
      throw new Error(`Gemini API Error: ${errorMessage}`);
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Received empty response from Gemini API.');
    }

    return generatedText;
  } catch (error: any) {
    console.error('Gemini API request failed:', error);
    throw error;
  }
};
