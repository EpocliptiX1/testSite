# 🚀 Legion Space - Quick Start Guide

## Getting Started

### Starting the Server

1. Open terminal in the project directory
2. Navigate to Backend folder:
   ```bash
   cd Backend
   ```
3. Install dependencies (first time only):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
5. You should see:
   ```
   ✅ Connected to movies database
   🚀 Server is running at http://localhost:3000
   ```

### Opening the Website

1. Open your browser
2. Navigate to: `http://localhost:3000/html/indexMain.html`
3. Alternatively, use Live Server in VS Code

---

## 🌟 New Features Guide

### 1. Change Language

**Three ways to switch language:**

#### Method 1: Navbar (Recommended)
1. Look for the flag icon in top-right navigation (🇬🇧 EN)
2. Click to open dropdown
3. Select: English 🇬🇧 | Русский 🇷🇺 | Қазақша 🇰🇿

#### Method 2: Keyboard Shortcut
- Press `Shift + L` to cycle through languages

#### Method 3: Programmatically (Console)
```javascript
window.i18n.changeLanguage('ru'); // or 'en', 'kz'
```

**Your choice is automatically saved!**

---

### 2. Switch Theme (Light/Dark)

**Three ways to switch theme:**

#### Method 1: Navbar Button
1. Find the theme button in navbar (🌙 Dark or ☀️ Light)
2. Click to toggle between themes

#### Method 2: Keyboard Shortcut  
- Press `T` anywhere on the site

#### Method 3: Programmatically (Console)
```javascript
window.themeManager.toggleTheme();
```

**Theme Examples:**
- **Dark Mode**: Black background, orange accents (cinematic feel)
- **Light Mode**: White background, orange accents (clean & modern)

---

### 3. Continue Watching

**Automatically tracks your viewing progress!**

#### How It Works:
1. Watch any movie (even partially)
2. Return to homepage
3. See "Continue Watching" section with progress bars

#### Features:
- Progress bar shows how much you've watched
- Only shows movies between 5% and 95% complete
- Automatically hides when empty
- Click any movie to resume

#### Manual Tracking (for developers):
```javascript
WatchHistory.addEntry(
    movieId,      // Movie ID
    title,        // Movie title
    posterUrl,    // Poster image URL
    50,          // Progress percentage (0-100)
    'Action'     // Genre
);
```

---

### 4. Search Features

**Enhanced search with autocomplete and history**

#### Basic Search:
1. Click search box (or press `/`)
2. Start typing movie name
3. See instant results as you type
4. Click any result to view movie

#### Search History:
1. Click search box without typing
2. See your recent 10 searches
3. Click any to search again
4. Click "Clear" to remove all history

#### Advanced Features:
- **Debounced**: Waits 300ms before searching (faster!)
- **Highlighted Results**: Your search terms are highlighted
- **Rich Previews**: Shows poster, year, genre, rating
- **Keyboard Navigation**: Use arrow keys to navigate results

---

### 5. Keyboard Shortcuts

**Press `?` anywhere to see full list!**

#### Most Useful Shortcuts:

**Navigation:**
- `H` - Home page
- `M` - Movies page  
- `L` - My List
- `P` - Playlists

**Quick Actions:**
- `/` - Focus search bar
- `Esc` - Close any modal or unfocus search
- `T` - Toggle theme
- `Shift + L` - Next language

**Hero Slider:**
- `←` - Previous movie
- `→` - Next movie

**Account:**
- `A` - Open account menu
- `S` - Sign in
- `Shift + S` - Sign up
- `,` - Settings

**Other:**
- `R` - Refresh page
- `?` - Show shortcuts help

---

### 6. Account Features

**Your credentials are encrypted!**

#### Sign Up:
1. Click "Create Account" in navbar
2. Fill in username, email, password
3. Choose tier (Free/Premium/Gold)
4. Click "Create Account"

**Your password is encrypted before storage!**

#### Encrypted Storage:
- Email: Encrypted with XOR cipher + Base64
- Password: Encrypted with salt
- Auto-fill: Saved credentials auto-populate on sign-in

---

### 7. Smart Recommendations

**AI-powered movie suggestions based on your taste**

#### How It Works:
1. Watch movies (builds your preference profile)
2. System analyzes your favorite genres
3. Homepage shows personalized recommendations
4. Filters out movies you've already seen

#### View Your Preferences:
```javascript
// Open browser console (F12)
const prefs = SmartRecommendations.analyzePreferences();
console.log('Your top genres:', prefs.topGenres);
console.log('Average watch %:', prefs.averageWatchPercentage);
```

---

## 🎨 Customization

### For Users

**Change Theme Colors (Advanced):**
```javascript
// Open browser console (F12)
document.documentElement.style.setProperty('--accent-primary', '#ff0000'); // Red accents
```

**Clear All Data:**
```javascript
// Clear watch history
WatchHistory.clearHistory();

// Clear search history
EnhancedSearch.clearHistory();

// Clear credentials
CredentialManager.clearCredentials();

// Clear everything
localStorage.clear();
```

---

## 📱 Mobile Usage

### Touch Gestures:
- **Hero Slider**: Swipe left/right to change slides
- **Mobile Menu**: Tap hamburger icon (☰) to show/hide menu
- **Search**: Tap search to expand, tap outside to close

### Optimizations:
- Larger touch targets on mobile
- Responsive breakpoints at 1200px, 768px, 480px
- Optimized typography scaling
- Touch-friendly spacing

---

## 🔧 Troubleshooting

### Server Won't Start
```bash
# Rebuild SQLite module
cd Backend
npm rebuild sqlite3
node server.js
```

### Theme Not Working
1. Hard refresh: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear cache: Browser Settings → Clear cache
3. Check console for errors: `F12` → Console tab

### Translations Not Showing
1. Check browser console for errors
2. Verify i18n.js is loaded: `console.log(window.i18n)`
3. Force update: `window.i18n.updateTranslations()`

### Search Not Working
1. Ensure server is running on port 3000
2. Check browser console for errors
3. Try manual search: Navigate to `/html/searchQueryResult.html?q=test`

---

## 🎯 Pro Tips

1. **Fast Navigation**: Memorize keyboard shortcuts (press `?` to see all)
2. **Quick Theme Switch**: Just press `T`
3. **Search Faster**: Press `/` from anywhere
4. **Language Toggle**: `Shift + L` cycles through languages
5. **Close Modals**: Press `Esc` instead of clicking X
6. **View Stats**: Check account dropdown for usage stats

---

## 📚 Additional Resources

- **Full Features List**: See `FEATURES.md`
- **Code Documentation**: Inline comments in all JS files
- **API Documentation**: See `Backend/server.js` comments

---

## 🆘 Need Help?

### Check Console Logs
1. Press `F12` to open DevTools
2. Go to Console tab
3. Look for errors (red text)

### Debug Mode
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'true');

// View all loaded modules
console.log({
    i18n: window.i18n,
    theme: window.themeManager,
    crypto: window.crypto_utils,
    watchHistory: window.WatchHistory,
    search: window.EnhancedSearch
});
```

---

## 🎉 Enjoy Legion Space!

You now have access to:
- ✅ 3 languages (EN, RU, KZ)
- ✅ 2 themes (Dark & Light)
- ✅ Encrypted credentials
- ✅ Continue watching
- ✅ Smart recommendations
- ✅ 15+ keyboard shortcuts
- ✅ Enhanced search with history

**Have fun exploring movies! 🍿**
