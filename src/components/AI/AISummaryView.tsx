import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, FileText, Copy, Check, AlertCircle, Key, Loader2, Printer, Eye, Code, Zap } from 'lucide-react';
import { generateAISummary, isGeminiConfigured } from '../../services/geminiService';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';

interface AISummaryViewProps {
  selectedDate: string;
}

interface Block {
  type: 'paragraph' | 'list-item' | 'header';
  text: string;
  level?: number;
}

interface Section {
  id: string;
  title: string;
  type: 'summary' | 'accomplishments' | 'coaching' | 'recommendations' | 'generic';
  blocks: Block[];
}

const parseMarkdownToSections = (content: string, selectedTone: string): Section[] => {
  if (!content) return [];

  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  // Check if content has headers
  const hasHeaders = lines.some(line => line.trim().startsWith('#'));

  if (!hasHeaders || selectedTone === 'High-Level Summary') {
    // Treat entire content as a single Summary section
    const blocks: Block[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        blocks.push({
          type: 'list-item',
          text: trimmed.replace(/^[-*•]\s+/, '')
        });
      } else {
        blocks.push({
          type: 'paragraph',
          text: trimmed
        });
      }
    });
    return [{
      id: 'summary',
      title: selectedTone === 'High-Level Summary' ? 'High-Level Accomplishments' : 'Weekly Summary Snapshot',
      type: 'summary',
      blocks
    }];
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Header starting with #
    if (trimmed.startsWith('#')) {
      const matchHeader = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (matchHeader) {
        const level = matchHeader[1].length;
        const text = matchHeader[2].replace(/\*{2}/g, '').trim();

        if (level >= 4) {
          // Inner section header block
          if (!currentSection) {
            currentSection = {
              id: 'summary-initial',
              title: 'Overview',
              type: 'summary',
              blocks: []
            };
            sections.push(currentSection);
          }
          currentSection.blocks.push({
            type: 'header',
            text,
            level
          });
          return;
        } else {
          // Top-level section (level 1, 2, 3)
          let type: Section['type'] = 'generic';
          const lowerText = text.toLowerCase();
          if (lowerText.includes('summary') || lowerText.includes('overview')) {
            type = 'summary';
          } else if (lowerText.includes('accomplishment') || lowerText.includes('deliverable') || lowerText.includes('grouping')) {
            type = 'accomplishments';
          } else if (lowerText.includes('assessment') || lowerText.includes('insight') || lowerText.includes('coaching')) {
            type = 'coaching';
          } else if (lowerText.includes('recommendation') || lowerText.includes('action') || lowerText.includes('next')) {
            type = 'recommendations';
          }

          // Strip any prefix numbers (e.g. "1. ")
          const cleanTitle = text.replace(/^\d+[\.\s\-:]+/, '').trim();
          currentSection = {
            id: `${type}-${sections.length}`,
            title: cleanTitle,
            type,
            blocks: []
          };
          sections.push(currentSection);
          return;
        }
      }
    }

    if (!currentSection) {
      currentSection = {
        id: 'summary-initial',
        title: 'Overview',
        type: 'summary',
        blocks: []
      };
      sections.push(currentSection);
    }

    // Detect lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      currentSection.blocks.push({
        type: 'list-item',
        text: trimmed.replace(/^[-*•]\s+/, '')
      });
    } else if (trimmed.match(/^\d+\./)) {
      currentSection.blocks.push({
        type: 'list-item',
        text: trimmed.replace(/^\d+\.\s+/, '')
      });
    } else {
      currentSection.blocks.push({
        type: 'paragraph',
        text: trimmed
      });
    }
  });

  return sections;
};

