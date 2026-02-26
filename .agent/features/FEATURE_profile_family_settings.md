# FEATURE BRIEF: Profile & Family Settings
# Meal Buddy / The Foodies
# Purpose: Replace placeholder profile tab with a full individual + family management system
# Audience: Gemini CTO Gem + AG @engineer.md then @creator.md (sequential)
# Status: NOT STARTED — currently a placeholder screen

---

## WHAT WE ARE BUILDING

A Profile tab that handles two layers of identity:

**Layer 1 — Individual Profile**
Each user has their own name, avatar colour, cooking preferences, dietary
preferences, and food allergies/intolerances. This is personal data that
travels with the user.

**Layer 2 — Family Group**
Users belong to a family. The family has a name and a list of members.
Any adult in the family can manage the plan, the shopping list, and invite
other members. The family view surfaces all members' preferences and
allergies in one glance — so the planner can see conflicts before they
happen.

The goal: when you open the weekly planner, the app implicitly knows it is
cooking for "The Foodies Family" — 2 adults — and can flag if a planned
recipe conflicts with anyone's allergies or preferences.

---

## WHY THIS MATTERS

Right now the app is built for one anonymous user. Adding family context:
- Makes the servings calculation meaningful (cooking for 2 not default 2)
- Enables allergy and preference awareness in recipe filtering
- Creates the foundation for the AI Meal Negotiator feature (future)
- Makes the app feel personal and owned rather than generic

This is also the feature that makes the app shareable — your wife gets her
own profile, you link to the same family, and you both see the same plan.

---

## DATA MODEL

### UserProfile
Individual user data. One per person.

```typescript
interface UserProfile {
  id: string;                          // uuid
  familyId: string | null;             // FK → FamilyGroup.id — null until joined
  displayName: string;                 // e.g. "Dad", "Sarah", "Jens"
  avatarColor: string;                 // hex — chosen from a preset palette
  role: "admin" | "member";            // admin can manage family settings
  cookingPreferences: CookingPreferences;
  dietaryPreferences: DietaryPreference[];
  allergies: Allergy[];
  createdAt: string;
}

interface CookingPreferences {
  maxCookTimeMinutes: 20 | 30 | 45 | 60 | 99;  // 99 = no limit
  preferredDifficulty: "Easy" | "Any" | "Challenge me";
  servingsDefault: number;             // Default serving count for this user's meals
}

type DietaryPreference =
  | "High Protein"
  | "Low Carb"
  | "Vegetarian"
  | "Vegan"
  | "Pescatarian"
  | "Dairy Free"
  | "Gluten Free"
  | "Mediterranean"
  | "Keto"
  | "No Preference";

type Allergy =
  | "Nuts"
  | "Peanuts"
  | "Gluten"
  | "Dairy"
  | "Eggs"
  | "Soy"
  | "Shellfish"
  | "Fish"
  | "Sesame"
  | "Sulphites";
```

### FamilyGroup
The shared family entity. Multiple UserProfiles link to one FamilyGroup.

```typescript
interface FamilyGroup {
  id: string;                          // uuid
  familyName: string;                  // e.g. "The Foodies Family"
  inviteCode: string;                  // 6-character code for joining
  memberIds: string[];                 // UserProfile.id[]
  createdAt: string;
  createdBy: string;                   // UserProfile.id of creator
}
```

### Derived — Family Summary
Computed for display in the family card and used by planning features:

```typescript
interface FamilySummary {
  familyName: string;
  memberCount: number;
  totalServings: number;               // Sum of all members' servingsDefault
  allAllergies: Allergy[];             // Union of all members' allergies — deduplicated
  conflictingPreferences: string[];    // e.g. "Sarah: Vegan, Jens: High Protein"
}
```

### Storage Keys
```
"mb_user_profile"           // UserProfile (current user)
"mb_family_group"           // FamilyGroup (current family)
"mb_family_members"         // UserProfile[] (all members including current user)
```

Note: For cross-device sync between family members, migrate to Supabase.
Local storage works for single-device use but breaks family sharing.
Design the data model for Supabase from day one even if storage is local initially.

---

## SCREEN STRUCTURE

The Profile tab has three sections stacked vertically:

```
1. MY PROFILE         ← personal identity and preferences
2. MY FAMILY          ← family group with member cards
3. APP SETTINGS       ← lightweight utility settings
```

---

## SECTION 1 — MY PROFILE

### Header
```
[Avatar circle — 64px, avatarColor background, displayName initial centered]
[Jens]                    [Playfair Display 700, 24px, --zinc-50]
[Admin · The Foodies]     [DM Sans 300, 13px, --zinc-500]    [Edit pencil icon]
```

