import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, Check, Loader2, ChevronLeft, ChevronRight, AlertCircle, Plus, Trash2, Copy } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { useCategories } from '../../contexts/CategoryContext';
import { queueSyncAction } from '../../services/syncService';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface TaskItem {
  id: string; // Holds temporary client ID or permanent Supabase UUID
  isTemp: boolean; // Tracks if the task is newly created and not yet saved in database
  taskName: string;
  intendedHours: string;
  actualHours: string;
  category: string;
  productivityScore: number;
  isBillable: boolean;
  isSaving: boolean;
  isSaved: boolean;
  intendedError?: string;
  actualError?: string;
}

interface PlannerViewProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const TASK_PRESETS = [
  { taskName: 'Team Nova - DSM', category: '#Meetings', intendedHours: '0.25' },
  { taskName: 'DXC stand up', category: '#Meetings', intendedHours: '0.33' },
  { taskName: 'Retro', category: '#Meetings', intendedHours: '0.67' },
  { taskName: 'Sprint planning', category: '#Meetings', intendedHours: '1.0' },
  { taskName: 'Code Review', category: '#Coding and testing', intendedHours: '1.0' },
  { taskName: 'Feature Development', category: '#Coding and testing', intendedHours: '2.0' },
  { taskName: 'Technical Research', category: '#Learning', intendedHours: '1.5' },
  { taskName: 'Admin & Email', category: '#Admin', intendedHours: '0.5' }
];

const formatPresetTime = (hoursStr: string) => {
  const hours = parseFloat(hoursStr);
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  return `${hours}h`;
};