export const AISummaryView: React.FC<AISummaryViewProps> = ({ selectedDate }) => {
  const [selectedTone, setSelectedTone] = useState<'Professional Manager' | 'Portfolio Impact' | 'Personal Reflection' | 'High-Level Summary'>('Professional Manager');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reportViewMode, setReportViewMode] = useState<'dashboard' | 'raw'>('dashboard');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const tones = [
    { id: 'Professional Manager', label: 'Professional Manager', desc: 'Structured, formal performance review detailing deliverables and outcomes.' },
    { id: 'Portfolio Impact', label: 'Portfolio Impact', desc: 'Highlights high-cognitive engineering contributions and strategic milestones.' },
    { id: 'Personal Reflection', label: 'Personal Reflection', desc: 'Mindful coaching insights balancing work drag against cognitive energy.' },
    { id: 'High-Level Summary', label: 'High-Level Summary', desc: 'A concise 3-4 sentence digest of main accomplishments, omitting time metrics.' },
  ] as const;

  // Track auth session
  useEffect(() => {
    const checkUser = async () => {
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      }
    };
    checkUser();
  }, []);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Default to Monday & Sunday of selectedDate's week on mount/prop change
  useEffect(() => {
    const dStart = new Date(selectedDate + 'T00:00:00');
    const dayStart = dStart.getDay();
    const diffStart = dStart.getDate() - (dayStart === 0 ? 6 : dayStart - 1);
    const monday = new Date(dStart.setDate(diffStart));
    setStartDate(monday.toISOString().split('T')[0]);

    const dEnd = new Date(selectedDate + 'T00:00:00');
    const dayEnd = dEnd.getDay();
    const diffEnd = dEnd.getDate() - (dayEnd === 0 ? 6 : dayEnd - 1) + 6;
    const sunday = new Date(dEnd.setDate(diffEnd));
    setEndDate(sunday.toISOString().split('T')[0]);
  }, [selectedDate]);

  // Load existing summary when dates or tone changes
  useEffect(() => {
    const loadExistingSummary = async () => {
      if (!startDate || !endDate) return;
      
      setGeneratedContent('');
      setErrorMessage('');

      // 1. Try LocalStorage
      const localKey = `chronicle_summary_${startDate}_${endDate}_${selectedTone}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        setGeneratedContent(cached);
        return;
      }

      // 2. Try Supabase
      if (isSupabaseConfigured() && currentUser) {
        try {
          const { data, error } = await supabase
            .from('weekly_summaries')
            .select('generated_report_text, stats_snapshot')
            .eq('user_id', currentUser.id)
            .eq('week_start_date', startDate)
            .eq('selected_tone', selectedTone)
            .order('created_at', { ascending: false });
          
          if (!error && data && data.length > 0) {
            // Find the one matching the exact end date in stats_snapshot.date_range
            const targetRange = `${startDate} to ${endDate}`;
            const matched = data.find(r => r.stats_snapshot?.date_range === targetRange || r.stats_snapshot?.week_range === targetRange);
            const summaryToUse = matched ? matched.generated_report_text : data[0].generated_report_text;
            
            setGeneratedContent(summaryToUse);
            // Cache in LocalStorage
            localStorage.setItem(localKey, summaryToUse);
          }
        } catch (dbErr) {
          console.warn('Failed to load summary from database:', dbErr);
        }
      }
    };

    loadExistingSummary();
  }, [startDate, endDate, selectedTone, currentUser]);

  // Load cached checklist items when start/end dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    const localKey = `chronicle_checklist_${startDate}_${endDate}`;
    const cached = localStorage.getItem(localKey);
    if (cached) {
      try {
        setCheckedItems(JSON.parse(cached));
      } catch (e) {
        setCheckedItems({});
      }
    } else {
      setCheckedItems({});
    }
  }, [startDate, endDate]);

  const toggleCheckedItem = (key: string) => {
    setCheckedItems(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`chronicle_checklist_${startDate}_${endDate}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to calculate dates between startDate and endDate
  const getDatesInRange = useCallback((startStr: string, endStr: string): string[] => {
    if (!startStr || !endStr || startStr > endStr) return [];
    const dates: string[] = [];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, []);

  const isRangeInvalid = startDate > endDate;
  const isRangeTooLong = useCallback(() => {
    if (!startDate || !endDate || isRangeInvalid) return false;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 31;
  }, [startDate, endDate, isRangeInvalid])();

  // Gather all logs from the selected range for prompt context
  const getWeeklyLogsForPrompt = async (): Promise<any[]> => {
    const dates = getDatesInRange(startDate, endDate);
    const aggregatedRows: any[] = [];

    // 1. Try fetching from Supabase if configured and logged in
    if (isSupabaseConfigured() && currentUser) {
      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', currentUser.id)
          .in('date', dates);
        
        if (!error && data && data.length > 0) {
          return data.map(r => ({
            date: r.date,
            task_name: r.task_name || '',
            intended_hours: Number(r.intended_hours) || 0,
            actual_hours: Number(r.actual_hours) || 0,
            category: r.category || '',
            productivity_score: r.productivity_score || 3,
            is_billable: r.is_billable || false
          }));
        }
      } catch (e) {
        console.warn('Supabase weekly fetch warning:', e);
      }
    }

    // 2. Fallback to LocalStorage
    dates.forEach(date => {
      const localKey = `chronicle_tasks_${date}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          parsed.forEach((item: any) => {
            if (item.taskName || item.intendedHours || item.actualHours) {
              aggregatedRows.push({
                date,
                task_name: item.taskName || '',
                intended_hours: Number(item.intendedHours) || 0,
                actual_hours: Number(item.actualHours) || 0,
                category: item.category || '',
                productivity_score: item.productivityScore || 3,
                is_billable: item.isBillable || false
              });
            }
          });
        } catch (e) {
          console.error('Error parsing weekly logs context from LocalStorage:', e);
        }
      }
    });

    return aggregatedRows;
  };

  const handleGenerate = async () => {
    setErrorMessage('');
    setGeneratedContent('');
    setIsGenerating(true);

    try {
      const weeklyLogs = await getWeeklyLogsForPrompt();
      
      // Filter out totally empty/unlogged lines
      const activeLogs = weeklyLogs.filter(log => log.task_name && (log.intended_hours > 0 || log.actual_hours > 0));

      if (activeLogs.length === 0) {
        throw new Error('No daily tasks found for this period. Please add tasks in the Planner first.');
      }

      let reportText = '';

      // Try serverless API handler first
      try {
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            logs: activeLogs,
            tone: selectedTone
          })
        });

        if (response.ok) {
          const resData = await response.json();
          reportText = resData.summary;
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }
      } catch (apiErr: any) {
        console.warn('Vercel serverless function not available or failed. Operating client-side fallback...', apiErr);
        
        // Client-side fallback mapping
        if (isGeminiConfigured()) {
          const clientToneMap = {
            'Professional Manager': 'professional',
            'Portfolio Impact': 'professional',
            'Personal Reflection': 'encouraging',
            'High-Level Summary': 'high-level'
          } as const;

          reportText = await generateAISummary(
            startDate, 
            endDate,
            activeLogs, 
            clientToneMap[selectedTone]
          );
        } else {
          throw new Error(
            `Failed to reach backend summarizer: ${apiErr.message}. ` +
            'Please supply a Gemini API Key in the Settings tab to fall back to client-side compilation.'
          );
        }
      }

      setGeneratedContent(reportText);

      // Cache in LocalStorage
      const localKey = `chronicle_summary_${startDate}_${endDate}_${selectedTone}`;
      localStorage.setItem(localKey, reportText);

      // Save summary in database if authenticated
      if (isSupabaseConfigured() && currentUser) {
        try {
          await supabase.from('weekly_summaries').insert({
            user_id: currentUser.id,
            week_start_date: startDate,
            generated_report_text: reportText,
            selected_tone: selectedTone,
            stats_snapshot: {
              date_range: `${startDate} to ${endDate}`,
              total_logs: activeLogs.length
            }
          });
        } catch (dbErr) {
          console.warn('Could not persist weekly summary to database:', dbErr);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Summarizer operation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const parseInlineMarkdown = (text: string) => {
    const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.flatMap((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return [<strong key={`b-${i}`} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>];
      }
      
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((subPart, j) => {
        if (subPart.startsWith('`') && subPart.endsWith('`')) {
          return (
            <code key={`c-${i}-${j}`} className="px-1.5 py-0.5 bg-slate-100 text-slate-805 font-mono text-[11px] rounded border border-slate-200/50">
              {subPart.slice(1, -1)}
            </code>
          );
        }
        return subPart;
      });
    });
  };

  // Dedicated Card Renderers for Dashboard View
  const renderSummaryCard = (sec: Section) => {
    return (
      <div className="bg-white p-6 rounded-2xl border border-brand-indigo/15 hover:border-brand-indigo/35 shadow-xs space-y-4 transition-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-indigo/5 to-brand-emerald/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-2.5 border-b border-slate-100/60 pb-3 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{sec.title}</h3>
            <p className="text-[10px] text-brand-slate">High-level digest of work achievements.</p>
          </div>
        </div>
        <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-sans relative z-10">
          {sec.blocks.map((b, idx) => {
            if (b.type === 'list-item') {
              return (
                <li key={idx} className="flex items-start gap-2.5 hover:text-slate-850 transition-colors py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald shrink-0 mt-1.5" />
                  <span>{parseInlineMarkdown(b.text)}</span>
                </li>
              );
            }
            return (
              <p key={idx} className="text-slate-650 leading-relaxed text-[12px] font-medium border-l-2 border-brand-indigo/30 pl-3.5 py-0.5">
                {parseInlineMarkdown(b.text)}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAccomplishmentsCard = (sec: Section) => {
    const groups: { title: string; items: string[] }[] = [];
    let currentGroup: { title: string; items: string[] } | null = null;
    const standaloneItems: string[] = [];

    sec.blocks.forEach(b => {
      if (b.type === 'header') {
        currentGroup = { title: b.text, items: [] };
        groups.push(currentGroup);
      } else if (b.type === 'list-item') {
        if (currentGroup) {
          currentGroup.items.push(b.text);
        } else {
          standaloneItems.push(b.text);
        }
      } else if (b.type === 'paragraph') {
        if (b.text.trim()) {
          standaloneItems.push(b.text);
        }
      }
    });

    return (
      <div className="bg-white p-6 rounded-2xl border border-theme-border hover:border-slate-200 shadow-xs space-y-5 transition-premium">
        <div className="flex items-center gap-2.5 border-b border-slate-100/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{sec.title}</h3>
            <p className="text-[10px] text-brand-slate">Categorized deliverables and engineering milestones.</p>
          </div>
        </div>

        <div className="space-y-4">
          {standaloneItems.length > 0 && (
            <ul className="space-y-2">
              {standaloneItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-650 hover:text-slate-805 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-indigo shrink-0 mt-1.5" />
                  <span>{parseInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((grp, gIdx) => (
              <div key={gIdx} className="bg-slate-50/50 border border-slate-100 rounded-xl p-4.5 space-y-3 hover:shadow-xs transition-premium">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200/50 pb-2 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-brand-indigo" />
                  {grp.title}
                </h4>
                <ul className="space-y-2.5">
                  {grp.items.map((item, iIdx) => (
                    <li key={iIdx} className="flex items-start gap-2 text-[11px] text-slate-650 leading-relaxed hover:text-slate-805 transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-indigo/55 shrink-0 mt-1.5" />
                      <span>{parseInlineMarkdown(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCoachingCard = (sec: Section) => {
    return (
      <div className="bg-white p-6 rounded-2xl border border-amber-200/40 hover:border-amber-300 shadow-xs space-y-4 transition-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-2.5 border-b border-slate-100/60 pb-3 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-amber-55/10 text-amber-600 flex items-center justify-center shrink-0">
            <Zap className="w-4.5 h-4.5 fill-amber-500 stroke-none" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{sec.title}</h3>
            <p className="text-[10px] text-brand-slate">Operational trends and focus assessment.</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-650 leading-relaxed font-sans relative z-10">
          {sec.blocks.map((b, idx) => {
            if (b.type === 'list-item') {
              return (
                <li key={idx} className="flex items-start gap-2.5 py-0.5 hover:text-slate-805 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <span>{parseInlineMarkdown(b.text)}</span>
                </li>
              );
            }
            return (
              <p key={idx} className="bg-amber-50/20 border border-amber-100/30 p-3.5 rounded-xl text-slate-700 leading-relaxed">
                {parseInlineMarkdown(b.text)}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRecommendationsCard = (sec: Section) => {
    return (
      <div className="bg-white p-6 rounded-2xl border border-brand-indigo/15 hover:border-brand-indigo/35 shadow-xs space-y-4 transition-premium">
        <div className="flex items-center gap-2.5 border-b border-slate-100/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
            <Check className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{sec.title}</h3>
            <p className="text-[10px] text-brand-slate">Actionable coaching milestones for next period.</p>
          </div>
        </div>

        <div className="space-y-3 font-sans">
          {sec.blocks.map((b, idx) => {
            if (b.type === 'list-item') {
              const itemKey = `${sec.id}-${idx}`;
              const isChecked = !!checkedItems[itemKey];
              return (
                <div
                  key={idx}
                  onClick={() => toggleCheckedItem(itemKey)}
                  className={`p-3.5 rounded-xl border transition-premium cursor-pointer flex items-start gap-3 select-none print:bg-white print:border-slate-100 ${
                    isChecked 
                      ? 'bg-emerald-50/10 border-emerald-500/20 opacity-70 print:opacity-100' 
                      : 'bg-slate-50/50 border-slate-100 hover:border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all print:hidden ${
                    isChecked 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-slate-300 bg-white hover:border-brand-indigo'
                  }`}>
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className={`text-xs leading-relaxed ${isChecked ? 'line-through text-slate-400 print:no-underline print:text-slate-650' : 'text-slate-700 font-medium'}`}>
                    {parseInlineMarkdown(b.text)}
                  </span>
                </div>
              );
            }
            return (
              <p key={idx} className="text-xs text-slate-500 leading-relaxed pl-8">
                {parseInlineMarkdown(b.text)}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGenericCard = (sec: Section) => {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 hover:border-slate-200 transition-premium">
        <h3 className="font-bold text-foreground text-sm border-b border-slate-100/60 pb-3 flex items-center gap-2">
          <FileText className="w-4.5 h-4.5 text-slate-450" />
          {sec.title}
        </h3>
        <div className="space-y-3.5 text-xs text-slate-650 leading-relaxed font-sans">
          {sec.blocks.map((b, idx) => {
            if (b.type === 'list-item') {
              return (
                <li key={idx} className="flex items-start gap-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                  <span>{parseInlineMarkdown(b.text)}</span>
                </li>
              );
            }
            return (
              <p key={idx} className="text-slate-650 leading-relaxed">
                {parseInlineMarkdown(b.text)}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const parsedSections = parseMarkdownToSections(generatedContent, selectedTone);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Date Header range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Executive Summarizer</h2>
          <p className="text-sm text-brand-slate">Synthesize custom date range time blocks into targeted coaching reports via Gemini.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white border border-theme-border rounded-xl px-4 py-2.5 shadow-xs self-start sm:self-auto select-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider">Start</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold text-foreground bg-transparent border-none focus:outline-none cursor-pointer focus:ring-1 focus:ring-brand-indigo/35 rounded px-1"
            />
          </div>
          <div className="w-px h-4 bg-theme-divider hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider">End</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold text-foreground bg-transparent border-none focus:outline-none cursor-pointer focus:ring-1 focus:ring-brand-indigo/35 rounded px-1"
            />
          </div>
        </div>
      </div>

      {isRangeInvalid && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium print:hidden">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>Start date cannot be after end date.</span>
        </div>
      )}

      {isRangeTooLong && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium print:hidden">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Please select a range of 31 days or less to keep the AI summary concise.</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium print:hidden">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings / Selection Panel */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-6 self-start print:hidden">
          <div className="space-y-1">
            <h3 className="font-bold text-foreground">Weekly Tone Focus</h3>
            <p className="text-xs text-brand-slate">Select an audience model for your coaching report digest.</p>
          </div>

          <div className="space-y-3">
            {tones.map((t) => {
              const isSelected = selectedTone === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTone(t.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-premium cursor-pointer ${
                    isSelected 
                      ? 'bg-brand-indigo/5 border-brand-indigo/30 shadow-xs' 
                      : 'bg-white border-theme-border hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-brand-indigo/10 text-brand-indigo' : 'bg-slate-100 text-brand-slate'
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{t.label}</div>
                      <div className="text-[10px] text-brand-slate leading-tight">{t.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || isRangeInvalid || isRangeTooLong}
            className="w-full py-3 bg-brand-indigo hover:bg-brand-indigo-dark text-white rounded-xl text-xs font-bold shadow-md shadow-brand-indigo/10 transition-premium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Generating Report...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Report
              </>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm lg:col-span-2 flex flex-col min-h-[400px] print:col-span-3 print:border-none print:shadow-none print:p-0 print:max-h-none print:overflow-visible">
          <div className="flex justify-between items-center border-b border-theme-border pb-4 mb-4 print:hidden">
            <div>
              <h3 className="font-bold text-foreground text-sm">Coach Report Output</h3>
              <p className="text-[10px] text-brand-slate">Synthesized report details will display below.</p>
            </div>
            
            {generatedContent && (
              <div className="flex items-center gap-2">
                {/* View Mode Tabs Selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-theme-border text-xs select-none">
                  <button
                    onClick={() => setReportViewMode('dashboard')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      reportViewMode === 'dashboard' 
                        ? 'bg-white text-foreground shadow-xs' 
                        : 'text-brand-slate hover:text-foreground'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Dashboard
                  </button>
                  <button
                    onClick={() => setReportViewMode('raw')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      reportViewMode === 'raw' 
                        ? 'bg-white text-foreground shadow-xs' 
                        : 'text-brand-slate hover:text-foreground'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" /> Markdown
                  </button>
                </div>

                {reportViewMode === 'dashboard' && (
                  <button
                    onClick={handlePrint}
                    className="p-2 border border-theme-border hover:bg-slate-50 rounded-lg text-brand-slate hover:text-foreground transition-premium cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                    title="Print report to PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                )}

                <button
                  onClick={handleCopy}
                  className="p-2 border border-theme-border hover:bg-slate-50 rounded-lg text-brand-slate hover:text-foreground transition-premium cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Markdown
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 print:hidden">
              <div className="w-10 h-10 border-4 border-brand-indigo/25 border-t-brand-indigo rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <div className="text-xs font-semibold text-foreground">Analyzing weekly log matrix...</div>
                <div className="text-[10px] text-brand-slate">Synthesizing logs inside gemini-2.5-flash</div>
              </div>
            </div>
          ) : generatedContent ? (
            reportViewMode === 'dashboard' ? (
              <div className="flex-1 space-y-6 max-h-[600px] overflow-y-auto pr-1 select-text print:max-h-none print:overflow-visible print:p-0">
                {parsedSections.map(sec => {
                  switch (sec.type) {
                    case 'summary':
                      return <React.Fragment key={sec.id}>{renderSummaryCard(sec)}</React.Fragment>;
                    case 'accomplishments':
                      return <React.Fragment key={sec.id}>{renderAccomplishmentsCard(sec)}</React.Fragment>;
                    case 'coaching':
                      return <React.Fragment key={sec.id}>{renderCoachingCard(sec)}</React.Fragment>;
                    case 'recommendations':
                      return <React.Fragment key={sec.id}>{renderRecommendationsCard(sec)}</React.Fragment>;
                    default:
                      return <React.Fragment key={sec.id}>{renderGenericCard(sec)}</React.Fragment>;
                  }
                })}
              </div>
            ) : (
              <pre className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4.5 font-mono text-xs leading-relaxed overflow-x-auto select-all max-h-[600px] whitespace-pre-wrap text-slate-750">
                {generatedContent}
              </pre>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 p-12 print:hidden">
              <div className="w-12 h-12 bg-slate-50 border border-theme-border rounded-xl flex items-center justify-center text-brand-slate">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">No Weekly Report Generated Yet</div>
                <div className="text-[10px] text-brand-slate max-w-xs mx-auto mb-4">Select a tone and click the button on the left to compile your time block summary.</div>
                {!isGeminiConfigured() && (
                  <div className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-indigo bg-brand-indigo/5 border border-brand-indigo/10 px-2.5 py-1 rounded-full">
                    <Key className="w-3 h-3" /> Setup API key in Settings (Local fallback)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
