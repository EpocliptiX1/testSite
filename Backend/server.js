const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
const YT_API_KEY = 'AIzaSyB6Gco_FfC6l4AH5xLnEU2To8jaUwH2fqak';
const YOUTUBE_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const BCRYPT_SALT_ROUNDS = 10;
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || '';
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || '';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

// --- 1. MIDDLEWARE ---
app.use(cors());
app.use(express.json()); // Essential for POST requests (Reviews & My List)

// Rate limiting configurations
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs for sensitive operations
    message: { error: 'Too many requests from this IP, please try again later.' }
});

// Apply rate limiting to all routes
app.use(generalLimiter);

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// DEBUG: Log all incoming requests (method, path, query)
app.use((req, res, next) => {
    console.log('REQ:', req.method, req.path, req.query);
    next();
});

function signUserToken(user) {
    return jwt.sign(
        {
            userUID: user.userUID,
            userEmail: user.userEmail,
            username: user.username,
            userTier: user.userTier
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// --- 1.5 TRANSLATION PROXY ---
app.post('/translate', async (req, res) => {
    try {
        const { text, target_lang, source_lang } = req.body || {};
        const texts = Array.isArray(text) ? text : [text];
        const filtered = texts.filter(t => typeof t === 'string' && t.trim().length > 0);

        if (filtered.length === 0 || !target_lang) {
            return res.status(400).json({ error: 'text and target_lang required' });
        }

        const target = String(target_lang).toUpperCase();
        const source = source_lang && String(source_lang).toUpperCase() !== 'AUTO'
            ? String(source_lang).toUpperCase()
            : undefined;

        if (LIBRETRANSLATE_URL) {
            const requestConfig = {
                headers: { 'Content-Type': 'application/json' }
            };

            const translateOne = async (inputText) => {
                try {
                    const response = await axios.post(
                        LIBRETRANSLATE_URL,
                        {
                            q: inputText,
                            source: source ? source.toLowerCase() : 'auto',
                            target: target.toLowerCase(),
                            format: 'text',
                            api_key: LIBRETRANSLATE_API_KEY || undefined
                        },
                        requestConfig
                    );

                    if (response.data?.translatedText) {
                        return response.data.translatedText;
                    }

                    if (Array.isArray(response.data?.translations) && response.data.translations[0]) {
                        const candidate = response.data.translations[0].text || response.data.translations[0].translatedText;
                        return candidate || inputText;
                    }

                    return inputText;
                } catch (err) {
                    const detail = err.response?.data || err.message;
                    console.warn('LibreTranslate item error:', detail);
                    return inputText;
                }
            };

            const translatedTexts = await Promise.all(filtered.map(translateOne));
            return res.json({ translations: translatedTexts.map(text => ({ text })) });
        }

        if (GOOGLE_TRANSLATE_API_KEY) {
            const response = await axios.post(
                'https://translation.googleapis.com/language/translate/v2',
                {
                    q: filtered,
                    target: target.toLowerCase(),
                    source: source ? source.toLowerCase() : undefined,
                    format: 'text',
                    key: GOOGLE_TRANSLATE_API_KEY
                }
            );

            const translations = (response.data?.data?.translations || []).map(t => ({
                text: t.translatedText
            }));

            return res.json({ translations });
        }

        return res.status(400).json({ error: 'No translation provider configured' });
    } catch (error) {
        const detail = error.response?.data || error.message;
        console.error('Translation Proxy Error:', detail);
        res.status(500).json({ error: 'Translation failed', detail });
    }
});


// --- 2. DATABASE SETUP ---
// Connect to the SQLite database
const dbPath = path.join(__dirname, '..', 'datasets', 'movies.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("✅ Connected to movies database");
});

// --- 3. REVIEWS FILE SETUP ---
// This ensures the /backend/ folder and reviews.json exist before we try to use them
const reviewsDir = path.join(__dirname, 'backend');
const reviewsPath = path.join(reviewsDir, 'reviews.json');
const usersPath = path.join(reviewsDir, 'users.json');

// Create folder if it doesn't exist
if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir);
}
// Create file if it doesn't exist
if (!fs.existsSync(reviewsPath)) {
    fs.writeFileSync(reviewsPath, JSON.stringify([])); // Start with an empty list []
}
// Create users file if it doesn't exist
if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify([]));
}

