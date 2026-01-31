/* =========================================
   NETFLIX-LIKE FEATURES
   - Continue Watching
   - Watch History
   - Smart Recommendations
   - Recently Added
   ========================================= */

// Watch history manager
const WatchHistory = {
    // Get all watch history
    getHistory() {
        try {
            const history = localStorage.getItem('watchHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error getting watch history:', error);
            return [];
        }
    },
    
    // Add or update watch history entry
    addEntry(movieId, movieTitle, poster, watchedPercentage = 0, genre = '') {
        try {
            const history = this.getHistory();
            const timestamp = new Date().toISOString();
            
            // Check if movie already in history
            const existingIndex = history.findIndex(entry => entry.movieId === movieId);
            
            const entry = {
                movieId,
                movieTitle,
                poster,
                genre,
                watchedPercentage,
                lastWatched: timestamp,
                addedAt: existingIndex >= 0 ? history[existingIndex].addedAt : timestamp
            };
            
            if (existingIndex >= 0) {
                // Update existing entry
                history[existingIndex] = entry;
            } else {
                // Add new entry to the beginning
                history.unshift(entry);
            }
            
            // Keep only last 50 entries
            const trimmedHistory = history.slice(0, 50);
            localStorage.setItem('watchHistory', JSON.stringify(trimmedHistory));
            
            return true;
        } catch (error) {
            console.error('Error adding to watch history:', error);
            return false;
        }
    },
    
    // Get continue watching items (watched > 5% and < 95%)
    getContinueWatching() {
        const history = this.getHistory();
        return history.filter(entry => 
            entry.watchedPercentage > 5 && entry.watchedPercentage < 95
        ).slice(0, 10);
    },
    
    // Get recently watched (all items, sorted by last watched)
    getRecentlyWatched(limit = 20) {
        return this.getHistory().slice(0, limit);
    },
    
    // Get fully watched movies
    getCompleted() {
        const history = this.getHistory();
        return history.filter(entry => entry.watchedPercentage >= 95);
    },
    
    // Remove entry from history
    removeEntry(movieId) {
        try {
            const history = this.getHistory();
            const filtered = history.filter(entry => entry.movieId !== movieId);
            localStorage.setItem('watchHistory', JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error removing from watch history:', error);
            return false;
        }
    },
    
    // Clear all history
    clearHistory() {
        localStorage.removeItem('watchHistory');
    },
    
    // Get watch progress for a specific movie
    getProgress(movieId) {
        const history = this.getHistory();
        const entry = history.find(e => e.movieId === movieId);
        return entry ? entry.watchedPercentage : 0;
    },
    
    // Update watch progress
    updateProgress(movieId, percentage) {
        const history = this.getHistory();
        const entry = history.find(e => e.movieId === movieId);
        if (entry) {
            entry.watchedPercentage = Math.min(100, Math.max(0, percentage));
            entry.lastWatched = new Date().toISOString();
            localStorage.setItem('watchHistory', JSON.stringify(history));
        }
    }
};

// Recently added/trending manager
const TrendingManager = {
    // Track movie views
    trackView(movieId) {
        try {
            const views = this.getViews();
            const today = new Date().toISOString().split('T')[0];
            
            if (!views[movieId]) {
                views[movieId] = { count: 0, lastView: today, dailyViews: {} };
            }
            
            views[movieId].count += 1;
            views[movieId].lastView = today;
            views[movieId].dailyViews[today] = (views[movieId].dailyViews[today] || 0) + 1;
            
            localStorage.setItem('movieViews', JSON.stringify(views));
        } catch (error) {
            console.error('Error tracking view:', error);
        }
    },
    
    // Get all views
    getViews() {
        try {
            const views = localStorage.getItem('movieViews');
            return views ? JSON.parse(views) : {};
        } catch (error) {
            return {};
        }
    },
    
    // Get trending movies (most viewed in last 7 days)
    getTrending(limit = 10) {
        const views = this.getViews();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
        
        const trending = Object.entries(views)
            .map(([movieId, data]) => {
                const recentViews = Object.entries(data.dailyViews)
                    .filter(([date]) => date >= cutoffDate)
                    .reduce((sum, [, count]) => sum + count, 0);
                
                return { movieId, recentViews, totalViews: data.count };
            })
            .filter(item => item.recentViews > 0)
            .sort((a, b) => b.recentViews - a.recentViews)
            .slice(0, limit);
        
        return trending;
    }
};

// Smart recommendations based on watch history
const SmartRecommendations = {
    // Analyze user preferences from watch history
    analyzePreferences() {
        const history = WatchHistory.getHistory();
        const preferences = {
            genres: {},
            recentGenres: {},
            averageWatchPercentage: 0
        };
        
        let totalPercentage = 0;
        
        history.forEach((entry, index) => {
            // Count all genres
            if (entry.genre) {
                const genres = entry.genre.split(',').map(g => g.trim());
                genres.forEach(genre => {
                    preferences.genres[genre] = (preferences.genres[genre] || 0) + 1;
                    
                    // Weight recent watches more heavily
                    if (index < 10) {
                        preferences.recentGenres[genre] = (preferences.recentGenres[genre] || 0) + 1;
                    }
                });
            }
            
            totalPercentage += entry.watchedPercentage || 0;
        });
        
        preferences.averageWatchPercentage = history.length > 0 
            ? totalPercentage / history.length 
            : 0;
        
        // Sort genres by count
        preferences.topGenres = Object.entries(preferences.genres)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([genre]) => genre);
        
        return preferences;
    },
    
    // Get personalized recommendations
    async getRecommendations(limit = 20) {
        const preferences = this.analyzePreferences();
        
        if (preferences.topGenres.length === 0) {
            // No history, return popular movies
            return this.getPopularMovies(limit);
        }
        
        // Fetch movies from top genres
        // Use relative URL to work in all environments
        const apiBase = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : '';
        
        try {
            const promises = preferences.topGenres.map(genre =>
                fetch(`${apiBase}/movies/library?genre=${genre}&limit=${Math.ceil(limit / preferences.topGenres.length)}&sort=rating_desc`)
                    .then(res => res.json())
            );
            
            const results = await Promise.all(promises);
            const movies = results.flat();
            
            // Remove duplicates and movies already watched
            const watchedIds = new Set(WatchHistory.getHistory().map(e => e.movieId));
            const unique = [];
            const seen = new Set();
            
            movies.forEach(movie => {
                if (!seen.has(movie.ID) && !watchedIds.has(movie.ID)) {
                    seen.add(movie.ID);
                    unique.push(movie);
                }
            });
            
            return unique.slice(0, limit);
        } catch (error) {
            console.error('Error getting recommendations:', error);
            return [];
        }
    },
    
    // Get popular movies as fallback
    async getPopularMovies(limit = 20) {
        // Use relative URL to work in all environments
        const apiBase = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : '';
            
        try {
            const response = await fetch(`${apiBase}/movies/library?limit=${limit}&sort=rating_desc`);
            return await response.json();
        } catch (error) {
            console.error('Error getting popular movies:', error);
            return [];
        }
    }
};