export const PlannerView: React.FC<PlannerViewProps> = ({ selectedDate, setSelectedDate }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const { categories: dynamicCategories } = useCategories();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Check auth session
  useEffect(() => {
    const checkUser = async () => {
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      }
    };
    checkUser();
  }, []);

  // Fetch daily tasks
  const loadDailyTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    // 1. Try fetching from Supabase
    if (isSupabaseConfigured() && currentUser) {
      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const loaded: TaskItem[] = data.map((row: any) => ({
            id: row.id,
            isTemp: false,
            taskName: row.task_name,
            intendedHours: row.intended_hours.toString(),
            actualHours: row.actual_hours.toString(),
            category: row.category === '#Coding' ? '#Coding and testing' : ((row.category as any) || ''),
            productivityScore: row.productivity_score || 5,
            isBillable: row.is_billable || false,
            isSaving: false,
            isSaved: true
          }));
          setTasks(loaded);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error('Failed to load tasks from Supabase:', err.message);
        setErrorMessage('Could not sync with Supabase. Working in offline mode.');
      }
    }

    // 2. Fallback to LocalStorage
    const localKey = `chronicle_tasks_${selectedDate}`;
    const localData = localStorage.getItem(localKey);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const loaded: TaskItem[] = parsed.map((item: any) => ({
          ...item,
          category: item.category === '#Coding' ? '#Coding and testing' : (item.category || ''),
          isSaving: false,
          isSaved: true
        }));
        setTasks(loaded);
      } catch (e) {
        console.error('LocalStorage parsing failed for date:', selectedDate, e);
        setTasks([]);
      }
    } else {
      setTasks([]);
    }
    setLoading(false);
  }, [selectedDate, currentUser]);

  useEffect(() => {
    loadDailyTasks();
  }, [loadDailyTasks]);

  // Handle input values
  const handleInputChange = (id: string, field: keyof TaskItem, value: any) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id === id) {
          const updated = { ...task, [field]: value, isSaved: false };

          // Inline validation
          if (field === 'intendedHours') {
            const val = parseFloat(value);
            if (value && isNaN(Number(value))) {
              updated.intendedError = 'Invalid number';
            } else if (val < 0) {
              updated.intendedError = 'Cannot be negative';
            } else if (val > 24) {
              updated.intendedError = 'Cannot exceed 24h';
            } else {
              updated.intendedError = undefined;
            }
          }

          if (field === 'actualHours') {
            const val = parseFloat(value);
            if (value && isNaN(Number(value))) {
              updated.actualError = 'Invalid number';
            } else if (val < 0) {
              updated.actualError = 'Cannot be negative';
            } else if (val > 24) {
              updated.actualError = 'Cannot exceed 24h';
            } else {
              updated.actualError = undefined;
            }
          }

          return updated;
        }
        return task;
      })
    );
  };

  // Construct updated task state and trigger autosave
  const updateAndSaveTask = async (id: string, field: keyof TaskItem, value: any) => {
    const currentTask = tasks.find(t => t.id === id);
    if (!currentTask) return;

    const updatedTask = { ...currentTask, [field]: value, isSaved: false };

    setTasks(prev => {
      const next = prev.map(t => t.id === id ? updatedTask : t);
      saveToLocalStorage(selectedDate, next);
      return next;
    });

    await handleSaveTask(id, updatedTask, true);
  };

  // Add task preset block
  const handleAddPreset = (preset: typeof TASK_PRESETS[0]) => {
    const tempId = generateUUID();
    const newTask: TaskItem = {
      id: tempId,
      isTemp: true,
      taskName: preset.taskName,
      intendedHours: preset.intendedHours,
      actualHours: preset.intendedHours,
      category: preset.category,
      productivityScore: 5,
      isBillable: false,
      isSaving: false,
      isSaved: false
    };
    setTasks(prev => {
      const updated = [...prev, newTask];
      saveToLocalStorage(selectedDate, updated);
      return updated;
    });
  };

  // Add new task row
  const handleAddTask = () => {
    const tempId = generateUUID();
    const newTask: TaskItem = {
      id: tempId,
      isTemp: true,
      taskName: '',
      intendedHours: '',
      actualHours: '',
      category: '',
      productivityScore: 5,
      isBillable: false,
      isSaving: false,
      isSaved: false
    };
    setTasks(prev => [...prev, newTask]);
  };

  // Duplicate task list from the previous day into today
  const handleCopyFromYesterday = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    handleCopyFromDate(prevDateStr);
  };

  // Duplicate task list from a specific source date into today
  const handleCopyFromDate = async (sourceDateStr: string) => {
    if (sourceDateStr === selectedDate) {
      alert('Cannot copy tasks from the same day.');
      return;
    }

    let sourceTasks: any[] = [];
    setErrorMessage('');

    // 1. Try loading from Supabase
    if (isSupabaseConfigured() && currentUser) {
      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('date', sourceDateStr);
        
        if (!error && data && data.length > 0) {
          sourceTasks = data.map(row => ({
            taskName: row.task_name,
            intendedHours: row.intended_hours.toString(),
            actualHours: row.actual_hours.toString(),
            category: row.category === '#Coding' ? '#Coding and testing' : (row.category || ''),
            productivityScore: row.productivity_score || 5,
            isBillable: row.is_billable || false
          }));
        }
      } catch (err: any) {
        console.error('Failed to load tasks from source date in Supabase:', err.message);
      }
    }

    // 2. Local fallback if no tasks found
    if (sourceTasks.length === 0) {
      const localKey = `chronicle_tasks_${sourceDateStr}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          sourceTasks = parsed.map((item: any) => ({
            taskName: item.taskName || '',
            intendedHours: item.intendedHours || '',
            actualHours: item.actualHours || '',
            category: item.category === '#Coding' ? '#Coding and testing' : (item.category || ''),
            productivityScore: item.productivityScore || 5,
            isBillable: item.isBillable || false
          }));
        } catch (e) {
          console.error('LocalStorage parsing failed for source date:', sourceDateStr, e);
        }
      }
    }

    if (sourceTasks.length === 0) {
      alert(`No tasks found for ${sourceDateStr} to copy.`);
      return;
    }

    // Map to TaskItem format with new temp IDs
    const copied: TaskItem[] = sourceTasks.map(t => ({
      id: generateUUID(),
      isTemp: true,
      taskName: t.taskName,
      intendedHours: t.intendedHours,
      actualHours: t.actualHours, // copies actual hours as-is
      category: t.category,
      productivityScore: t.productivityScore,
      isBillable: t.isBillable,
      isSaving: false,
      isSaved: false
    }));

    setTasks(prev => {
      const merged = [...prev, ...copied];
      saveToLocalStorage(selectedDate, merged);
      return merged;
    });
  };

  // Save specific task item
  const handleSaveTask = async (id: string, taskToSave?: TaskItem, isAutosave = false) => {
    const task = taskToSave || tasks.find(t => t.id === id);
    if (!task) return;

    if (task.intendedError || task.actualError) {
      if (!isAutosave) {
        alert(`Cannot save task: ${task.intendedError || task.actualError}`);
      }
      return;
    }

    if (!task.taskName.trim()) {
      if (!isAutosave) {
        alert('Please enter a task name.');
      }
      return;
    }

    // Set saving loading state
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isSaving: true } : t));

    try {
      let savedId = task.id;

      // 1. Save to Supabase if configured & logged in
      if (isSupabaseConfigured() && currentUser) {
        const payload: any = {
          id: task.id,
          user_id: currentUser.id,
          date: selectedDate,
          task_name: task.taskName,
          intended_hours: parseFloat(task.intendedHours) || 0,
          actual_hours: parseFloat(task.actualHours) || 0,
          category: task.category || null,
          productivity_score: task.productivityScore,
          is_billable: task.isBillable
        };

        if (navigator.onLine) {
          const { data, error } = await supabase
            .from('daily_tasks')
            .upsert(payload)
            .select('id')
            .single();

          if (error) throw error;
          if (data) savedId = data.id;
        } else {
          // Offline, queue for sync
          const actionType = task.isTemp ? 'insert' : 'update';
          await queueSyncAction('daily_tasks', actionType, payload);
        }
      }

      // Update local task state and cache
      setTasks(prev => {
        const updated = prev.map(t =>
          t.id === id
            ? { ...t, id: savedId, isTemp: false, isSaving: false, isSaved: true }
            : t
        );
        saveToLocalStorage(selectedDate, updated);
        return updated;
      });
      
      // Update User Profile XP on successful save (+10 XP)
      if (isSupabaseConfigured() && currentUser && task.isTemp && navigator.onLine) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('xp_points')
          .eq('id', currentUser.id)
          .single();
        if (profile) {
          await supabase
            .from('profiles')
            .update({ xp_points: profile.xp_points + 10 })
            .eq('id', currentUser.id);
        }
      }
    } catch (err: any) {
      console.error('Task save error:', err.message || err);
      
      // Queue offline if user is logged in
      if (isSupabaseConfigured() && currentUser) {
        const payload: any = {
          id: task.id,
          user_id: currentUser.id,
          date: selectedDate,
          task_name: task.taskName,
          intended_hours: parseFloat(task.intendedHours) || 0,
          actual_hours: parseFloat(task.actualHours) || 0,
          category: task.category || null,
          productivity_score: task.productivityScore,
          is_billable: task.isBillable
        };
        const actionType = task.isTemp ? 'insert' : 'update';
        console.warn('Network write failed, queuing task write in IndexedDB:', err);
        await queueSyncAction('daily_tasks', actionType, payload);
      }
      
      setErrorMessage(`Failed to save task to database: ${err.message || err}. Queued for offline sync.`);
      
      // Update local state as saved locally
      setTasks(prev => {
        const updated = prev.map(t =>
          t.id === id
            ? { ...t, isTemp: false, isSaving: false, isSaved: true }
            : t
        );
        saveToLocalStorage(selectedDate, updated);
        return updated;
      });
    }
  };

  // Save all unsaved tasks in parallel
  const handleSaveAllTasks = async () => {
    const unsavedTasks = tasks.filter(t => !t.isSaved && t.taskName.trim());
    if (unsavedTasks.length === 0 || isSavingAll) return;

    setIsSavingAll(true);

    // Set saving state for all unsaved tasks
    setTasks(prev =>
      prev.map(t =>
        !t.isSaved && t.taskName.trim() ? { ...t, isSaving: true } : t
      )
    );

    try {
      await Promise.all(
        unsavedTasks.map(t => handleSaveTask(t.id, t, true))
      );
    } catch (err) {
      console.error('Failed to save some tasks:', err);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Delete specific task item
  const handleDeleteTask = async (id: string, isTemp: boolean) => {
    // Set loading/disabled or filter out immediately
    if (isTemp) {
      setTasks(prev => {
        const filtered = prev.filter(t => t.id !== id);
        saveToLocalStorage(selectedDate, filtered);
        return filtered;
      });
      return;
    }

    try {
      if (isSupabaseConfigured() && currentUser) {
        if (navigator.onLine) {
          const { error } = await supabase
            .from('daily_tasks')
            .delete()
            .eq('id', id);

          if (error) throw error;
        } else {
          // Offline queue delete
          await queueSyncAction('daily_tasks', 'delete', { id });
        }
      }

      setTasks(prev => {
        const filtered = prev.filter(t => t.id !== id);
        saveToLocalStorage(selectedDate, filtered);
        return filtered;
      });
    } catch (err: any) {
      console.error('Delete error:', err.message || err);
      
      if (isSupabaseConfigured() && currentUser) {
        console.warn('Delete failed, queuing delete offline...');
        await queueSyncAction('daily_tasks', 'delete', { id });
      }

      setTasks(prev => {
        const filtered = prev.filter(t => t.id !== id);
        saveToLocalStorage(selectedDate, filtered);
        return filtered;
      });
    }
  };

  // Helper to persist list in localStorage
  const saveToLocalStorage = (dateKey: string, taskList: TaskItem[]) => {
    const localKey = `chronicle_tasks_${dateKey}`;
    if (taskList.length === 0) {
      localStorage.removeItem(localKey);
      return;
    }
    const cleanList = taskList.map(t => ({
      id: t.id,
      isTemp: t.isTemp,
      taskName: t.taskName,
      intendedHours: t.intendedHours,
      actualHours: t.actualHours,
      category: t.category,
      productivityScore: t.productivityScore,
      isBillable: t.isBillable
    }));
    localStorage.setItem(localKey, JSON.stringify(cleanList));
  };

  const changeDate = (direction: 'next' | 'prev') => {
    const current = new Date(selectedDate);
    if (direction === 'next') {
      current.setUTCDate(current.getUTCDate() + 1);
    } else {
      current.setUTCDate(current.getUTCDate() - 1);
    }
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formattedDisplayDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', options);
  };

  // Analytics calculations
  const totalIntendedHours = tasks.reduce((sum, t) => sum + (parseFloat(t.intendedHours) || 0), 0);
  const totalActualHours = tasks.reduce((sum, t) => sum + (parseFloat(t.actualHours) || 0), 0);

  const ratedTasks = tasks.filter(t => t.taskName.trim() && (parseFloat(t.actualHours) || 0) > 0);
  const averageProductivity = ratedTasks.length > 0
    ? ratedTasks.reduce((sum, t) => sum + t.productivityScore, 0) / ratedTasks.length
    : 0;



  // Category summary
  const categoryHours: Record<string, number> = {};
  dynamicCategories.forEach(c => {
    categoryHours[c.name] = 0;
  });
  tasks.forEach(t => {
    if (t.category) {
      if (!(t.category in categoryHours)) {
        categoryHours[t.category] = 0;
      }
      categoryHours[t.category] += (parseFloat(t.actualHours) || 0);
    }
  });

  const totalCatHours = Object.values(categoryHours).reduce((sum, h) => sum + h, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Task Log Sheet</h2>
          <p className="text-sm text-brand-slate">Record plans and hours completed on a daily basis.</p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-2 bg-white border border-theme-border rounded-xl p-1 shadow-xs self-start sm:self-auto">
          <button
            onClick={() => changeDate('prev')}
            className="p-2 hover:bg-slate-50 text-brand-slate hover:text-foreground rounded-lg transition-premium cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 px-3 text-xs font-bold text-foreground select-none">
            <Calendar className="w-4 h-4 text-brand-indigo" />
            <span>{formattedDisplayDate()}</span>
          </div>

          <button
            onClick={() => changeDate('next')}
            className="p-2 hover:bg-slate-50 text-brand-slate hover:text-foreground rounded-lg transition-premium cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Add Presets */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-theme-border rounded-xl p-3">
        <span className="text-[10px] font-extrabold text-brand-slate uppercase tracking-wider mr-1 select-none flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-brand-indigo" /> Quick Add Preset:
        </span>
        {TASK_PRESETS.map((preset) => (
          <button
            key={preset.taskName}
            onClick={() => handleAddPreset(preset)}
            className="text-[10px] font-bold text-brand-slate bg-white border border-theme-divider hover:border-brand-indigo hover:text-brand-indigo px-3 py-1.5 rounded-lg transition-premium cursor-pointer inline-flex items-center gap-1 hover:shadow-xs"
          >
            <span>{preset.taskName}</span>
            <span className="text-[9px] font-medium text-brand-slate/60 hover:text-brand-indigo/60">({formatPresetTime(preset.intendedHours)})</span>
          </button>
        ))}
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Hours Progress */}
        <div className="bg-white border border-theme-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider block">Hours Completed</span>
              <h4 className="text-xl font-extrabold text-foreground">
                {totalActualHours.toFixed(1)} <span className="text-xs text-brand-slate font-medium">/ {totalIntendedHours.toFixed(1)} hrs</span>
              </h4>
            </div>
            <div className="p-2 bg-indigo-50 rounded-xl text-brand-indigo">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-indigo to-indigo-500 rounded-full transition-premium"
                style={{ width: `${totalIntendedHours > 0 ? Math.min((totalActualHours / totalIntendedHours) * 100, 100) : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-brand-slate block">
              {totalIntendedHours > 0 
                ? `${Math.round((totalActualHours / totalIntendedHours) * 100)}% of plan achieved` 
                : 'No hours planned yet'}
            </span>
          </div>
        </div>

        {/* Card 2: Productivity Score */}
        <div className="bg-white border border-theme-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider block">Productivity Rating</span>
              <h4 className="text-xl font-extrabold text-foreground">
                {averageProductivity > 0 ? averageProductivity.toFixed(1) : '—'} <span className="text-xs text-brand-slate font-medium">/ 5.0</span>
              </h4>
            </div>
            {/* SVG circular gauge */}
            <div className="relative w-12 h-12">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle 
                  cx="24" 
                  cy="24" 
                  r="18" 
                  fill="transparent" 
                  stroke="#f1f5f9" 
                  strokeWidth="3.5"
                />
                {/* Foreground circle */}
                <circle 
                  cx="24" 
                  cy="24" 
                  r="18" 
                  fill="transparent" 
                  stroke={
                    averageProductivity >= 4.0 ? '#10b981' : 
                    averageProductivity >= 3.0 ? '#6366f1' :
                    averageProductivity >= 2.0 ? '#f59e0b' : '#ef4444'
                  } 
                  strokeWidth="3.5"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 - (averageProductivity > 0 ? (averageProductivity / 5) : 0) * (2 * Math.PI * 18)}`}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-brand-slate">
                {averageProductivity > 0 ? `${Math.round((averageProductivity / 5) * 100)}%` : '0%'}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-brand-slate block leading-tight">
            {averageProductivity >= 4.5 ? '🔥 Peak execution score!' :
             averageProductivity >= 3.5 ? '📈 Strong, productive day.' :
             averageProductivity >= 2.5 ? '⚖️ Balanced operational state.' :
             averageProductivity > 0 ? '⚠️ Low productivity rating.' : 'No rated hours logged.'}
          </span>
        </div>

        {/* Card 3: Category Distribution */}
        <div className="bg-white border border-theme-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-brand-slate uppercase tracking-wider block">Category Split</span>
            <div className="flex items-baseline gap-1">
              <h4 className="text-xl font-extrabold text-foreground">
                {Object.values(categoryHours).filter(h => h > 0).length}
              </h4>
              <span className="text-xs text-brand-slate font-medium">categories active</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {/* Segmented bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
              {totalCatHours === 0 ? (
                <div className="h-full w-full bg-slate-100" />
              ) : (
                Object.entries(categoryHours).map(([cat, hours]) => {
                  if (hours === 0) return null;
                  const percentage = (hours / totalCatHours) * 100;
                  const catColor = dynamicCategories.find(c => c.name === cat)?.color || '#94a3b8';
                  return (
                    <div 
                      key={cat}
                      className="h-full transition-premium"
                      style={{ width: `${percentage}%`, backgroundColor: catColor }}
                      title={`${cat}: ${hours}h (${Math.round(percentage)}%)`}
                    />
                  );
                })
              )}
            </div>

            {/* Mini legend */}
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[8px] font-bold text-brand-slate select-none">
              {dynamicCategories.map(c => (
                <span key={c.id} className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name.startsWith('#') ? c.name.slice(1) : c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Connection warning banners */}
      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!currentUser && isSupabaseConfigured() && (
        <div className="bg-brand-indigo/5 border border-brand-indigo/10 text-brand-indigo p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-brand-indigo shrink-0" />
          <span>Offline mock mode active. Log in to sync details with Supabase.</span>
        </div>
      )}

      {/* Daily Total Hours validation banner */}
      {(totalIntendedHours > 24 || totalActualHours > 24) && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Daily Schedule Warning</span>
            <p className="text-[10px] mt-0.5 leading-tight text-red-700">
              Total planned hours ({totalIntendedHours.toFixed(1)}h) or completed hours ({totalActualHours.toFixed(1)}h) exceed 24 hours for this day. Please review your logs.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div className="bg-white rounded-2xl border border-theme-border shadow-sm overflow-hidden">
        {/* Table Headings */}
        <div className="hidden lg:grid grid-cols-12 bg-slate-50/75 border-b border-theme-divider px-6 py-4 text-[10px] font-bold text-brand-slate uppercase tracking-wider gap-4">
          <div className="col-span-4">Task Description</div>
          <div className="col-span-2 text-center">Intended (Hrs)</div>
          <div className="col-span-2 text-center">Actual (Hrs)</div>
          <div className="col-span-2">Tags & Focus</div>
          <div className="col-span-2 text-center">Actions</div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-indigo" />
            <span className="text-xs text-brand-slate">Loading daily logs...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-theme-border flex items-center justify-center text-brand-slate mx-auto">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">No tasks logged for today</div>
              <div className="text-[10px] text-brand-slate max-w-xs mx-auto mt-0.5">Click the Add Task button below to create your daily schedule logs.</div>
            </div>
            <div className="flex justify-center gap-3 mt-3 flex-wrap">
              <button
                onClick={handleAddTask}
                className="text-xs font-bold text-brand-indigo bg-brand-indigo/5 border border-brand-indigo/10 px-4 py-2 rounded-xl hover:bg-brand-indigo/10 transition-premium cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add First Task
              </button>
              <button
                onClick={handleCopyFromYesterday}
                className="text-xs font-bold text-brand-slate bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 hover:text-foreground transition-premium cursor-pointer inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Previous Day
              </button>
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-premium">
                <Copy className="w-3.5 h-3.5 text-brand-slate" />
                <span className="text-xs font-bold text-brand-slate whitespace-nowrap">Or copy from:</span>
                <input
                  type="date"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCopyFromDate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs bg-transparent border-none focus:outline-none cursor-pointer text-brand-slate font-semibold"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-theme-border">
            {tasks.map((task) => {
              return (
                <div 
                  key={task.id} 
                  className={`grid grid-cols-1 lg:grid-cols-12 px-6 py-5 lg:py-4 items-center hover:bg-slate-50/20 transition-premium gap-4 ${
                    task.isSaved ? 'bg-emerald-50/5' : ''
                  }`}
                >
                  {/* 1. Task Description Column */}
                  <div className="col-span-4">
                    <label className="lg:hidden text-[9px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Task description</label>
                    <input
                      type="text"
                      value={task.taskName}
                      onChange={(e) => handleInputChange(task.id, 'taskName', e.target.value)}
                      onBlur={() => handleSaveTask(task.id, undefined, true)}
                      placeholder="e.g. Implement Supabase client setup"
                      className="w-full text-xs border border-theme-divider hover:border-slate-300 rounded-xl px-3.5 py-2 bg-white text-foreground focus:outline-none focus:border-brand-indigo transition-premium shadow-xs"
                    />
                  </div>

                  {/* 2. Intended Hours Column */}
                  <div className="col-span-2">
                    <label className="lg:hidden text-[9px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Intended Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={task.intendedHours}
                      onChange={(e) => handleInputChange(task.id, 'intendedHours', e.target.value)}
                      onBlur={() => handleSaveTask(task.id, undefined, true)}
                      placeholder="0.0"
                      className={`w-full text-xs text-center border rounded-xl px-3 py-2 bg-white text-foreground focus:outline-none transition-premium shadow-xs ${
                        task.intendedError 
                          ? 'border-red-400 focus:border-red-500 hover:border-red-400 bg-red-50/10' 
                          : 'border-theme-divider hover:border-slate-300 focus:border-brand-indigo'
                      }`}
                    />
                    {task.intendedError && (
                      <span className="text-[8px] font-extrabold text-red-500 block text-center mt-1 select-none animate-fade-in">
                        {task.intendedError}
                      </span>
                    )}
                  </div>

                  {/* 3. Actual Hours Column */}
                  <div className="col-span-2">
                    <label className="lg:hidden text-[9px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Actual Completed (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={task.actualHours}
                      onChange={(e) => handleInputChange(task.id, 'actualHours', e.target.value)}
                      onBlur={() => handleSaveTask(task.id, undefined, true)}
                      placeholder="0.0"
                      className={`w-full text-xs text-center border rounded-xl px-3 py-2 bg-white text-foreground focus:outline-none transition-premium shadow-xs ${
                        task.actualError 
                          ? 'border-red-400 focus:border-red-500 hover:border-red-400 bg-red-50/10' 
                          : 'border-theme-divider hover:border-slate-300 focus:border-brand-indigo'
                      }`}
                    />
                    {task.actualError && (
                      <span className="text-[8px] font-extrabold text-red-500 block text-center mt-1 select-none animate-fade-in">
                        {task.actualError}
                      </span>
                    )}
                  </div>

                  {/* 4. Controls Matrix (Category and Score Sliders) */}
                  <div className="col-span-2 space-y-2">
                    {/* Category pills */}
                    <div>
                      <label className="lg:hidden text-[9px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Category</label>
                      <div className="flex flex-wrap gap-1">
                        {dynamicCategories.map((cat) => {
                          const isSelected = task.category === cat.name;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => updateAndSaveTask(task.id, 'category', isSelected ? '' : cat.name)}
                              className="px-2 py-1 rounded-md text-[9px] font-bold border transition-premium cursor-pointer"
                              style={{
                                backgroundColor: isSelected ? cat.color : 'transparent',
                                borderColor: isSelected ? cat.color : '#e2e8f0',
                                color: isSelected ? '#ffffff' : '#64748b'
                              }}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Slider status */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[9px] font-bold text-brand-slate uppercase select-none">Score</span>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={task.productivityScore}
                        onChange={(e) => handleInputChange(task.id, 'productivityScore', parseInt(e.target.value))}
                        onMouseUp={() => handleSaveTask(task.id, undefined, true)}
                        onTouchEnd={() => handleSaveTask(task.id, undefined, true)}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
                      />
                      <span className="text-[10px] font-extrabold text-foreground select-none w-3 text-right">
                        {task.productivityScore}
                      </span>
                    </div>
                  </div>

                  {/* 5. Save/Delete Actions */}
                  <div className="col-span-2 flex justify-end gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => handleSaveTask(task.id)}
                      disabled={task.isSaving}
                      className={`h-9 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-premium cursor-pointer flex-1 lg:flex-initial ${
                        task.isSaved
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                          : 'bg-white hover:bg-slate-50 text-brand-slate hover:text-foreground border-theme-divider hover:border-slate-300'
                      }`}
                    >
                      {task.isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-indigo" />
                      ) : task.isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" /> Save
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id, task.isTemp)}
                      className="h-9 w-9 rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-premium cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer actions - Add Task */}
        {!loading && tasks.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-theme-divider flex justify-between items-center flex-wrap gap-3">
            <div className="text-[10px] text-brand-slate font-bold uppercase tracking-wider select-none">
              {tasks.filter(t => !t.isSaved).length} unsaved {tasks.filter(t => !t.isSaved).length === 1 ? 'change' : 'changes'}
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {tasks.some(t => !t.isSaved && t.taskName.trim()) && (
                <button
                  onClick={handleSaveAllTasks}
                  disabled={isSavingAll}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl hover:bg-emerald-100 transition-premium cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving All...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save All Changes
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleCopyFromYesterday}
                className="text-xs font-bold text-brand-slate bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 hover:text-foreground transition-premium cursor-pointer inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Previous Day
              </button>
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:bg-slate-50 transition-premium">
                <Copy className="w-3.5 h-3.5 text-brand-slate" />
                <span className="text-xs font-bold text-brand-slate whitespace-nowrap">Or copy from:</span>
                <input
                  type="date"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCopyFromDate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs bg-transparent border-none focus:outline-none cursor-pointer text-brand-slate font-semibold"
                />
              </div>
              <button
                onClick={handleAddTask}
                className="text-xs font-bold text-white bg-brand-indigo hover:bg-brand-indigo-dark px-4 py-2.5 rounded-xl shadow-md shadow-brand-indigo/10 transition-premium cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Another Task
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