// --- 3.5 FORUM FILES SETUP ---
const forumMoviesPath = path.join(reviewsDir, 'forum_movies.json');
const forumThreadsPath = path.join(reviewsDir, 'forum_threads.json');

if (!fs.existsSync(forumMoviesPath)) {
    fs.writeFileSync(forumMoviesPath, JSON.stringify([]));
}
if (!fs.existsSync(forumThreadsPath)) {
    fs.writeFileSync(forumThreadsPath, JSON.stringify([]));
}

// =========================================
//  4. MOVIE READ ROUTES
// =========================================

// A. Search by Name (with click count sorting)
app.get('/search', (req, res) => {
    const query = req.query.q;
    const sql = `
        SELECT m.*, COALESCE(c.click_count, 0) as clicks 
        FROM movies m 
        LEFT JOIN movie_clicks c ON m.ID = c.movie_id 
        WHERE "Movie Name" LIKE ? 
        ORDER BY clicks DESC, Rating DESC 
        LIMIT 10
    `;
    db.all(sql, [`%${query}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// B. Get Single Movie by ID (with click tracking)
app.get('/movie/:id', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT m.*, COALESCE(c.click_count, 0) as clicks 
        FROM movies m 
        LEFT JOIN movie_clicks c ON m.ID = c.movie_id 
        WHERE m.ID = ?
    `;
    db.get(sql, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Movie not found" });
        res.json(row);
    });
});

// C. Track Movie Click
app.post('/movie/:id/click', (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid movie ID" });
    
    db.run(
        'INSERT INTO movie_clicks (movie_id, click_count) VALUES (?, 1) ON CONFLICT(movie_id) DO UPDATE SET click_count = click_count + 1',
        [id],
        function(err) {
            if (err) {
                console.error('Error tracking click:', err);
                return res.status(500).json({ error: "Could not track click" });
            }
            res.json({ success: true, clicks: this.changes });
        }
    );
});

// D. The "Super" Library Filter (Kept the complex version)
app.get('/movies/library', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Extract Filters from URL
    const sortMode = req.query.sort || 'rating_desc';
    const minYear = parseInt(req.query.year) || 1900;
    const genre = req.query.genre || '';
    const actor = req.query.actor || '';
    const director = req.query.director || '';

    // Start building the query - join with click tracking
    let sql = `SELECT m.*, COALESCE(c.click_count, 0) as clicks FROM movies m LEFT JOIN movie_clicks c ON m.ID = c.movie_id WHERE 1=1`;
    let params = [];

    // 1. Filter by Year (Released after X)
    sql += ` AND CAST(SUBSTR(m.release_date, -4) AS INTEGER) >= ?`;
    params.push(minYear);

    // 2. Filter by Genre
    if (genre) {
        sql += ` AND m.Genre LIKE ?`;
        params.push(`%${genre}%`);
    }

    // 3. Filter by Actor
    if (actor) {
        sql += ` AND m.Stars LIKE ?`;
        params.push(`%${actor}%`);
    }

    // 4. Filter by Director
    if (director) {
        sql += ` AND m.Directors LIKE ?`;
        params.push(`%${director}%`);
    }

    // 5. Apply Sorting
    let orderBy = `CAST(m.Rating AS FLOAT) DESC`; // Default

    if (sortMode === 'date_desc') {
        orderBy = `CAST(SUBSTR(m.release_date, -4) AS INTEGER) DESC`;
    } 
    else if (sortMode === 'duration_desc') {
        orderBy = `CAST(REPLACE(m.Runtime, ' min', '') AS INTEGER) DESC`;
    } 
    else if (sortMode === 'success_desc') {
        orderBy = `((CAST(m.revenue AS FLOAT) - CAST(m.budget AS FLOAT)) / NULLIF(CAST(m.budget AS FLOAT), 0)) DESC`;
    } 
    else if (sortMode === 'success_asc') {
        orderBy = `((CAST(m.revenue AS FLOAT) - CAST(m.budget AS FLOAT)) / NULLIF(CAST(m.budget AS FLOAT), 0)) ASC`;
    }
    else if (sortMode === 'clicks_desc') {
        orderBy = `clicks DESC`;
    }

    // Combine everything
    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows || []);
    });
});

// =========================================
//  5. RECOMMENDATION ROUTES
// =========================================

