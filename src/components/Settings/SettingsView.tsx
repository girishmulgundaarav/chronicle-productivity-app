import React, { useState } from 'react';
import { Database, Key, Info, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { useCategories } from '../../contexts/CategoryContext';

const PALETTE_COLORS = [
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#06b6d4', // Cyan
];

export const SettingsView: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('VITE_GEMINI_API_KEY') || '');
  
  const [isSaved, setIsSaved] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const xpPoints = profile?.xp_points ?? 120;
  const streakCount = profile?.streak_count ?? 4;
  const efficiencyScore = 84; // Baseline default efficiency score

  const handleSaveConfigs = () => {
    localStorage.setItem('VITE_GEMINI_API_KEY', geminiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetData = async () => {
    try {
      if (isSupabaseConfigured() && user) {
        const { error } = await supabase
          .from('profiles')
          .update({ xp_points: 120, streak_count: 4 })
          .eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      }
      alert('Operational metrics reset to initial baseline values.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newCatName.trim()) {
      setErrorMsg('Category name cannot be empty.');
      return;
    }
    
    let formattedName = newCatName.trim();
    if (!formattedName.startsWith('#')) {
      formattedName = '#' + formattedName;
    }

    try {
      await addCategory(formattedName, newCatColor);
      setNewCatName('');
      setNewCatColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add category.');
    }
  };

  const handleStartEdit = (cat: any) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
    setEditingColor(cat.color);
    setErrorMsg('');
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMsg('');
    if (!editingName.trim()) {
      setErrorMsg('Category name cannot be empty.');
      return;
    }

    let formattedName = editingName.trim();
    if (!formattedName.startsWith('#')) {
      formattedName = '#' + formattedName;
    }

    try {
      await updateCategory(id, formattedName, editingColor);
      setEditingCatId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update category.');
    }
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setErrorMsg('');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">System Preferences</h2>
        <p className="text-sm text-brand-slate">Configure Supabase storage links, authenticate your Gemini API endpoints, and manage local worklogs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Keys Config */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Key className="w-4 h-4 text-brand-indigo" /> API Credentials
            </h3>
            <p className="text-xs text-brand-slate">Required to activate real-time syncing and Gemini AI summarizations.</p>
          </div>

          <div className="space-y-4">
            {/* Gemini API Key */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter Gemini API key (e.g. AIzaSy...)"
                className="w-full text-xs border border-theme-divider rounded-xl px-3.5 py-2.5 bg-white text-foreground focus:outline-none focus:border-brand-indigo"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {isSupabaseConfigured() ? (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-semibold">
                <Database className="w-3.5 h-3.5" /> Supabase Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-semibold">
                <Database className="w-3.5 h-3.5" /> Mock Sandbox Active
              </div>
            )}
            
            <button
              onClick={handleSaveConfigs}
              className="text-xs font-semibold bg-brand-indigo hover:bg-brand-indigo-dark text-white px-4 py-2.5 rounded-xl shadow-md shadow-brand-indigo/10 transition-premium flex items-center gap-1.5 cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Configurations Saved
                </>
              ) : (
                'Save Configurations'
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Information / System Utilities */}
        <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-emerald" /> Operational Guidelines
            </h3>
            <p className="text-xs text-brand-slate">Understand how data flows inside Chronicle AI.</p>
          </div>

          <div className="space-y-4 text-xs text-brand-slate leading-relaxed">
            <div className="p-4 bg-slate-50 border border-theme-border rounded-xl space-y-2">
              <div className="font-bold text-foreground">1. Data Storage Policy</div>
              <p>In the absence of a configured Supabase backend link, all data is held in volatile local state variables. Save your keys to establish remote tables.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-theme-border rounded-xl space-y-2">
              <div className="font-bold text-foreground">2. Gemini Security API</div>
              <p>Your Gemini API key is stored locally in your browser's `localStorage` and never leaves your computer. AI summaries are requested client-side.</p>
            </div>

            <div className="border border-red-100 bg-red-50/50 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-red-800 text-xs">Reset Local Space</div>
                <div className="text-[10px] text-red-600">Restore streak data, levels, and planner blocks.</div>
                <div className="text-[9px] font-semibold text-red-700 mt-1 select-none">
                  Active State: {xpPoints} XP • {streakCount} Days • {efficiencyScore}% Efficiency
                </div>
              </div>
              <button
                onClick={handleResetData}
                className="text-[10px] font-bold bg-white text-red-700 hover:bg-red-50 border border-red-200 px-3.5 py-2 rounded-lg transition-premium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Category tag customization manager */}
      <div className="bg-white p-6 rounded-2xl border border-theme-border shadow-sm space-y-6">
        <div className="space-y-1">
          <h3 className="font-bold text-foreground flex items-center gap-2 text-sm lg:text-base">
            <Database className="w-4 h-4 text-brand-indigo" /> Custom Category Tag Manager
          </h3>
          <p className="text-xs text-brand-slate">Define, rename, or color-code your own category tags. Changes sync instantly across planners and charts.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-theme-border animate-fade-in">
            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider select-none">Create New Tag</h4>
            
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Tag Name</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-extrabold text-brand-slate">#</span>
                <input
                  type="text"
                  value={newCatName.startsWith('#') ? newCatName.slice(1) : newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="DevOps"
                  className="w-full text-xs border border-theme-divider rounded-xl pl-8 pr-3.5 py-2.5 bg-white text-foreground focus:outline-none focus:border-brand-indigo font-semibold shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1.5">Color Tag</label>
              <div className="flex flex-wrap gap-2 items-center">
                {PALETTE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCatColor(c)}
                    className="w-6 h-6 rounded-full border border-black/5 flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 shrink-0"
                    style={{ backgroundColor: c }}
                  >
                    {newCatColor === c && (
                      <Check className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    )}
                  </button>
                ))}
                
                {/* Custom Color Input */}
                <div className="relative w-6 h-6 rounded-full border border-black/5 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="absolute inset-0 w-10 h-10 -m-2 p-0 border-0 cursor-pointer"
                  />
                  {!PALETTE_COLORS.includes(newCatColor) && (
                    <Check className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] z-10 pointer-events-none" />
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full text-xs font-bold text-white bg-brand-indigo hover:bg-brand-indigo-dark py-2.5 rounded-xl shadow-md shadow-brand-indigo/10 transition-premium cursor-pointer"
            >
              Add Category Tag
            </button>
          </form>

          {/* Categories List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider select-none">Active Tags</h4>
            
            <div className="divide-y divide-theme-border border border-theme-border rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto bg-white shadow-xs">
              {categories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                
                return (
                  <div key={cat.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <div className="relative flex items-center flex-1">
                          <span className="absolute left-3 text-xs font-extrabold text-brand-slate">#</span>
                          <input
                            type="text"
                            value={editingName.startsWith('#') ? editingName.slice(1) : editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full text-xs border border-brand-indigo rounded-lg pl-6 pr-2 py-1.5 bg-white text-foreground focus:outline-none font-semibold"
                          />
                        </div>
                        <input
                          type="color"
                          value={editingColor}
                          onChange={(e) => setEditingColor(e.target.value)}
                          className="w-7 h-7 rounded border-0 p-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[10px] font-extrabold transition-premium cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-2.5 py-1.5 bg-slate-100 text-brand-slate hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-premium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3.5 h-3.5 rounded-full border border-black/5 shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-extrabold text-foreground">{cat.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-theme-divider rounded-lg text-[10px] font-bold text-brand-slate hover:text-foreground transition-premium cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the category ${cat.name}?`)) {
                                deleteCategory(cat.id);
                              }
                            }}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 rounded-lg text-[10px] font-bold transition-premium cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

