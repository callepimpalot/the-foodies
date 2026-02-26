# FEATURE BRIEF: Authentication & Account System
# Meal Buddy / The Foodies
# Purpose: Add Supabase Auth so users have persistent accounts and families can share data across devices
# Audience: Gemini CTO Gem + AG @engineer.md (infrastructure only — no creator needed)
# Status: NOT STARTED
# ⚠️ PREREQUISITE: This must be built before Profile & Family Settings (FEATURE_profile_family_settings.md)

---

## WHAT WE ARE BUILDING

A complete authentication system using Supabase Auth. Users create an account
with email and password, sign in, and stay signed in across sessions. Their
profile, preferences, family group, weekly plans, and shopping lists are all
tied to their Supabase user ID — making every piece of data persistent and
cross-device.

This is the infrastructure layer that unlocks family sharing. Without it, two
devices (dad's phone and mum's phone) cannot access the same family plan.
Local storage is per-device — Supabase is per-account.

---

## SCOPE — WHAT IS AND IS NOT INCLUDED

### Included in this brief:
- Email + password sign up
- Email + password sign in
- Persistent session (stay logged in across app restarts)
- Sign out
- Password reset via email
- Protected routes — unauthenticated users redirected to auth screen
- Migration of existing local storage data to Supabase on first sign in
- Supabase Row Level Security (RLS) rules for all tables
- Auth context available throughout the app

### NOT included (future sprints):
- Google / Apple social sign in
- Magic link (passwordless) sign in
- Two-factor authentication
- Account deletion
- Email change flow

---

## WHY SUPABASE AUTH

The project already uses Supabase for the recipe database. Supabase Auth is
built into the same client — no additional service, no additional cost on the
free tier. It handles sessions, JWTs, refresh tokens, and email delivery for
password resets automatically.

Do not introduce a separate auth service (Firebase Auth, Auth0, Clerk).
Stay in the Supabase ecosystem.

---

## SUPABASE SETUP REQUIRED (CEO does this manually before AG builds)

Before invoking AG, the CEO must complete these steps in the Supabase dashboard:

### 1. Enable Email Auth
Supabase Dashboard → Authentication → Providers → Email → Enable

### 2. Configure Email Templates
Dashboard → Authentication → Email Templates
Update the password reset email subject to: "Reset your Meal Buddy password"
Update the body to be clean and minimal — remove Supabase branding.

### 3. Create the profiles table
Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- User profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Member',
  avatar_color TEXT NOT NULL DEFAULT '#c9a96e',
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  cooking_preferences JSONB NOT NULL DEFAULT '{
    "maxCookTimeMinutes": 45,
    "preferredDifficulty": "Any",
    "servingsDefault": 2
  }',
  dietary_preferences TEXT[] NOT NULL DEFAULT '{}',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Families table
CREATE TABLE public.families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name TEXT NOT NULL DEFAULT 'Our Family',
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Member'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 4. Enable Row Level Security on all tables

```sql
-- Profiles: users can only read/write their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Families: members can view their family, admin can update
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view family"
  ON public.families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family admin can update family"
  ON public.families FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Authenticated users can create family"
  ON public.families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Recipes: all authenticated users can read recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recipes"
  ON public.recipes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Weekly plans: scoped to user
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weekly plans"
  ON public.weekly_plans FOR ALL
  USING (user_id = auth.uid());

-- Shopping lists: scoped to family if family exists, else user
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own shopping lists"
  ON public.shopping_lists FOR ALL
  USING (user_id = auth.uid());
```

### 5. Add user_id column to relevant tables
Run for each table that needs user scoping:

```sql
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.shopping_lists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
-- Add to any other user-scoped tables as they are built
```

---

## AUTH FLOW — COMPLETE USER JOURNEYS

### First Time User — Sign Up
```
1. App opens → no session detected
2. Auth screen displays (full screen, no nav bar)
3. User taps "Create account"
4. Form: Display name, Email, Password, Confirm password
5. Submit → Supabase creates user + trigger creates profile row
6. Session established → user enters app
7. Onboarding: "Welcome to Meal Buddy. Set up your profile?" → Profile tab
```

### Returning User — Sign In
```
1. App opens → session detected from previous visit
2. App hydrates user data → straight to Home tab
   (no loading screen longer than 1.5 seconds)
3. If session expired → silent refresh attempt
4. If refresh fails → redirect to sign in screen
```