app.get('/recommend/genre', (req, res) => {
    const { genre, exclude } = req.query;
    if (!genre) return res.json([]);
    const firstGenre = genre.split(',')[0].trim(); 
    // Smart Score Calculation
    const sql = `
        SELECT *, 
        ((CAST(revenue AS FLOAT)/CASE WHEN CAST(budget AS FLOAT)=0 THEN 1 ELSE CAST(budget AS FLOAT) END)*0.4 + (CAST(Votes AS FLOAT)/100000)*0.6)*Rating as smart_score
        FROM movies 
        WHERE Genre LIKE ? AND ID != ? 
        ORDER BY smart_score DESC LIMIT 20`;
    db.all(sql, [`%${firstGenre}%`, exclude], (err, rows) => res.json(rows || []));
});

app.get('/recommend/actors', (req, res) => {
    const { val, exclude } = req.query;
    const sql = `SELECT * FROM movies WHERE Stars LIKE ? AND ID != ? ORDER BY (CAST(Votes AS INTEGER) * Rating) DESC LIMIT 20`;
    db.all(sql, [`%${val}%`, exclude], (err, rows) => res.json(rows || []));
});

app.get('/recommend/director', (req, res) => {
    const { val, exclude } = req.query;
    const sql = `SELECT * FROM movies WHERE Directors LIKE ? AND ID != ? ORDER BY (CAST(Votes AS INTEGER) * Rating) DESC LIMIT 20`;
    db.all(sql, [`%${val}%`, exclude], (err, rows) => res.json(rows || []));
});

app.get('/recommend/timeline', (req, res) => {
    const targetYear = parseInt(req.query.year);
    const exclude = req.query.exclude;
    if (!targetYear) return res.json([]);

    const sql = `
        SELECT * FROM movies 
        WHERE CAST(SUBSTR(release_date, -4) AS INTEGER) BETWEEN ? AND ?
        AND ID != ? 
        ORDER BY (CAST(Votes AS INTEGER) * Rating) DESC 
        LIMIT 20
    `;
    db.all(sql, [targetYear - 5, targetYear + 5, exclude], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows || []);
    });
});

// =========================================
//  6. "MY LIST" ROUTE
// =========================================
app.post('/movies/get-list', (req, res) => {
    const ids = req.body.ids; 
    if (!ids || ids.length === 0) return res.json([]);

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM movies WHERE ID IN (${placeholders})`;
    
    db.all(sql, ids, (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows || []);
    });
});

// =========================================
//  7. YOUTUBE TRAILER SEARCH (API) with Caching
// =========================================
app.get('/youtube/search', async (req, res) => {
    const movieName = req.query.name;
    if (!movieName) return res.status(400).json({ error: "Movie name required" });
    
    try {
        const normalizedName = movieName.toLowerCase().trim();
        const now = Date.now();
        
        // Check cache first
        const cached = await new Promise((resolve, reject) => {
            db.get(
                'SELECT video_id, cached_at FROM youtube_cache WHERE movie_name = ?',
                [normalizedName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        // If cache exists and not expired, return it
        if (cached && (now - cached.cached_at) < YOUTUBE_CACHE_EXPIRY_MS) {
            console.log(`[YouTube] Cache hit: ${movieName} -> ${cached.video_id}`);
            return res.json({ videoId: cached.video_id, cached: true });
        }
        
        // Cache miss or expired, fetch from API
        const query = encodeURIComponent(movieName + " official trailer");
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&maxResults=1&type=video&key=${YT_API_KEY}`;
        console.log(`[YouTube] Searching: ${movieName}`);
        const response = await fetch(url);
        const data = await response.json();
        
        // Log full response for debugging
        if (!response.ok || data.error) {
            console.error(`[YouTube] API Error:`, data);
            return res.status(response.status || 500).json({ error: data.error || "YouTube API error" });
        }
        
        const videoId = data.items?.[0]?.id?.videoId || "";
        console.log(`[YouTube] Found video: ${videoId || "None"}`);
        
        // Save to cache
        if (videoId) {
            db.run(
                'INSERT OR REPLACE INTO youtube_cache (movie_name, video_id, cached_at) VALUES (?, ?, ?)',
                [normalizedName, videoId, now],
                (err) => {
                    if (err) console.error('[YouTube] Cache save error:', err);
                    else console.log(`[YouTube] Cached: ${movieName} -> ${videoId}`);
                }
            );
        }
        
        res.json({ videoId, cached: false });
    } catch (err) {
        console.error("[YouTube] Network error:", err);
        res.status(500).json({ error: "Could not fetch trailer" });
    }
});