Avatar circle colours — preset palette of 8 options:
```
#c9a96e  (gold)
#6e9ec9  (steel blue)
#9ec96e  (sage)
#c96e9e  (rose)
#6ec9c9  (teal — only for avatars, not UI chrome)
#9e6ec9  (lavender)
#c9836e  (terracotta)
#6e6ec9  (indigo)
```

Tapping Edit opens an inline edit state — name field and colour picker row.
Save on tap outside or explicit Save button.

---

### Cooking Preferences Card
```
COOKING PREFERENCES              [eyebrow]
┌────────────────────────────────────┐
│  Max cook time                     │
│  [20m] [30m] [45m] [60m] [Any]    │  ← segmented selector
│                                    │
│  Difficulty                        │
│  [Easy] [Any] [Challenge me]       │  ← segmented selector
│                                    │
│  Default servings                  │
│  [−]  2  [+]                       │  ← stepper
└────────────────────────────────────┘
```

Segmented selector style:
- Container: --zinc-800 background, --radius-sm, full width
- Inactive segment: transparent, DM Sans 400, --zinc-400
- Active segment: --zinc-700 background, DM Sans 500, --zinc-200
- Transitions: background color only, transition-fast

Stepper style:
- Minus/Plus: Lucide icons, 20px, --zinc-400
- Count: Playfair Display 700, 22px, --zinc-50, centered
- Min: 1, Max: 10

---

### Dietary Preferences Card
```
DIETARY PREFERENCES              [eyebrow]
[High Protein] [Low Carb] [Vegetarian]
[Vegan] [Pescatarian] [Dairy Free]
[Gluten Free] [Mediterranean] [Keto]
[No Preference]
```

Multi-select pill grid. User can select multiple.
"No Preference" deselects all others when tapped.
Selecting any specific preference deselects "No Preference".

**Pill — unselected:**
- Background: --zinc-800
- Border: 1px solid --zinc-700
- Text: DM Sans 400, 12px, --zinc-400
- Border-radius: --radius-pill

**Pill — selected:**
- Background: --gold-bg
- Border: 1px solid --gold-border
- Text: DM Sans 500, 12px, --gold

---

### Allergies Card
```
ALLERGIES & INTOLERANCES         [eyebrow]
[Nuts] [Peanuts] [Gluten] [Dairy]
[Eggs] [Soy] [Shellfish] [Fish]
[Sesame] [Sulphites]
```