### Password Reset
```
1. Sign in screen → "Forgot password?" link
2. Email input screen
3. User submits email → Supabase sends reset email
4. Confirmation: "Check your email for a reset link"
5. User taps link in email → opens app (deep link) or web reset page
6. New password input → confirm → session established
```

### Sign Out
```
1. Profile tab → "Sign out" button (bottom of screen, ghost style)
2. Confirmation: "Are you sure?" (one-tap confirm, not a modal)
3. Supabase session cleared
4. Local state cleared
5. Redirect to auth screen
```

---

## AUTH SCREEN DESIGN

Full screen. No nav bar. No back button on sign in.
Zinc aesthetic throughout — this is the first thing users see.

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│   [App wordmark — Playfair Display      │
│    900, 36px, --zinc-50]                │
│   Meal Buddy                            │
│                                         │
│   [Playfair italic, 16px, --zinc-500]   │
│   Your culinary week, organised.        │
│                                         │
│                                         │
│   [Email input]                         │
│   [Password input]                      │
│                                         │
│   [Primary pill button — full width]    │
│   Sign in                               │
│                                         │
│   [Ghost — centered]                    │
│   Forgot password?                      │
│                                         │
│   ─────────────── or ───────────────   │
│                                         │
│   [Secondary pill button — full width]  │
│   Create an account                     │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

Sign up screen adds: Display name field above email, confirm password field below.
Both screens share identical layout — just different fields and button labels.

Input fields:
- Background: --zinc-800
- Border: 1px solid --zinc-700
- Focus border: --zinc-500
- Text: DM Sans 400, 14px, --zinc-200
- Placeholder: DM Sans 300, 14px, --zinc-500
- Border radius: --radius-sm
- Height: 52px (thumb-friendly)
- Label above field: DM Sans 600, 11px, uppercase, --zinc-500

Error states:
- Border turns --destructive on invalid field
- Error message below field: DM Sans 400, 12px, --destructive
- Never show raw Supabase error strings — map to friendly messages

Error message mapping:
```typescript
const mapAuthError = (error: string): string => {
  if (error.includes('Invalid login credentials')) return 'Wrong email or password. Try again.';
  if (error.includes('Email not confirmed')) return 'Check your email to confirm your account first.';
  if (error.includes('User already registered')) return 'An account with this email already exists.';
  if (error.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (error.includes('Unable to validate email')) return 'Please enter a valid email address.';
  return 'Something went wrong. Please try again.';
};
```

---

## SUPABASE CLIENT SETUP

```typescript
// lib/supabase.ts — update existing file
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,              // Keep user logged in across restarts
    autoRefreshToken: true,            // Silently refresh expired tokens
    detectSessionInUrl: true,          // Handle magic links and OAuth callbacks
  }
});
```

---

## AUTH CONTEXT

Global context available to all components. Build this first — everything else depends on it.

```typescript
// context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;              // true during initial session check
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mapAuthError(error.message) : null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    return { error: error ? mapAuthError(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear all local state on sign out
    localStorage.clear();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? mapAuthError(error.message) : null };
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isLoading,
      isAuthenticated: !!session,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## PROTECTED ROUTE WRAPPER

```typescript
// components/Auth/ProtectedRoute.tsx
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show nothing during initial session hydration
  // Keep this under 1.5s — do not show a loading spinner for auth checks
  if (isLoading) return (
    <div style={{
      background: '#09090b',
      height: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* No spinner — just dark screen during hydration */}
    </div>
  );

  if (!isAuthenticated) return <AuthScreen />;

  return <>{children}</>;
};
```

Wrap the entire app in AuthProvider and ProtectedRoute in main.tsx:

```typescript
// main.tsx
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  </React.StrictMode>
);
```

---

## LOCAL STORAGE MIGRATION

Existing users (you and your wife testing the app) have data in localStorage.
On first sign in, migrate this data to Supabase automatically.

```typescript
// lib/migrateLocalData.ts
export const migrateLocalDataToSupabase = async (userId: string) => {
  const migrations = [
    { key: 'mb_essential_categories', table: 'essential_categories' },
    { key: 'mb_essential_items', table: 'essential_items' },
    { key: 'mb_weekly_plan_active', table: 'weekly_plans' },
    { key: 'mb_shopping_list_active', table: 'shopping_lists' },
  ];

  for (const { key, table } of migrations) {
    const localData = localStorage.getItem(key);
    if (!localData) continue;

    try {
      const parsed = JSON.parse(localData);
      const dataWithUserId = Array.isArray(parsed)
        ? parsed.map(item => ({ ...item, user_id: userId }))
        : { ...parsed, user_id: userId };

      await supabase.from(table).upsert(dataWithUserId);
      localStorage.removeItem(key); // Clean up after successful migration
    } catch (e) {
      console.warn(`Migration failed for ${key}:`, e);
      // Do not throw — failed migration should not block sign in
    }
  }
};
```

Call this once after successful sign in, check a migration flag to ensure it
only runs once per user:

```typescript
const HAS_MIGRATED_KEY = 'mb_local_data_migrated';