// =========================================
//  8. REVIEW ROUTES (JSON File)
// =========================================

// Get all reviews (optionally filter by movieId via ?movieId=123)
app.get('/reviews', (req, res) => {
    try {
        console.log('GET /reviews query:', req.query);
        const data = fs.readFileSync(reviewsPath, 'utf8');
        let reviews = JSON.parse(data) || [];
        const movieId = req.query.movieId;
        console.log('Filtering by movieId:', movieId);
        if (movieId) {
            reviews = reviews.filter(r => r.movieId && String(r.movieId) === String(movieId));
        }
        res.json(reviews);
    } catch (err) {
        console.error("Error reading reviews:", err);
        res.status(500).json({ error: "Could not read reviews" });
    }
});

// Post a new review

// Post a new review
app.post('/reviews', (req, res) => {
    try {
        // 1. Read existing
        const data = fs.readFileSync(reviewsPath, 'utf8');
        const reviews = JSON.parse(data);

        // Normalize incoming payload and ensure fields
        const newReview = {
            user: req.body.user || 'Guest',
            pfp: req.body.pfp || null,
            movieTitle: req.body.movieTitle || req.body.movie || null,
            movieId: req.body.movieId || null,
            stars: parseInt(req.body.stars, 10) || 0,
            text: req.body.text || '',
            createdAt: new Date().toISOString()
        };
        
        // 2. Add new review to the top
        reviews.unshift(newReview); 
        
        // 3. Write back
        fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2));
        res.status(200).json({ message: "Review saved!" });
    } catch (err) {
        console.error("Error saving review:", err);
        res.status(500).json({ error: "Could not save review" });
    }
});

// =========================================
//  8. PLAYLISTS FILE SETUP
// =========================================
// Playlists file will live alongside reviews
const playlistsPath = path.join(reviewsDir, 'playlists.json');
if (!fs.existsSync(playlistsPath)) {
    fs.writeFileSync(playlistsPath, JSON.stringify([]));
}

// =========================================
//  8.5 USERS FILE SETUP & ROUTES
// =========================================

// Save or update user record
app.post('/users', requireAuth, async (req, res) => {
    try {
        const data = fs.readFileSync(usersPath, 'utf8');
        const users = JSON.parse(data) || [];
        const {
            username,
            userUID,
            userEmail,
            userTier,
            userLanguage,
            searchCount,
            viewCount,
            allUIDs
        } = req.body || {};

        const uidNum = parseInt(req.user.userUID, 10);
        if (!uidNum) return res.status(401).json({ error: 'Invalid token user' });

        if (userUID !== undefined && parseInt(userUID, 10) !== uidNum) {
            return res.status(403).json({ error: 'Cannot update another user' });
        }

        const idx = users.findIndex(u => parseInt(u.userUID, 10) === uidNum);
        if (idx === -1) return res.status(404).json({ error: 'User not found' });
        
        const userRecord = {
            username: username || users[idx].username,
            userUID: uidNum,
            userEmail: userEmail || users[idx].userEmail || '',
            userTier: userTier || users[idx].userTier || 'Free',
            userLanguage: userLanguage || users[idx].userLanguage || 'en',
            searchCount: parseInt(searchCount, 10) || 0,
            viewCount: parseInt(viewCount, 10) || 0,
            allUIDs: Array.isArray(allUIDs) ? allUIDs : users[idx].allUIDs || []
        };

        users[idx] = { ...users[idx], ...userRecord };

        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        res.json(userRecord);
    } catch (err) {
        console.error('Error saving user:', err);
        res.status(500).json({ error: 'Could not save user' });
    }
});

// Register new user (assign unique UID, prevent email duplicates)
app.post('/users/register', strictLimiter, async (req, res) => {
    try {
        const data = fs.readFileSync(usersPath, 'utf8');
        const users = JSON.parse(data) || [];
        const {
            username,
            userEmail,
            userTier,
            userPassword,
            userLanguage
        } = req.body || {};

        if (!username || !userEmail || !userPassword) {
            return res.status(400).json({ error: 'username, email, and password required' });
        }

        const existing = users.find(u => String(u.userEmail).toLowerCase() === String(userEmail).toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const maxUID = users.reduce((max, u) => Math.max(max, parseInt(u.userUID, 10) || 0), 0);
        const newUID = maxUID + 1;

        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(userPassword, BCRYPT_SALT_ROUNDS);

        const userRecord = {
            username,
            userUID: newUID,
            userEmail,
            userTier: userTier || 'Free',
            userLanguage: userLanguage || 'en',
            searchCount: 0,
            viewCount: 0,
            allUIDs: users.map(u => parseInt(u.userUID, 10)).filter(n => !Number.isNaN(n)).concat(newUID),
            userPassword: hashedPassword
        };

        users.push(userRecord);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        const { userPassword: _userPassword, ...safeUser } = userRecord;
        const token = signUserToken(safeUser);
        res.json({ token, user: safeUser });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: 'Could not register user' });
    }
});

