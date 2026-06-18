import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Activity, Zap, Flame, Award, Loader2, Sparkles, TrendingUp, Check, Download, Copy, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useCategories } from '../../contexts/CategoryContext';

export const DashboardView: React.FC = () => {
  const { profile } = useAuth();
  const xpPoints = profile?.xp_points ?? 120;
  const streakCount = profile?.streak_count ?? 4;
  const { categories: dynamicCategories } = useCategories();
  
  const [loading, setLoading] = useState(true);
  const [dbData, setDbData] = useState<any[]>([]);
  const [heatmapDataRows, setHeatmapDataRows] = useState<any[]>([]);
  const [exportCopied, setExportCopied] = useState(false);
  const [showTable, setShowTable] = useState(false);
  
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'custom'>('week');
  
  // Date calculations
  const getCurrentMonthStr = () => new Date().toISOString().split('T')[0].substring(0, 7); // "YYYY-MM"
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  
  // Calculate Monday and Sunday of current week for defaults
  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    return monday.toISOString().split('T')[0];
  };

  const getSundayOfCurrentWeek = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - distanceToMonday + 6);
    return sunday.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState<string>(getMondayOfCurrentWeek());
  const [endDate, setEndDate] = useState<string>(getSundayOfCurrentWeek());

  const [weeklyStats, setWeeklyStats] = useState({
    intendedHours: 0,
    actualHours: 0,
    billableHours: 0,
    matchRate: 0,
    averageProductivity: 0
  });

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Helper to get past 7 dates of current week (Monday to Sunday)
  const getPastWeekDates = useCallback(() => {
    const dates: string[] = [];
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dates.push(day.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Helper to get trailing 16 weeks dates (for heatmap)
  const getTrailing16WeeksDates = useCallback(() => {
    const dates: string[] = [];
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    // Monday of 15 weeks ago
    const startMon = new Date(today);
    startMon.setDate(today.getDate() - distanceToMonday - (15 * 7));
    
    for (let i = 0; i < 16 * 7; i++) {
      const day = new Date(startMon);
      day.setDate(startMon.getDate() + i);
      dates.push(day.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Get active target dates list based on selected filter mode
  const getTargetDates = useCallback((): string[] => {
    if (viewMode === 'week') {
      return getPastWeekDates();
    }
    
    if (viewMode === 'month') {
      if (!selectedMonth) return [];
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const dates: string[] = [];
      for (let d = 1; d <= lastDay; d++) {
        const dayStr = String(d).padStart(2, '0');
        dates.push(`${selectedMonth}-${dayStr}`);
      }
      return dates;
    }
    
    if (viewMode === 'custom') {
      if (!startDate || !endDate || startDate > endDate) return [];
      const dates: string[] = [];
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const current = new Date(start);
      
      // Safety limit of 180 days to keep query operations lightweight
      let count = 0;
      while (current <= end && count < 180) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        count++;
      }
      return dates;
    }
    
    return [];
  }, [viewMode, selectedMonth, startDate, endDate, getPastWeekDates]);

  // Load contribution details for the trailing 16 weeks (Heatmap)
  const loadHeatmapData = useCallback(async () => {
    const dates = getTrailing16WeeksDates();
    
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('user_id', user.id)
            .in('date', dates);
          if (!error && data) {
            setHeatmapDataRows(data);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load heatmap data from Supabase:', err);
      }
    }
    
    // LocalStorage Fallback
    const localRows: any[] = [];
    dates.forEach(date => {
      const localKey = `chronicle_tasks_${date}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          parsed.forEach((item: any) => {
            localRows.push({
              date,
              actual_hours: parseFloat(item.actualHours) || 0
            });
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
    setHeatmapDataRows(localRows);
  }, [getTrailing16WeeksDates]);

  const loadWeeklyAnalytics = useCallback(async () => {
    setLoading(true);
    const dates = getTargetDates();

    if (dates.length === 0) {
      setDbData([]);
      setWeeklyStats({
        intendedHours: 0,
        actualHours: 0,
        billableHours: 0,
        matchRate: 0,
        averageProductivity: 0
      });
      setLoading(false);
      return;
    }

    // 1. Try loading from Supabase first
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('user_id', user.id)
            .in('date', dates);

          if (!error && data) {
            setDbData(data);
            calculateMetrics(data);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Supabase dashboard load failed, using local fallback:', err);
      }
    }

    // 2. Fallback to LocalStorage
    const aggregatedLocalRows: any[] = [];
    dates.forEach((date) => {
      const localKey = `chronicle_tasks_${date}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          parsed.forEach((item: any) => {
            aggregatedLocalRows.push({
              date,
              task_name: item.taskName,
              intended_hours: parseFloat(item.intendedHours) || 0,
              actual_hours: parseFloat(item.actualHours) || 0,
              category: item.category,
              productivity_score: item.productivityScore,
              is_billable: item.isBillable
            });
          });
        } catch (e) {
          console.error('Error parsing local analytics for date:', date, e);
        }
      }
    });

    setDbData(aggregatedLocalRows);
    calculateMetrics(aggregatedLocalRows);
    setLoading(false);
  }, [getTargetDates]);

  useEffect(() => {
    loadWeeklyAnalytics();
  }, [loadWeeklyAnalytics]);

  useEffect(() => {
    loadHeatmapData();
  }, [loadHeatmapData]);

  const calculateMetrics = (rows: any[]) => {
    let plannedTotal = 0;
    let actualTotal = 0;
    let billableTotal = 0;
    let matchedTotal = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    rows.forEach(r => {
      const plannedVal = parseFloat(r.intended_hours) || 0;
      const actualVal = parseFloat(r.actual_hours) || 0;

      plannedTotal += plannedVal;
      actualTotal += actualVal;

      if (actualVal > 0) {
        if (r.is_billable) {
          billableTotal += actualVal;
        }
        if (r.productivity_score) {
          scoreSum += r.productivity_score * actualVal; // Weighted focus score
          scoreCount += actualVal;
        }
      }

      // Check task matching alignment (if both intended and actual task exists)
      if (plannedVal > 0 && actualVal > 0) {
        // Simple heuristic: if difference between intended and actual is within 1 hr, treat as a match
        const difference = Math.abs(plannedVal - actualVal);
        if (difference <= 1) {
          matchedTotal += actualVal;
        }
      }
    });

    setWeeklyStats({
      intendedHours: parseFloat(plannedTotal.toFixed(1)),
      actualHours: parseFloat(actualTotal.toFixed(1)),
      billableHours: parseFloat(billableTotal.toFixed(1)),
      matchRate: plannedTotal > 0 ? Math.min(100, Math.round((actualTotal / plannedTotal) * 100)) : 0,
      averageProductivity: scoreCount > 0 ? parseFloat((scoreSum / scoreCount).toFixed(1)) : 0
    });
  };

  // Compile Recharts Bar Data: Planned vs Actual per day
  const getBarChartData = () => {
    const dates = getTargetDates();
    return dates.map(date => {
      const dateObj = new Date(date + 'T00:00:00');
      let label = '';
      if (viewMode === 'week') {
        label = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        // Format as short date like "Jun 18" for month and custom views
        label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      
      const dayRows = dbData.filter(r => r.date === date);
      const plannedSum = dayRows.reduce((acc, r) => acc + (parseFloat(r.intended_hours) || 0), 0);
      const actualSum = dayRows.reduce((acc, r) => acc + (parseFloat(r.actual_hours) || 0), 0);

      return {
        name: label,
        Intended: parseFloat(plannedSum.toFixed(1)),
        Actual: parseFloat(actualSum.toFixed(1))
      };
    });
  };

  // Compile Recharts Pie Data: Category distribution based on actual hours spent
  const getPieChartData = () => {
    const categories: Record<string, { name: string, value: number, color: string }> = {};
    
    dynamicCategories.forEach(c => {
      categories[c.name] = {
        name: c.name.startsWith('#') ? c.name.slice(1) : c.name,
        value: 0,
        color: c.color
      };
    });

    dbData.forEach(r => {
      const actualVal = parseFloat(r.actual_hours) || 0;
      if (actualVal > 0 && r.category) {
        if (!categories[r.category]) {
          categories[r.category] = {
            name: r.category.startsWith('#') ? r.category.slice(1) : r.category,
            value: 0,
            color: '#64748b'
          };
        }
        categories[r.category].value += actualVal;
      }
    });

    return Object.values(categories)
      .filter(c => c.value > 0)
      .map(c => ({
        ...c,
        value: parseFloat(c.value.toFixed(1))
      }));
  };

  // Render GitHub-Style Daily/Weekly Productivity Heatmap Grid
  // Columns = 16 Weeks, Rows = 7 Days. Color maps to sum of actual hours logged that day.
  const getHeatmapGridData = () => {
    const weeks = 16;
    const allHeatmapDates = getTrailing16WeeksDates();
    
    const getIntensity = (weekIdx: number, dayIdx: number) => {
      const dateIdx = weekIdx * 7 + dayIdx;
      const dateStr = allHeatmapDates[dateIdx];
      if (dateStr) {
        const dayRows = heatmapDataRows.filter(r => r.date === dateStr);
        const totalHours = dayRows.reduce((acc, r) => acc + (parseFloat(r.actual_hours) || 0), 0);
        if (totalHours === 0) return 0;
        if (totalHours <= 2) return 1;
        if (totalHours <= 5) return 2;
        if (totalHours <= 8) return 3;
        return 4;
      }
      return 0;
    };

    return daysOfWeek.map((dayName, dIdx) => {
      const cells = Array.from({ length: weeks }).map((_, wIdx) => {
        return {
          week: wIdx,
          intensity: getIntensity(wIdx, dIdx)
        };
      });
      return { dayName, cells };
    });
  };

  const getHeatmapCellColor = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-slate-100 hover:bg-slate-200 border-white/50';
      case 1: return 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/5';
      case 2: return 'bg-emerald-500/35 hover:bg-emerald-500/45 border-emerald-500/10';
      case 3: return 'bg-emerald-500/60 hover:bg-emerald-500/70 border-emerald-500/20';
      case 4: return 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600/20';
      default: return 'bg-slate-100';
    }
  };

  const exportToCSV = () => {
    if (dbData.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = ['Date', 'Task Name', 'Intended Hours', 'Actual Hours', 'Category', 'Productivity Score', 'Billable'];
    const csvRows = [
      headers.join(','),
      ...dbData.map(r => [
        r.date,
        `"${(r.task_name || '').replace(/"/g, '""')}"`,
        r.intended_hours,
        r.actual_hours,
        r.category || 'None',
        r.productivity_score || 3,
        r.is_billable ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chronicle_weekly_report_${getPastWeekDates()[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyMarkdownTable = () => {
    if (dbData.length === 0) {
      alert('No data to copy.');
      return;
    }
    const headers = ['Date', 'Task Name', 'Intended Hours', 'Actual Hours', 'Category', 'Focus Score', 'Billable'];
    const divider = ['---', '---', '---', '---', '---', '---', '---'];
    
    const rows = dbData.map(r => [
      r.date,
      r.task_name || '',
      `${r.intended_hours}h`,
      `${r.actual_hours}h`,
      r.category || 'None',
      `${r.productivity_score || 3}/5`,
      r.is_billable ? 'Yes' : 'No'
    ]);

    const markdown = [
      `| ${headers.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...rows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');

    navigator.clipboard.writeText(markdown);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  const renderTaskTable = () => {
    if (dbData.length === 0) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-theme-border text-center shadow-xs">
          <p className="text-xs text-brand-slate font-bold">No logs recorded for this selected time window.</p>
        </div>
      );
    }

    // Sort logs chronologically by date
    const sortedData = [...dbData].sort((a, b) => a.date.localeCompare(b.date));

    // Category style mapping
    const getCategoryStyles = (cat: string) => {
      const match = dynamicCategories.find(c => c.name === cat);
      const color = match ? match.color : '#64748b';
      return {
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color
      };
    };

    const getCategoryLabel = (cat: string) => {
      return cat ? cat.replace('#', '') : 'None';
    };

    // Render rating dots out of 5
    const renderRatingDots = (score: number) => {
      const activeScore = score || 5; // Fallback default to 5
      return (
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div 
              key={idx} 
              className={`w-2 h-2 rounded-full transition-all ${
                idx < activeScore 
                  ? 'bg-brand-emerald' 
                  : 'bg-slate-100 border border-slate-200'
              }`}
            />
          ))}
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl border border-theme-border shadow-xs overflow-hidden animate-fade-in font-sans">
        <div className="p-5 border-b border-theme-border flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-foreground text-sm">Detailed Log Ledger</h3>
            <p className="text-[10px] text-brand-slate">Tabular log breakdown of all activities scheduled within selected time ranges.</p>
          </div>
          <span className="text-[10px] font-extrabold text-brand-indigo bg-brand-indigo/5 border border-brand-indigo/10 px-2.5 py-1 rounded-full">
            {sortedData.length} records matching
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-theme-divider bg-slate-50/30 text-[10px] font-bold text-brand-slate uppercase tracking-wider select-none">
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6">Task Name</th>
                <th className="py-3.5 px-6">Hours (Plan / Act)</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Productivity Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border text-xs">
              {sortedData.map((row, idx) => {
                const dateObj = new Date(row.date + 'T00:00:00');
                const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 text-brand-slate font-bold tracking-tight whitespace-nowrap">{formattedDate}</td>
                    <td className="py-3 px-6 text-foreground font-semibold max-w-xs truncate" title={row.task_name}>{row.task_name}</td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-slate-450">{row.intended_hours || 0}h</span>
                        <span className="text-brand-slate font-medium text-[10px]">/</span>
                        <span className="text-brand-indigo">{row.actual_hours || 0}h</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <span 
                        className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border"
                        style={getCategoryStyles(row.category)}
                      >
                        {getCategoryLabel(row.category)}
                      </span>
                    </td>
                    <td className="py-3 px-6">{renderRatingDots(row.productivity_score)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const barData = getBarChartData();
  const pieData = getPieChartData();
  const heatmapData = getHeatmapGridData();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-indigo" />
        <span className="text-xs font-semibold text-brand-slate">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner and Streaks */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics OS</h2>
          <p className="text-sm text-brand-slate">Review daily logs breakdown, focus score calculations, and active streak metrics.</p>
        </div>

        {/* Action Buttons & Streaks Header widget */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {dbData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportToCSV}
                title="Download report as CSV file"
                className="px-3.5 py-2 text-xs font-bold text-brand-indigo bg-brand-indigo/5 border border-brand-indigo/10 hover:bg-brand-indigo/10 rounded-xl transition-premium cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={copyMarkdownTable}
                title="Copy report as markdown table to clipboard"
                className="px-3.5 py-2 text-xs font-bold text-brand-slate bg-white border border-theme-border hover:bg-slate-50 rounded-xl transition-premium cursor-pointer flex items-center gap-1.5"
              >
                {exportCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Table Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Markdown
                  </>
                )}
              </button>
              <button
                onClick={() => setShowTable(!showTable)}
                title={showTable ? "Hide detailed log table" : "Display detailed logs table"}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-premium cursor-pointer flex items-center gap-1.5 ${
                  showTable 
                    ? 'bg-brand-indigo text-white shadow-xs' 
                    : 'text-brand-slate bg-white border border-theme-border hover:bg-slate-50'
                }`}
              >
                {showTable ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hide Detailed Logs
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> View Detailed Logs
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 bg-white border border-theme-border rounded-2xl p-3 shadow-xs select-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-700">
              <Flame className="w-4 h-4 fill-amber-500 stroke-none" />
              <span className="text-xs font-extrabold">{streakCount} Day Streak</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-indigo/5 border border-brand-indigo/10 rounded-full text-brand-indigo">
              <Award className="w-4 h-4" />
              <span className="text-xs font-extrabold">{xpPoints} XP Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-theme-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-premium cursor-pointer ${
              viewMode === 'week' 
                ? 'bg-brand-indigo text-white shadow-xs' 
                : 'text-brand-slate hover:bg-slate-50 border border-theme-border'
            }`}
          >
            Current Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-premium cursor-pointer ${
              viewMode === 'month' 
                ? 'bg-brand-indigo text-white shadow-xs' 
                : 'text-brand-slate hover:bg-slate-50 border border-theme-border'
            }`}
          >
            Monthly View
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-premium cursor-pointer ${
              viewMode === 'custom' 
                ? 'bg-brand-indigo text-white shadow-xs' 
                : 'text-brand-slate hover:bg-slate-50 border border-theme-border'
            }`}
          >
            Custom Range
          </button>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'week' && getTargetDates().length > 0 && (
            <div className="text-xs font-bold text-brand-slate bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100/60">
              Range: <span className="text-foreground">{getTargetDates()[0]} to {getTargetDates()[6]}</span>
            </div>
          )}

          {viewMode === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-slate uppercase tracking-wider">Select Month</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold text-foreground bg-slate-50 border border-theme-border focus:outline-none cursor-pointer focus:ring-1 focus:ring-brand-indigo/35 rounded-xl px-3 py-2"
              />
            </div>
          )}

          {viewMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-theme-border rounded-xl px-4 py-1.5 shadow-xs font-sans w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider">Start</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-bold text-foreground bg-transparent border-none focus:outline-none cursor-pointer focus:ring-1 focus:ring-brand-indigo/35 rounded px-1"
                />
              </div>
              <div className="hidden sm:block w-px h-4 bg-theme-divider" />
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
          )}
        </div>
      </div>

      {viewMode === 'custom' && startDate > endDate && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>Start date cannot be after end date.</span>
        </div>
      )}

      {/* Row 1: KPI Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
        <div className="bg-white p-5 rounded-2xl border border-theme-border shadow-xs">
          <div className="text-[10px] font-bold text-brand-slate uppercase tracking-wider mb-1">Time Completed</div>
          <div className="text-2xl font-black text-foreground">{weeklyStats.actualHours} hrs</div>
          <div className="text-[10px] text-brand-slate font-medium mt-1">Out of {weeklyStats.intendedHours} planned</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-theme-border shadow-xs">
          <div className="text-[10px] font-bold text-brand-slate uppercase tracking-wider mb-1">Intentionality Ratio</div>
          <div className="text-2xl font-black text-brand-indigo">{weeklyStats.matchRate}%</div>
          <div className="text-[10px] text-brand-slate font-medium mt-1">Daily goal matching rate</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-theme-border shadow-xs">
          <div className="text-[10px] font-bold text-brand-slate uppercase tracking-wider mb-1">Avg Focus Rating</div>
          <div className="text-2xl font-black text-brand-emerald flex items-center gap-1">
            <Zap className="w-5 h-5 fill-brand-emerald stroke-none" />
            {weeklyStats.averageProductivity} <span className="text-xs text-brand-slate font-normal">/ 5</span>
          </div>
          <div className="text-[10px] text-brand-slate font-medium mt-1">Weighted by hours completed</div>
        </div>
      </div>

      {/* Row 2: Charts (Intentionality & Time Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intentionality Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-theme-border pb-3">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-brand-indigo" /> Intentionality Matrix
              </h3>
              <p className="text-[10px] text-brand-slate">Comparing total planned hours vs. actual completed hours.</p>
            </div>
          </div>
          <div className="h-64 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#94a3b8" 
                  height={getTargetDates().length > 7 ? 40 : 24}
                  tick={getTargetDates().length > 7 ? { angle: -30, textAnchor: 'end', dy: 5 } : undefined}
                />
                <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px' }}
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Intended" fill="#5eead4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#34d399" radius={[4, 4, 0, 0]} />

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Distribution Pie/Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-theme-border pb-3">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-brand-indigo" /> Category Distribution
              </h3>
              <p className="text-[10px] text-brand-slate">Visualizing total actual hours spent per category.</p>
            </div>
          </div>
          <div className="h-64 flex flex-col md:flex-row items-center justify-center text-xs gap-4">
            {pieData.length > 0 ? (
              <>
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 grid grid-cols-2 md:flex md:flex-col gap-2 px-4 mt-4 md:mt-0">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-foreground">{item.name}</span>
                      </div>
                      <span className="text-brand-slate font-bold">{item.value} hrs</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-brand-slate font-medium">
                No tasks hours logged yet this week. Add some completed tasks in the Planner to view analytics.
              </div>
            )}
          </div>
        </div>
      </div>

      {showTable && renderTaskTable()}

      {/* Row 3: Daily Activity Heatmap Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-theme-border pb-3 mb-6 gap-3">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-emerald" /> Productivity Heatmap
            </h3>
            <p className="text-[10px] text-brand-slate">GitHub-style grid mapping contribution volume (total hours logged) on a daily basis over the last 16 weeks.</p>
          </div>
          
          {/* Heatmap Legend */}
          <div className="flex flex-wrap gap-1.5 items-center text-[9px] font-bold text-brand-slate uppercase select-none">
            <span>0h</span>
            <div className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-200" />
            <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/15 border border-emerald-500/5" />
            <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/35 border border-emerald-500/10" />
            <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/60 border border-emerald-500/20" />
            <div className="w-3.5 h-3.5 rounded-md bg-emerald-600" />
            <span>8h+</span>
          </div>
        </div>

        {/* Heatmap Grid Layout */}
        <div className="overflow-x-auto pb-2 select-none">
          <div className="min-w-[650px]">
            {/* Heatmap Grid container */}
            <div className="flex gap-2.5 items-start">
              {/* Day Labels Column */}
              <div className="flex flex-col gap-[3.5px] pr-1.5 text-[10px] text-brand-slate font-bold uppercase select-none h-full pt-1.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                  <div key={day} className="h-4 flex items-center justify-end leading-none">
                    {idx % 2 === 0 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Weeks grid */}
              <div className="flex gap-[3.5px] flex-1">
                {Array.from({ length: 16 }).map((_, wIdx) => {
                  return (
                    <div key={wIdx} className="flex flex-col gap-[3.5px]">
                      {heatmapData.map((row, rIdx) => {
                        const cell = row.cells[wIdx];
                        return (
                          <div
                            key={rIdx}
                            className={`w-4 h-4 rounded-sm border transition-all duration-200 cursor-pointer ${getHeatmapCellColor(cell.intensity)}`}
                            title={`Week ${wIdx + 1}, ${row.dayName}: Level ${cell.intensity}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
