import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS method for CORS pre-flight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { logs, leaves, tone } = req.body;

  const logsList = Array.isArray(logs) ? logs : [];
  const leavesList = Array.isArray(leaves) ? leaves : [];

  if (logsList.length === 0 && leavesList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid weekly logs or leaves context.' });
  }

  if (!apiKey) {
    console.error('Environment Error: GEMINI_API_KEY is not defined.');
    return res.status(500).json({ error: 'Server-side API key configuration is missing.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Instantiate gemini-2.5-flash with executive coach instructions
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 
        'You are an expert executive coach. Your role is to analyze a user\'s weekly schedule tasks logs ' +
        'and synthesize them into a highly structured weekly report. Group achievements logically (e.g. development, operations, communications), ' +
        'filter out noise, highlight areas where high productivity score rating was achieved, and write a concise coaching output in markdown.'
    });

    const tonePrompts = {
      'Professional Manager': 
        'Format the summary as a formal performance report suitable for review by a direct manager. ' +
        'Focus on deliverables, business value, actual time invested across items, and key outcomes.',
      'Portfolio Impact': 
        'Focus heavily on high-value contributions, engineering deliverables, and project-building milestones. ' +
        'Frame achievements as concrete resume entries.',
      'Personal Reflection': 
        'Tailor this as a mindful coach guiding a developer. Focus on energy allocations, focus rating distributions, ' +
        'and actionable insights for self-care and workspace optimization.',
      'High-Level Summary':
        'Write a high-level summary of achievements in exactly 4 to 5 bulleted professional sentences for a manager. ' +
        'Write objectively in the third person. Do NOT use pronouns like "you", "your", "I", "my", or "our". ' +
        'Do NOT use verbs like "contributed" or "advanced"—instead, state actions directly (e.g., "designed", "implemented", "resolved"). ' +
        'Do NOT include any metrics, time spent, hours, productivity scores, or categories in the summary. Focus purely on core qualitative accomplishments.'
    };

    const selectedTonePrompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts['Professional Manager'];

    // Format logs context into bullet items
    const contextText = logsList
      .map(t => `- [${t.date}] "${t.task_name}": Planned: ${t.intended_hours}h | Completed: ${t.actual_hours}h | Category: ${t.category || 'None'} | Score: ${t.productivity_score}/5`)
      .join('\n');

    // Format leaves context into bullet items
    const leavesText = leavesList
      .map(l => `- [${l.date}]: Off - ${l.leave_type}`)
      .join('\n');

    const promptText = `
Please construct an executive summary report.

### Tone Directive:
${selectedTonePrompt}

### Week Logs Context:
${contextText || 'No tasks logged.'}

### Observed Leaves & Holidays:
${leavesText || 'None (fully worked period).'}

### Output Markdown Structure:
${tone === 'High-Level Summary' ? 'Provide ONLY the 4-5 bullet points of achievements (one sentence per bullet). Do NOT use words like "contributed" or "advanced". Do NOT include headings, recommendations, introductory text, time metrics, hours, or scores. Output only the plain bullet points.' : `
1. **Weekly Executive Summary** (General overview of hours & focus ratings)
2. **Logical Accomplishments Groupings** (Categorized lists of what was completed)
3. **Coaching Assessment** (Time allocations, focus highlights, leaves/holidays, and operational friction)
4. **Actionable Recommendations** (3 specific coaching items for next week)
`}
`;

    const result = await model.generateContent(promptText);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error('Empty generated content returned from Gemini.');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ summary: responseText });
  } catch (error: any) {
    console.error('Gemini Serverless API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal AI summarization error.' });
  }
}