Same multi-select pill pattern as dietary preferences.
Selected allergy pills use --destructive tint instead of gold:
- Background: rgba(239,68,68,0.08)
- Border: rgba(239,68,68,0.25)
- Text: --destructive (#ef4444)

This visual distinction matters — allergies are safety-critical,
dietary preferences are optional. They must not look the same.

---

## SECTION 2 — MY FAMILY

### No Family State
If user has not created or joined a family:

```
[Playfair Display italic, 18px, --zinc-500, centered]
"You're cooking solo."

[DM Sans 300, 13px, --zinc-600, centered]
"Create a family to share planning
with the people you cook for."

[Primary pill button]     "Create a Family"
[Ghost button]            "Join with a code"
```

### Create Family Flow
Bottom sheet with:
- Family name input: e.g. "The Foodies Family"
- Confirm button: "Create Family"

On confirm:
- Generate FamilyGroup with random 6-character invite code
- Set current user as admin
- Update UserProfile.familyId

### Join Family Flow
Bottom sheet with:
- 6-character code input (large, mono font, single field)
- Confirm button: "Join Family"

On confirm:
- Find FamilyGroup by inviteCode
- Add current user to memberIds
- Update UserProfile.familyId

### Family Card — Has Family

```
THE FOODIES FAMILY               [eyebrow — gold]
┌────────────────────────────────────────┐
│                                        │
│  [Jens avatar] [Sarah avatar]          │
│  Jens          Sarah                   │
│  Admin         Member                  │
│                                        │
│  🚨 Nuts · Dairy (Sarah)              │  ← allergy summary
│  🥩 High Protein (Jens)              │  ← dietary summary
│  ⏱ 30 min max · 2 servings           │  ← cooking prefs summary
│                                        │
│  Invite code: ABC123  [Copy]           │
└────────────────────────────────────────┘
```

**Member cards (horizontal row if 2-4 members, wrap if more):**
Each member gets a small card:
```
[Avatar 40px circle]
[Display Name — DM Sans 500, 12px, --zinc-200]
[Role — DM Sans 300, 10px, --zinc-500]
[Tap to see their preferences]
```

Tapping a member card opens a read-only bottom sheet of their:
- Dietary preferences
- Allergies
- Cooking preferences

Only the member themselves can edit their own profile.
Admin can remove members (except themselves).

**Allergy Summary Row:**
Shows a deduplicated union of ALL family members' allergies.
Uses 🚨 emoji prefix — this is safety info, slightly more prominent.
Format: "🚨 Nuts, Dairy, Shellfish (across family)"

**Dietary Summary:**
Shows a digest of preferences per member where they differ.
If all members share a preference, show once without attribution.
If preferences conflict, show with member names.

**Invite Code:**
6-character code in DM Mono, displayed clearly.
Copy button copies the code to clipboard.
Regenerate option (admin only) behind a "..." menu.

---

## SECTION 3 — APP SETTINGS

Lightweight settings — do not over-engineer this section.

```
APP SETTINGS                     [eyebrow]

Notifications                    [toggle — off by default]
Default shopping mode            [Active / Standard toggle]
Week starts on                   [Monday / Sunday selector]
```

Each row: DM Sans 400, 14px, --zinc-200 label, right-aligned control.
Row dividers: 1px --zinc-800.
No nested navigation — everything inline.

---

## DESIGN SYSTEM RULES

Reference DESIGN_SYSTEM.md for all values. Key rules for this screen:

- Background: --zinc-950
- Section cards: --zinc-900 background, --zinc-700 border, --radius-lg
- Eyebrow labels: DM Sans 600, 10px, uppercase, --gold
- Dietary pills selected: --gold accent
- Allergy pills selected: --destructive accent (not gold — safety distinction)
- Avatar circles: solid color background, white initial letter centered
- Segmented selectors: --zinc-800 track, --zinc-700 active segment
- All transitions: transform and opacity only
- Touch targets: 44px minimum height on all rows and controls

---

## FILE STRUCTURE

```
/src/
  views/
    ProfileView.tsx               ← Main profile tab — replaces placeholder
  components/
    Profile/
      ProfileHeader.tsx           ← Avatar, name, edit state
      CookingPreferencesCard.tsx  ← Max time, difficulty, servings
      DietaryPreferencesCard.tsx  ← Multi-select pill grid
      AllergiesCard.tsx           ← Multi-select pill grid (destructive tint)
      FamilyCard.tsx              ← Family section container
      FamilyMemberCard.tsx        ← Individual member display
      FamilyMemberSheet.tsx       ← Read-only member preference view
      CreateFamilySheet.tsx       ← Create family bottom sheet
      JoinFamilySheet.tsx         ← Join with code bottom sheet
      NoFamilyState.tsx           ← Solo cooking empty state
      AppSettingsCard.tsx         ← Lightweight settings section
  hooks/
    useProfile.ts                 ← Individual profile CRUD
    useFamily.ts                  ← Family group management
  lib/
    familyUtils.ts                ← FamilySummary derivation logic
```

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| User has no family | Show NoFamilyState with create/join options |
| Invalid invite code | "That code doesn't exist. Check with your family." — no technical error |
| User tries to leave family (only member) | Dissolve family — confirm first |
| User tries to leave family (not only member) | Promote another member to admin first if user is admin |
| Family has 1 member | Show solo member card, invite CTA prominently |
| Family has 5+ members | Member cards wrap to second row gracefully |
| Allergy and dietary preference conflict in family | Show in family summary — do not block planning |
| displayName empty | Default to "Family Member" |
| Avatar colour not set | Default to --gold (#c9a96e) |
| Max cook time set to 20 min across family | Planning HQ should eventually use this to filter — flag for future sprint |

---

## ACCEPTANCE CRITERIA

- [ ] Profile tab replaces placeholder with real content
- [ ] Display name editable inline
- [ ] Avatar colour selectable from preset palette
- [ ] Max cook time segmented selector works and saves
- [ ] Difficulty segmented selector works and saves
- [ ] Default servings stepper works, min 1 max 10
- [ ] Dietary preferences multi-select saves correctly
- [ ] "No Preference" deselects all others
- [ ] Allergy pills use destructive tint — visually distinct from dietary pills
- [ ] No family state shows correctly on first launch
- [ ] Create family flow generates invite code and saves family
- [ ] Join family flow finds family by code and adds user
- [ ] Family card shows all members with avatars and names
- [ ] Allergy and dietary summary visible on family card
- [ ] Tapping member card opens read-only preference sheet
- [ ] Invite code displays and copies to clipboard correctly
- [ ] App settings section renders and saves
- [ ] All data persists across app restarts
- [ ] All touch targets minimum 44px
- [ ] Zero teal in UI chrome — gold for preferences, destructive for allergies
- [ ] Works on mobile Chrome and Safari

---

## AG INVOCATION ORDER

### Step 1 — @engineer.md
Build all data models, hooks (useProfile, useFamily), storage layer,
and familyUtils.ts derivation logic. No UI. Confirm data reads and writes
correctly before creator starts.

### Step 2 — @creator.md
Build all UI components using the hooks from Step 1.
Full Zinc design system throughout.
Reference DESIGN_SYSTEM.md for all values — do not hardcode.