// Authenticate user by email + password
app.post('/users/auth', strictLimiter, async (req, res) => {
    try {
        const { userEmail, userPassword } = req.body || {};
        if (!userEmail || !userPassword) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const data = fs.readFileSync(usersPath, 'utf8');
        const users = JSON.parse(data) || [];
        const user = users.find(u =>
            String(u.userEmail).toLowerCase() === String(userEmail).toLowerCase()
        );

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Compare password with bcrypt
        const passwordMatch = await bcrypt.compare(userPassword, user.userPassword);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const { userPassword: _userPassword, ...safeUser } = user;
        const token = signUserToken(safeUser);
        res.json({ token, user: safeUser });
    } catch (err) {
        console.error('Error authenticating user:', err);
        res.status(500).json({ error: 'Could not authenticate user' });
    }
});

// =========================================
//  9. PLAYLIST ROUTES
// =========================================

// Get all playlists (optional ?owner=username)
app.get('/playlists', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        let playlists = JSON.parse(data) || [];
        const owner = req.query.owner;
        if (owner) playlists = playlists.filter(p => p.owner && String(p.owner) === String(owner));
        res.json(playlists);
    } catch (err) {
        console.error('Error reading playlists:', err);
        res.status(500).json({ error: 'Could not read playlists' });
    }
});

// Get single playlist
app.get('/playlists/:id', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const pl = playlists.find(p => String(p.id) === String(req.params.id));
        if (!pl) return res.status(404).json({ error: 'Playlist not found' });
        res.json(pl);
    } catch (err) {
        console.error('Error reading playlist:', err);
        res.status(500).json({ error: 'Could not read playlist' });
    }
});

// Create playlist
app.post('/playlists', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const { name, desc, owner, ownerUID } = req.body;
        if (!name) return res.status(400).json({ error: 'Playlist name required' });
        if (!ownerUID || parseInt(ownerUID, 10) === 0) {
            return res.status(403).json({ error: 'Sign in to create playlists' });
        }
        const newPl = { 
            id: String(Date.now()), 
            name, 
            desc: desc || '',
            owner: owner || 'Guest', 
            ownerUID: (ownerUID !== undefined) ? ownerUID : 0,
            score: 0,
            voters: {},
            comments: [],
            movies: [], 
            createdAt: new Date().toISOString() 
        };
        playlists.unshift(newPl);
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json(newPl);
    } catch (err) {
        console.error('Error creating playlist:', err);
        res.status(500).json({ error: 'Could not create playlist' });
    }
});

// Rename / update playlist metadata
app.put('/playlists/:id', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
        playlists[idx].name = req.body.name || playlists[idx].name;
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json(playlists[idx]);
    } catch (err) {
        console.error('Error updating playlist:', err);
        res.status(500).json({ error: 'Could not update playlist' });
    }
});

// Delete playlist
app.delete('/playlists/:id', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        let playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
        
        // Check ownership via ownerUID
        const playlist = playlists[idx];
        const userUID = (req.body.userUID !== undefined) ? req.body.userUID : 0;
        if (parseInt(userUID) !== parseInt(playlist.ownerUID)) {
            return res.status(403).json({ error: 'You do not own this playlist' });
        }
        
        playlists.splice(idx, 1);
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ message: 'Playlist deleted' });
    } catch (err) {
        console.error('Error deleting playlist:', err);
        res.status(500).json({ error: 'Could not delete playlist' });
    }
});

