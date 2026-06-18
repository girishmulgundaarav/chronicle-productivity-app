import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { queueSyncAction } from '../services/syncService';

export interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  addCategory: (name: string, color: string) => Promise<void>;
  updateCategory: (id: string, name: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'coding', name: '#Coding and testing', color: '#0d9488' },
  { id: 'meetings', name: '#Meetings', color: '#f59e0b' },
  { id: 'learning', name: '#Learning', color: '#10b981' },
  { id: 'admin', name: '#Admin', color: '#64748b' }
];

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setLoading(true);

    // 1. Try Loading from Supabase first
    if (isSupabaseConfigured() && user) {
      try {
        const { data, error } = await supabase
          .from('user_categories')
          .select('*')
          .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
          const formatted: Category[] = data.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color
          }));
          setCategories(formatted);
          localStorage.setItem(`chronicle_categories_${user.id}`, JSON.stringify(formatted));
          setLoading(false);
          return;
        }

        // Seed default categories in Supabase if empty
        if (!error && (!data || data.length === 0)) {
          const seeds = DEFAULT_CATEGORIES.map(c => ({
            user_id: user.id,
            name: c.name,
            color: c.color
          }));
          
          const { data: inserted, error: insErr } = await supabase
            .from('user_categories')
            .insert(seeds)
            .select();

          if (!insErr && inserted) {
            const formatted: Category[] = inserted.map(c => ({
              id: c.id,
              name: c.name,
              color: c.color
            }));
            setCategories(formatted);
            localStorage.setItem(`chronicle_categories_${user.id}`, JSON.stringify(formatted));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load user categories from Supabase:', err);
      }
    }

    // 2. Local Fallback
    const localKey = user ? `chronicle_categories_${user.id}` : 'chronicle_categories_local';
    const cached = localStorage.getItem(localKey);
    if (cached) {
      try {
        setCategories(JSON.parse(cached));
      } catch (e) {
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setCategories(DEFAULT_CATEGORIES);
      localStorage.setItem(localKey, JSON.stringify(DEFAULT_CATEGORIES));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = async (name: string, color: string) => {
    if (!name.startsWith('#')) {
      name = '#' + name;
    }
    
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Category ${name} already exists.`);
    }

    const newId = crypto.randomUUID();
    const newCat: Category = { id: newId, name, color };

    const updated = [...categories, newCat];
    setCategories(updated);
    
    const localKey = user ? `chronicle_categories_${user.id}` : 'chronicle_categories_local';
    localStorage.setItem(localKey, JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      const dbPayload = { id: newId, user_id: user.id, name, color };
      if (navigator.onLine) {
        try {
          const { error } = await supabase.from('user_categories').insert(dbPayload);
          if (error) throw error;
        } catch (err) {
          console.warn('Sync failed, queuing custom category insert offline...', err);
          await queueSyncAction('user_categories', 'insert', dbPayload);
        }
      } else {
        await queueSyncAction('user_categories', 'insert', dbPayload);
      }
    }
  };

  const updateCategory = async (id: string, name: string, color: string) => {
    if (!name.startsWith('#')) {
      name = '#' + name;
    }

    if (categories.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Category name ${name} is already taken.`);
    }

    const updated = categories.map(c => c.id === id ? { ...c, name, color } : c);
    setCategories(updated);

    const localKey = user ? `chronicle_categories_${user.id}` : 'chronicle_categories_local';
    localStorage.setItem(localKey, JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      const dbPayload = { id, name, color };
      if (navigator.onLine) {
        try {
          const { error } = await supabase.from('user_categories').update(dbPayload).eq('id', id);
          if (error) throw error;
        } catch (err) {
          console.warn('Sync failed, queuing custom category update offline...', err);
          await queueSyncAction('user_categories', 'update', dbPayload);
        }
      } else {
        await queueSyncAction('user_categories', 'update', dbPayload);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);

    const localKey = user ? `chronicle_categories_${user.id}` : 'chronicle_categories_local';
    localStorage.setItem(localKey, JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      const dbPayload = { id };
      if (navigator.onLine) {
        try {
          const { error } = await supabase.from('user_categories').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          console.warn('Sync failed, queuing custom category delete offline...', err);
          await queueSyncAction('user_categories', 'delete', dbPayload);
        }
      } else {
        await queueSyncAction('user_categories', 'delete', dbPayload);
      }
    }
  };

  return (
    <CategoryContext.Provider value={{ categories, loading, addCategory, updateCategory, deleteCategory }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
};
