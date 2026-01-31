/* =========================================
   RECOMMENDATIONS SYSTEM
   Track user preferences and generate recommendations
   ========================================= */

const PREFS_KEY = 'userPreferences';
const API_BASE_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : window.location.origin;
const MOVIE_DATA_LOAD_DELAY = 1000; // Wait for movie data to load from page

// Get or initialize user preferences
function getUserPreferences() {
    const prefs = localStorage.getItem(PREFS_KEY);
    if (!prefs) {
        return {
            genreClicks: {},      // { "Action": 5, "Drama": 3 }
            yearRangeClicks: {},  // { "2020s": 10, "2010s": 5 }
            ratingPreference: 0,  // Average rating of watched movies
            watchedMovies: [],    // List of movie IDs
            clickedMovies: []     // List of recently clicked movies
        };
    }
    return JSON.parse(prefs);
}

// Save user preferences
function saveUserPreferences(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// Track movie click
function trackMovieClick(movieId, genre, year, rating) {
    const prefs = getUserPreferences();
    
    // Track genre preference
    if (genre) {
        const genres = genre.split(',').map(g => g.trim());
        genres.forEach(g => {
            prefs.genreClicks[g] = (prefs.genreClicks[g] || 0) + 1;
        });
    }
    
    // Track year range preference
    if (year) {
        const yearInt = parseInt(year);
        let yearRange;
        if (yearInt >= 2020) yearRange = '2020s';
        else if (yearInt >= 2010) yearRange = '2010s';
        else if (yearInt >= 2000) yearRange = '2000s';
        else if (yearInt >= 1990) yearRange = '1990s';
        else yearRange = 'Classic';
        
        prefs.yearRangeClicks[yearRange] = (prefs.yearRangeClicks[yearRange] || 0) + 1;
    }
    
    // Track clicked movies (keep last 20)
    if (movieId && !prefs.clickedMovies.includes(movieId)) {
        prefs.clickedMovies.unshift(movieId);
        if (prefs.clickedMovies.length > 20) {
            prefs.clickedMovies = prefs.clickedMovies.slice(0, 20);
        }
    }
    
    saveUserPreferences(prefs);
    
    // Also track on server
    trackMovieClickOnServer(movieId);
}

// Track movie click on server
async function trackMovieClickOnServer(movieId) {
    try {
        await fetch(`${API_BASE_URL}/movie/${movieId}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error tracking click on server:', error);
    }
}

// Mark movie as watched
function markMovieWatched(movieId, rating) {
    const prefs = getUserPreferences();
    
    if (!prefs.watchedMovies.includes(movieId)) {
        prefs.watchedMovies.push(movieId);
    }
    
    // Update average rating preference
    if (rating) {
        const currentAvg = prefs.ratingPreference || 0;
        const watchedCount = prefs.watchedMovies.length;
        prefs.ratingPreference = ((currentAvg * (watchedCount - 1)) + parseFloat(rating)) / watchedCount;
    }
    
    saveUserPreferences(prefs);
}

// Get top genres from user preferences
function getTopGenres(limit = 3) {
    const prefs = getUserPreferences();
    const genres = Object.entries(prefs.genreClicks)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(entry => entry[0]);
    
    return genres;
}

// Get top year range from user preferences
function getTopYearRange() {
    const prefs = getUserPreferences();
    const yearRanges = Object.entries(prefs.yearRangeClicks)
        .sort((a, b) => b[1] - a[1]);
    
    if (yearRanges.length === 0) return null;
    return yearRanges[0][0];
}

// Get year range bounds
function getYearRangeBounds(yearRange) {
    switch (yearRange) {
        case '2020s': return [2020, 2030];
        case '2010s': return [2010, 2019];
        case '2000s': return [2000, 2009];
        case '1990s': return [1990, 1999];
        case 'Classic': return [1900, 1989];
        default: return [1900, 2030];
    }
}

// Generate recommendations
async function generateRecommendations(limit = 12) {
    const prefs = getUserPreferences();
    const topGenres = getTopGenres();
    const topYearRange = getTopYearRange();
    
    // If no preferences yet, return top rated movies
    if (topGenres.length === 0) {
        return await getTopRatedMovies(limit);
    }
    
    try {
        // Build query based on preferences
        let params = new URLSearchParams({
            limit: limit * 2, // Get more to filter out watched movies
            sort: 'rating_desc'
        });
        
        // Add genre filter
        if (topGenres.length > 0) {
            params.append('genre', topGenres[0]);
        }
        
        // Add year filter if available
        if (topYearRange) {
            const [minYear] = getYearRangeBounds(topYearRange);
            params.append('year', minYear);
        }
        
        const response = await fetch(`${API_BASE_URL}/movies/library?${params}`);
        let movies = await response.json();
        
        // Filter out already watched movies
        movies = movies.filter(m => !prefs.watchedMovies.includes(String(m.ID)));
        
        // Filter out movies in my list
        const myList = JSON.parse(localStorage.getItem('myList') || '[]');
        movies = movies.filter(m => !myList.includes(String(m.ID)));
        
        // Limit to requested amount
        movies = movies.slice(0, limit);
        
        // If we don't have enough, supplement with top rated
        if (movies.length < limit) {
            const topRated = await getTopRatedMovies(limit - movies.length);
            movies = [...movies, ...topRated];
        }
        
        return movies;
    } catch (error) {
        console.error('Error generating recommendations:', error);
        return await getTopRatedMovies(limit);
    }
}

// Get top rated movies as fallback
async function getTopRatedMovies(limit = 12) {
    try {
        const response = await fetch(`${API_BASE_URL}/movies/library?limit=${limit}&sort=rating_desc`);
        const movies = await response.json();
        
        // Filter out movies in my list
        const myList = JSON.parse(localStorage.getItem('myList') || '[]');
        return movies.filter(m => !myList.includes(String(m.ID)));
    } catch (error) {
        console.error('Error fetching top rated movies:', error);
        return [];
    }
}

// Load and display recommendations
async function loadRecommendations() {
    const container = document.getElementById('recommendationsGrid');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
            Loading recommendations...
        </div>
    `;
    
    const movies = await generateRecommendations(12);
    
    if (movies.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                <p>No recommendations available. Browse some movies to get personalized suggestions!</p>
            </div>
        `;
        return;
    }
    
    // Render movies
    container.innerHTML = movies.map(movie => {
        const poster = movie.poster_full_url || '/img/placeholder.jpg';
        const title = movie['Movie Name'] || movie.title || 'Unknown Title';
        const rating = movie.Rating || 'N/A';
        const genre = movie.Genre || '';
        
        return `
            <div class="movie-card" onclick="goToMovieInfo('${movie.ID}', '${escapeForAttribute(title)}', '${genre}', '${movie.release_date}', '${rating}')">
                <img src="${poster}" alt="${escapeForAttribute(title)}" loading="lazy">
                <div class="movie-overlay">
                    <h4>${escapeHtml(title)}</h4>
                    <p>${rating} ★</p>
                </div>
            </div>
        `;
    }).join('');
}

// Navigate to movie info and track click
function goToMovieInfo(movieId, title, genre, releaseDate, rating) {
    // Track the click
    const year = releaseDate ? releaseDate.split('-')[0] : null;
    trackMovieClick(movieId, genre, year, rating);
    
    // Navigate to movie page
    window.location.href = `movieInfo.html?id=${movieId}`;
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeForAttribute(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Auto-track movie clicks on movie info page
if (window.location.pathname.includes('movieInfo.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    
    // Track after page loads to get movie data
    window.addEventListener('load', () => {
        // Get movie data from the page if available
        setTimeout(() => {
            const titleEl = document.querySelector('.hero-title, h1');
            const genre = document.querySelector('[data-genre]')?.dataset.genre || '';
            const rating = document.querySelector('[data-rating]')?.dataset.rating || '';
            const year = document.querySelector('[data-year]')?.dataset.year || '';
            
            if (movieId) {
                trackMovieClick(movieId, genre, year, rating);
            }
        }, MOVIE_DATA_LOAD_DELAY);
    });
}

// Initialize on personal list page
if (window.location.pathname.includes('personalList.html')) {
    window.addEventListener('DOMContentLoaded', () => {
        loadRecommendations();
    });
}

// Export functions for use in other scripts
window.recommendationsSystem = {
    trackMovieClick,
    markMovieWatched,
    generateRecommendations,
    loadRecommendations,
    getUserPreferences
};