const afterSignIn = async (userId: string) => {
  const hasMigrated = localStorage.getItem(HAS_MIGRATED_KEY);
  if (!hasMigrated) {
    await migrateLocalDataToSupabase(userId);
    localStorage.setItem(HAS_MIGRATED_KEY, 'true');
  }
};
```

---

## FILE STRUCTURE

```
/src/
  context/
    AuthContext.tsx              ← Auth context, provider, useAuth hook
  components/
    Auth/
      AuthScreen.tsx             ← Full screen sign in / sign up (tab switcher)
      SignInForm.tsx             ← Email + password form
      SignUpForm.tsx             ← Name + email + password + confirm form
      ForgotPasswordScreen.tsx   ← Email input for reset
      ResetPasswordScreen.tsx    ← New password input (after email link)
      ProtectedRoute.tsx         ← Route guard wrapper
  lib/
    supabase.ts                  ← Supabase client (update existing)
    migrateLocalData.ts          ← One-time migration helper
    authErrors.ts                ← mapAuthError() function
```

---

## ENVIRONMENT VARIABLES

Ensure these exist in `.env.local` — they should already be present:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

No new environment variables needed — Supabase Auth uses the same project.

---

## NETLIFY DEPLOYMENT

The password reset flow uses a redirect URL. Add to Netlify:
- Site settings → Environment variables → ensure VITE_ vars are present
- Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: your Netlify URL (e.g. https://thefoodi.netlify.app)
  - Redirect URLs: add https://thefoodi.netlify.app/reset-password

The existing `_redirects` file in `/public` handles SPA routing and will
catch the `/reset-password` route correctly — no changes needed there.

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| Session expired while app is open | onAuthStateChange fires → redirect to sign in |
| Network offline on sign in attempt | Show: "No connection. Please check your internet." |
| Supabase returns unknown error | mapAuthError() falls back to generic message — never show raw error |
| User signs up with existing email | Friendly message: "An account with this email already exists." |
| Password reset email not received | "Check your spam folder. Resend?" link after 60 seconds |
| User closes app mid sign-up | Form state lost — no partial account created (Supabase atomic) |
| Profile trigger fails silently | Check for existing profile on every sign in, create if missing |
| Local migration fails partially | Log warning, set migration flag anyway — do not retry endlessly |
| User signs out with no network | Clear local state regardless — do not block sign out on network |
| Token refresh fails | Redirect to sign in — do not leave user in broken authenticated state |

---

## ACCEPTANCE CRITERIA

- [ ] Sign up creates Supabase user and profile row automatically
- [ ] Sign in establishes persistent session
- [ ] App reopens without requiring sign in (session persists)
- [ ] Unauthenticated users see auth screen — cannot access app
- [ ] Authenticated users go straight to Home tab on open
- [ ] Password reset email sends successfully
- [ ] All auth error messages are friendly — no raw Supabase strings shown
- [ ] Sign out clears session and local state, redirects to auth screen
- [ ] Auth screen follows Zinc design system — dark, premium, no white backgrounds
- [ ] Local storage data migrates to Supabase on first sign in
- [ ] Migration runs only once per user
- [ ] RLS policies prevent users accessing other users' data
- [ ] App works correctly on Netlify with redirect URLs configured
- [ ] No white flash or loading spinner during session hydration
- [ ] Works on mobile Chrome and Safari

---

## AG INVOCATION

Single agent — @engineer.md only.
This is pure infrastructure. No UI creativity needed — follow the auth screen
design spec exactly. No deviations for aesthetics.

Remind AG:
- Stack is TypeScript + React + Vite + Supabase (NO Next.js)
- VITE_ prefix on all environment variables
- Mandatory optional chaining on all Supabase response data access
- All Supabase setup SQL runs in the dashboard BEFORE AG writes any code
- Do not use any third-party auth library — Supabase Auth client only
- Auth screen background must be --zinc-950 (#09090b) — never white