// Vote on playlist (one vote per user)
app.post('/playlists/:id/vote', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

        const { userUID, vote } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) {
            return res.status(403).json({ error: 'Sign in to vote' });
        }
        if (vote !== 'up' && vote !== 'down') {
            return res.status(400).json({ error: 'Invalid vote' });
        }

        const playlist = playlists[idx];
        if (!playlist.voters) playlist.voters = {};
        if (playlist.score === undefined || playlist.score === null) playlist.score = 0;

        const prevVote = playlist.voters[String(uid)] || null;
        if (prevVote === vote) {
            return res.status(409).json({ error: 'Already voted' });
        }

        // If switching vote, adjust counts
        if (prevVote === 'up') playlist.score -= 1;
        if (prevVote === 'down') playlist.score += 1;

        playlist.voters[String(uid)] = vote;
        if (vote === 'up') playlist.score += 1;
        if (vote === 'down') playlist.score -= 1;

        playlists[idx] = playlist;
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ score: playlist.score });
    } catch (err) {
        console.error('Error voting on playlist:', err);
        res.status(500).json({ error: 'Could not vote' });
    }
});

// Add comment to playlist
app.post('/playlists/:id/comments', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

        const { userUID, username, text } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to comment' });
        if (!text || !String(text).trim()) return res.status(400).json({ error: 'Comment text required' });

        const playlist = playlists[idx];
        if (!playlist.comments) playlist.comments = [];
        const newComment = {
            id: String(Date.now()),
            userUID: uid,
            username: username || 'User',
            text: String(text).trim(),
            createdAt: new Date().toISOString(),
            upvotes: 0,
            voters: {}
        };
        playlist.comments.unshift(newComment);
        playlists[idx] = playlist;
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json(newComment);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: 'Could not add comment' });
    }
});

// Upvote comment (one per user)
app.post('/playlists/:id/comments/:commentId/vote', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

        const { userUID } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to vote' });

        const playlist = playlists[idx];
        const comments = playlist.comments || [];
        const cIdx = comments.findIndex(c => String(c.id) === String(req.params.commentId));
        if (cIdx === -1) return res.status(404).json({ error: 'Comment not found' });

        const comment = comments[cIdx];
        if (!comment.voters) comment.voters = {};
        if (comment.upvotes === undefined || comment.upvotes === null) comment.upvotes = 0;

        if (comment.voters[String(uid)]) {
            return res.status(409).json({ error: 'Already voted' });
        }

        comment.voters[String(uid)] = true;
        comment.upvotes += 1;
        comments[cIdx] = comment;
        playlist.comments = comments;
        playlists[idx] = playlist;
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ upvotes: comment.upvotes });
    } catch (err) {
        console.error('Error voting on comment:', err);
        res.status(500).json({ error: 'Could not vote' });
    }
});

// Delete comment (owner only)
app.delete('/playlists/:id/comments/:commentId', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

        const { userUID } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to delete comment' });

        const playlist = playlists[idx];
        const comments = playlist.comments || [];
        const cIdx = comments.findIndex(c => String(c.id) === String(req.params.commentId));
        if (cIdx === -1) return res.status(404).json({ error: 'Comment not found' });

        const comment = comments[cIdx];
        if (parseInt(comment.userUID, 10) !== uid) {
            return res.status(403).json({ error: 'You do not own this comment' });
        }

        comments.splice(cIdx, 1);
        playlist.comments = comments;
        playlists[idx] = playlist;
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ message: 'Comment deleted' });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'Could not delete comment' });
    }
});

// Add movie to playlist
app.post('/playlists/:id/movies', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
        const { movieId, movieTitle, poster, genre, userUID } = req.body;
        const ownerUID = playlists[idx].ownerUID;
        if (parseInt(userUID, 10) !== parseInt(ownerUID, 10)) {
            return res.status(403).json({ error: 'You do not own this playlist' });
        }
        if (!movieId) return res.status(400).json({ error: 'movieId required' });
        // Prevent duplicates
        if (!playlists[idx].movies) playlists[idx].movies = [];
        const exists = playlists[idx].movies.find(m => String(m.movieId) === String(movieId));
        if (exists) return res.status(200).json({ message: 'Already in playlist' });
        playlists[idx].movies.push({
            movieId: String(movieId),
            movieTitle: movieTitle || '',
            poster: poster || '',
            genre: genre || ''
        });
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ message: 'Added' });
    } catch (err) {
        console.error('Error adding movie to playlist:', err);
        res.status(500).json({ error: 'Could not add movie' });
    }
});

