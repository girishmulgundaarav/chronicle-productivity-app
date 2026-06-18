import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  xp_points: number;
  streak_count: number;
}

interface AuthContextType {
  user: any;
  profile: Profile | null;
  loading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!isSupabaseConfigured());

  // Helper to fetch user profiles from public.profiles table
  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist, we can wait or insert a profile
        console.error('Error fetching profile:', error.message);
      } else if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          xp_points: data.xp_points,
          streak_count: data.streak_count
        });
      }
    } catch (e) {
      console.error('Profile fetch failed:', e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Setup mock user for offline test resilience
      setUser({ id: 'mock-user-123', email: 'girish@chronicle.ai', user_metadata: { full_name: 'Girish Mulgund' } });
      setProfile({
        id: 'mock-user-123',
        full_name: 'Girish Mulgund',
        avatar_url: null,
        xp_points: 120,
        streak_count: 4
      });
      setIsOffline(true);
      setLoading(false);
      return;
    }

    // Read current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsOffline(false);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsOffline(false);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update loading once profile is populated
  useEffect(() => {
    if (user && profile) {
      setLoading(false);
    } else if (!user) {
      setLoading(false);
    }
  }, [user, profile]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured. Operative in mock sandbox.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured. Operative in mock sandbox.');
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      // Mock log out
      setUser(null);
      setProfile(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOffline, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