// UI rendering functions
const WatchHistoryUI = {
    // Render continue watching row
    renderContinueWatching(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const items = WatchHistory.getContinueWatching();
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No movies in progress</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="movie-card" onclick="openMovieById('${item.movieId}')">
                <img src="${item.poster || '/img/placeholder.jpg'}" alt="${item.movieTitle}">
                <div class="continue-watching-bar">
                    <div class="continue-watching-progress" style="width: ${item.watchedPercentage}%"></div>
                </div>
                <h4>${item.movieTitle}</h4>
                <p class="watch-progress">${Math.round(item.watchedPercentage)}% watched</p>
            </div>
        `).join('');
    },
    
    // Render recently watched row
    renderRecentlyWatched(containerId, limit = 10) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const items = WatchHistory.getRecentlyWatched(limit);
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No watch history</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="movie-card" onclick="openMovieById('${item.movieId}')">
                <img src="${item.poster || '/img/placeholder.jpg'}" alt="${item.movieTitle}">
                ${item.watchedPercentage >= 95 ? '<div class="watched-indicator">✓ Watched</div>' : ''}
                <h4>${item.movieTitle}</h4>
                <p class="year">${new Date(item.lastWatched).toLocaleDateString()}</p>
            </div>
        `).join('');
    },
    
    // Render smart recommendations row
    async renderRecommendations(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Show loading skeleton
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton skeleton-card"></div>
        `).join('');
        
        const movies = await SmartRecommendations.getRecommendations(12);
        
        if (movies.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No recommendations available</p>';
            return;
        }
        
        container.innerHTML = movies.map(movie => `
            <div class="movie-card" onclick="openMovieById('${movie.ID}')">
                <img src="${movie.Poster || '/img/placeholder.jpg'}" alt="${movie['Movie Name']}">
                <h4>${movie['Movie Name']}</h4>
                <p class="year">${movie.Year || 'N/A'} • ⭐ ${movie.Rating || 'N/A'}</p>
            </div>
        `).join('');
    }
};

// Helper function to open movie by ID
window.openMovieById = async function(movieId) {
    try {
        const response = await fetch(`http://localhost:3000/movie/${movieId}`);
        const movie = await response.json();
        
        if (movie) {
            // Track view
            TrendingManager.trackView(movieId);
            
            // Add to watch history
            WatchHistory.addEntry(
                movieId,
                movie['Movie Name'],
                movie.Poster,
                0,
                movie.Genre
            );
            
            // Open movie detail (reuse existing function if available)
            if (window.openMovie) {
                window.openMovie(movie);
            }
        }
    } catch (error) {
        console.error('Error opening movie:', error);
    }
};

// Export for use in other scripts
window.WatchHistory = WatchHistory;
window.TrendingManager = TrendingManager;
window.SmartRecommendations = SmartRecommendations;
window.WatchHistoryUI = WatchHistoryUI;

console.log('✅ Netflix-like features loaded');