// Remove movie from playlist
app.delete('/playlists/:id/movies/:movieId', (req, res) => {
    try {
        const data = fs.readFileSync(playlistsPath, 'utf8');
        const playlists = JSON.parse(data) || [];
        const idx = playlists.findIndex(p => String(p.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
        const ownerUID = playlists[idx].ownerUID;
        const userUID = (req.body && req.body.userUID !== undefined) ? req.body.userUID : 0;
        if (parseInt(userUID, 10) !== parseInt(ownerUID, 10)) {
            return res.status(403).json({ error: 'You do not own this playlist' });
        }
        playlists[idx].movies = (playlists[idx].movies || []).filter(m => String(m.movieId) !== String(req.params.movieId));
        fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
        res.json({ message: 'Removed' });
    } catch (err) {
        console.error('Error removing movie from playlist:', err);
        res.status(500).json({ error: 'Could not remove movie' });
    }
});

// =========================================
//  9.5 FORUM ROUTES
// =========================================

// Get all forum movies
app.get('/forum/movies', (req, res) => {
    try {
        const data = fs.readFileSync(forumMoviesPath, 'utf8');
        const movies = JSON.parse(data) || [];
        
        // Count threads for each movie
        const threadsData = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(threadsData) || [];
        
        const moviesWithCounts = movies.map(movie => ({
            ...movie,
            threadCount: threads.filter(t => String(t.movieId) === String(movie.movieId)).length
        }));
        
        res.json(moviesWithCounts);
    } catch (err) {
        console.error('Error reading forum movies:', err);
        res.status(500).json({ error: 'Could not read forum movies' });
    }
});

// Add movie to forum
app.post('/forum/movies', (req, res) => {
    try {
        const data = fs.readFileSync(forumMoviesPath, 'utf8');
        const movies = JSON.parse(data) || [];
        const { movieId, movieTitle, poster, genre, userUID, username } = req.body;
        
        if (!movieId || !movieTitle) {
            return res.status(400).json({ error: 'movieId and movieTitle required' });
        }
        
        // Check if movie already exists
        const exists = movies.find(m => String(m.movieId) === String(movieId));
        if (exists) {
            return res.status(200).json({ message: 'Movie already in forum', movie: exists });
        }
        
        const newMovie = {
            movieId: String(movieId),
            movieTitle,
            poster: poster || '',
            genre: genre || '',
            addedBy: username || 'User',
            addedByUID: parseInt(userUID, 10) || 0,
            createdAt: new Date().toISOString()
        };
        
        movies.unshift(newMovie);
        fs.writeFileSync(forumMoviesPath, JSON.stringify(movies, null, 2));
        res.json(newMovie);
    } catch (err) {
        console.error('Error adding forum movie:', err);
        res.status(500).json({ error: 'Could not add movie' });
    }
});

// Get threads for a movie
app.get('/forum/threads', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        let threads = JSON.parse(data) || [];
        
        const movieId = req.query.movieId;
        if (movieId) {
            threads = threads.filter(t => String(t.movieId) === String(movieId));
        }
        
        // Count comments for each thread
        threads = threads.map(thread => ({
            ...thread,
            commentCount: (thread.comments || []).length
        }));
        
        // Sort by score (descending)
        threads.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        res.json(threads);
    } catch (err) {
        console.error('Error reading threads:', err);
        res.status(500).json({ error: 'Could not read threads' });
    }
});

// Create new thread
app.post('/forum/threads', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const { movieId, title, description, image, userUID, username } = req.body;
        
        if (!movieId || !title || !description) {
            return res.status(400).json({ error: 'movieId, title, and description required' });
        }
        
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) {
            return res.status(403).json({ error: 'Sign in to create threads' });
        }
        
        const newThread = {
            id: String(Date.now()),
            movieId: String(movieId),
            title: String(title).trim(),
            description: String(description).trim(),
            image: image || '',
            username: username || 'User',
            userUID: uid,
            score: 0,
            voters: {},
            comments: [],
            createdAt: new Date().toISOString()
        };
        
        threads.unshift(newThread);
        fs.writeFileSync(forumThreadsPath, JSON.stringify(threads, null, 2));
        res.json(newThread);
    } catch (err) {
        console.error('Error creating thread:', err);
        res.status(500).json({ error: 'Could not create thread' });
    }
});

