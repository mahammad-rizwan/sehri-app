# Navigation Fixes Required

## File 1: mobile/app/(app)/_layout.tsx

### Change 1: Update NO_BACK set (Line 42)
**FROM:**
```typescript
const NO_BACK = new Set(['home', 'admin/dashboard', 'dua/index', 'dua/category/[id]', 'dua/bookmarks', 'quran/surah/index', 'donation', 'tracking', 'profile', 'feedback', 'poll-history']);
```

**TO:**
```typescript
const NO_BACK = new Set(['home', 'admin/dashboard', 'dua/index', 'dua/category/[id]', 'dua/bookmarks', 'quran/surah/index', 'donation', 'tracking', 'profile', 'feedback', 'admin/chat/index']);
```

**Why:** 
- Removed `'poll-history'` so Admin Poll History shows Dashboard button
- Added `'admin/chat/index'` so Chat List doesn't show duplicate Dashboard button

---

### Change 2: Update BackBtn function (Line 146-158)
**FROM:**
```typescript
function BackBtn({ target }: { target: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push(target as any)} style={styles.backBtn} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      <Text style={styles.backBtnText}>{target.includes('admin') ? 'Dashboard' : 'Home'}</Text>
    </TouchableOpacity>
  );
}
```

**TO:**
```typescript
function BackBtn({ target, name }: { target: string; name: string }) {
  const router = useRouter();
  
  // Special case: individual chat screens go back to "Groups" instead of "Dashboard"
  const isIndividualChat = name.startsWith('admin/chat/') && name !== 'admin/chat/index' && name !== 'admin/chat/create';
  const label = isIndividualChat ? 'Groups' : (target.includes('admin') ? 'Dashboard' : 'Home');
  const destination = isIndividualChat ? '/(app)/admin/chat/index' : target;
  
  return (
    <TouchableOpacity onPress={() => router.push(destination as any)} style={styles.backBtn} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      <Text style={styles.backBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}
```

**Why:** Individual chat pages now show "Groups" button that goes back to chat list

---

### Change 3: Update getHeaderOptions function (Line 160-168)
**FROM:**
```typescript
function getHeaderOptions(name: string, homeTarget: string) {
  if (NO_BACK.has(name)) return {};
  return {
    headerShown: true,
    headerTitle: name === 'quran/surah/index' ? 'Al-Quran' : '',
    headerStyle: { backgroundColor: COLORS.background },
    headerShadowVisible: false,
    headerLeft: () => <BackBtn target={homeTarget} />,
  };
}
```

**TO:**
```typescript
function getHeaderOptions(name: string, homeTarget: string) {
  if (NO_BACK.has(name)) return {};
  return {
    headerShown: true,
    headerTitle: name === 'quran/surah/index' ? 'Al-Quran' : '',
    headerStyle: { backgroundColor: COLORS.background },
    headerShadowVisible: false,
    headerLeft: () => <BackBtn target={homeTarget} name={name} />,
  };
}
```

**Why:** Pass the `name` prop to BackBtn so it knows which screen it's on

---

## Results After Changes:

✅ **Poll History (admin)** - Will show "Dashboard" button at top
✅ **Special Cases (User Management)** - Will show "Dashboard" button at top  
✅ **Chat List** - NO duplicate Dashboard button (removed from header)
✅ **Individual Chat** - Shows "Groups" button instead of "Dashboard"
✅ **Manage Admins** - Will show "Dashboard" button at top
✅ **Donation History** - Will show "Dashboard" button at top

All navigation will be consistent across the app!