// Vote on thread
app.post('/forum/threads/:id/vote', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const idx = threads.findIndex(t => String(t.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
        
        const { userUID, vote } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) {
            return res.status(403).json({ error: 'Sign in to vote' });
        }
        if (vote !== 'up' && vote !== 'down') {
            return res.status(400).json({ error: 'Invalid vote' });
        }
        
        const thread = threads[idx];
        if (!thread.voters) thread.voters = {};
        if (thread.score === undefined || thread.score === null) thread.score = 0;
        
        const prevVote = thread.voters[String(uid)] || null;
        if (prevVote === vote) {
            return res.status(409).json({ error: 'Already voted' });
        }
        
        // Adjust score based on vote change
        if (prevVote === 'up') thread.score -= 1;
        if (prevVote === 'down') thread.score += 1;
        
        thread.voters[String(uid)] = vote;
        if (vote === 'up') thread.score += 1;
        if (vote === 'down') thread.score -= 1;
        
        threads[idx] = thread;
        fs.writeFileSync(forumThreadsPath, JSON.stringify(threads, null, 2));
        res.json({ score: thread.score });
    } catch (err) {
        console.error('Error voting on thread:', err);
        res.status(500).json({ error: 'Could not vote' });
    }
});

// Get comments for a thread
app.get('/forum/threads/:id/comments', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const thread = threads.find(t => String(t.id) === String(req.params.id));
        if (!thread) return res.status(404).json({ error: 'Thread not found' });
        
        res.json(thread.comments || []);
    } catch (err) {
        console.error('Error reading comments:', err);
        res.status(500).json({ error: 'Could not read comments' });
    }
});

// Add comment to thread
app.post('/forum/threads/:id/comments', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const idx = threads.findIndex(t => String(t.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
        
        const { userUID, username, text } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to comment' });
        if (!text || !String(text).trim()) return res.status(400).json({ error: 'Comment text required' });
        
        const thread = threads[idx];
        if (!thread.comments) thread.comments = [];
        
        const newComment = {
            id: String(Date.now()),
            userUID: uid,
            username: username || 'User',
            text: String(text).trim(),
            createdAt: new Date().toISOString(),
            upvotes: 0,
            voters: {}
        };
        
        thread.comments.unshift(newComment);
        threads[idx] = thread;
        fs.writeFileSync(forumThreadsPath, JSON.stringify(threads, null, 2));
        res.json(newComment);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: 'Could not add comment' });
    }
});

// Upvote comment
app.post('/forum/threads/:id/comments/:commentId/upvote', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const idx = threads.findIndex(t => String(t.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
        
        const { userUID } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to vote' });
        
        const thread = threads[idx];
        const comments = thread.comments || [];
        const cIdx = comments.findIndex(c => String(c.id) === String(req.params.commentId));
        if (cIdx === -1) return res.status(404).json({ error: 'Comment not found' });
        
        const comment = comments[cIdx];
        if (!comment.voters) comment.voters = {};
        if (comment.upvotes === undefined || comment.upvotes === null) comment.upvotes = 0;
        
        if (comment.voters[String(uid)]) {
            return res.status(409).json({ error: 'Already voted' });
        }
        
        comment.voters[String(uid)] = true;
        comment.upvotes += 1;
        comments[cIdx] = comment;
        thread.comments = comments;
        threads[idx] = thread;
        fs.writeFileSync(forumThreadsPath, JSON.stringify(threads, null, 2));
        res.json({ upvotes: comment.upvotes });
    } catch (err) {
        console.error('Error upvoting comment:', err);
        res.status(500).json({ error: 'Could not upvote' });
    }
});

// Delete thread (owner only)
app.delete('/forum/threads/:id', (req, res) => {
    try {
        const data = fs.readFileSync(forumThreadsPath, 'utf8');
        const threads = JSON.parse(data) || [];
        const idx = threads.findIndex(t => String(t.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Thread not found' });

        const { userUID } = req.body || {};
        const uid = parseInt(userUID, 10);
        if (!uid || uid === 0) return res.status(403).json({ error: 'Sign in to delete thread' });

        const thread = threads[idx];
        if (parseInt(thread.userUID, 10) !== uid) {
            return res.status(403).json({ error: 'You do not own this thread' });
        }

        threads.splice(idx, 1);
        fs.writeFileSync(forumThreadsPath, JSON.stringify(threads, null, 2));
        res.json({ message: 'Thread deleted' });
    } catch (err) {
        console.error('Error deleting thread:', err);
        res.status(500).json({ error: 'Could not delete thread' });
    }
});

// =========================================
//  10. START SERVER
// =========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server is running at http://localhost:${PORT}`);
    console.log(`📂 Reviews file location: ${reviewsPath}`);
});