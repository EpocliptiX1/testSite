/* =========================================
   ENHANCED SEARCH WITH AUTOCOMPLETE
   Better search experience with debouncing,
   suggestions, and smart filtering
   ========================================= */

const EnhancedSearch = {
    // Search state
    searchTimeout: null,
    currentQuery: '',
    searchHistory: [],
    maxHistoryItems: 10,
    
    // Initialize enhanced search
    init() {
        this.loadSearchHistory();
        this.ensureResultsPortal();
        this.setupSearchInput();
        console.log('✅ Enhanced search initialized');
    },

    ensureResultsPortal() {
        const resultsMenu = document.getElementById('searchResults');
        if (!resultsMenu) return;
        if (resultsMenu.parentElement !== document.body) {
            document.body.appendChild(resultsMenu);
        }
        resultsMenu.classList.add('search-results-modal');
    },
    
    // Setup search input with debouncing
    setupSearchInput() {
        const searchInput = document.getElementById('mainSearch');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.handleSearch(query);
        });
        
        // Show search history on focus
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim() === '') {
                this.showSearchHistory();
            }
        });
        
        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    this.performFullSearch(query);
                }
            }
        });
    },
    
    // Handle search with debouncing
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.currentQuery = query;
        
        const resultsMenu = document.getElementById('searchResults');
        const searchBox = document.querySelector('.search-box');
        
        if (query.length === 0) {
            if (resultsMenu) {
                resultsMenu.classList.remove('active');
            }
            if (searchBox) {
                searchBox.classList.remove('expanded');
            }
            return;
        }
        
        if (searchBox) {
            searchBox.classList.add('expanded');
        }
        
        // Show loading state
        if (resultsMenu) {
            resultsMenu.classList.add('active');
            resultsMenu.innerHTML = `
                <div class="search-loading">
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                </div>
            `;
        }
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    },
    
    // Perform search request
    async performSearch(query) {
        try {
            const baseUrl = `http://localhost:3000/search?q=${encodeURIComponent(query)}`;
            const response = await fetch(window.withMovieSource ? window.withMovieSource(baseUrl) : baseUrl);
            const movies = await response.json();
            
            this.displayResults(movies, query);
            
            // Add to search history
            this.addToHistory(query);
        } catch (error) {
            console.error('Search error:', error);
            const resultsMenu = document.getElementById('searchResults');
            if (resultsMenu) {
                resultsMenu.innerHTML = `
                    <div class="search-error">
                        <p style="color: var(--error-color); padding: 20px; text-align: center;">
                            ${window.i18n.t('notif_error')}
                        </p>
                    </div>
                `;
            }
        }
    },
    
    // Display search results
    displayResults(movies, query) {
        const resultsMenu = document.getElementById('searchResults');
        if (!resultsMenu) return;
        
        if (movies.length === 0) {
            resultsMenu.innerHTML = `
                <div class="search-empty">
                    <p style="color: var(--text-muted); padding: 20px; text-align: center;">
                        No results found for "${query}"
                    </p>
                    ${this.getSearchSuggestions(query)}
                </div>
            `;
            return;
        }
        
        resultsMenu.innerHTML = movies.map(movie => `
            <div class="search-item" onclick="EnhancedSearch.selectMovie('${movie.ID}')">
                    <img src="${movie.Poster || '/img/LOGO_Short.png'}" 
                     alt="${movie['Movie Name']}"
                        onerror="this.src='/img/LOGO_Short.png'">
                <div class="search-info">
                    <h5>${this.highlightQuery(movie['Movie Name'], query)}</h5>
                    <p>${movie.Year || 'N/A'} • ${movie.Genre || 'Unknown'} • ⭐ ${movie.Rating || 'N/A'}</p>
                </div>
            </div>
        `).join('');
    },
    
    // Highlight query in results
    highlightQuery(text, query) {
        if (!text || !query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: var(--accent-primary); color: white; padding: 2px 4px; border-radius: 2px;">$1</mark>');
    },
    
    // Get search suggestions
    getSearchSuggestions(query) {
        const suggestions = [
            'Try using different keywords',
            'Check your spelling',
            'Try searching for actors or directors',
            'Browse by genre instead'
        ];
        
        return `
            <div class="search-suggestions" style="padding: 10px 20px; border-top: 1px solid var(--border-light);">
                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 0.9rem;">Suggestions:</p>
                <ul style="list-style: none; color: var(--text-muted); font-size: 0.85rem;">
                    ${suggestions.map(s => `<li style="padding: 4px 0;">• ${s}</li>`).join('')}
                </ul>
            </div>
        `;
    },
    
    // Select movie from search results
    selectMovie(movieId) {
        // Close search results
        const resultsMenu = document.getElementById('searchResults');
        if (resultsMenu) {
            resultsMenu.classList.remove('active');
        }
        
        // Clear search input
        const searchInput = document.getElementById('mainSearch');
        if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }
        
        // Open movie (use existing function or create new one)
        if (window.openMovieById) {
            window.openMovieById(movieId);
        } else {
            window.location.href = `/html/movieInfo.html?id=${movieId}`;
        }
    },
    
    // Perform full search (navigate to search results page)
    performFullSearch(query) {
        this.addToHistory(query);
        window.location.href = `/html/searchQueryResult.html?q=${encodeURIComponent(query)}`;
    },
    
    // Search history management
    loadSearchHistory() {
        try {
            const history = localStorage.getItem('searchHistory');
            this.searchHistory = history ? JSON.parse(history) : [];
        } catch (error) {
            this.searchHistory = [];
        }
    },
    
    saveSearchHistory() {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    },
    
    addToHistory(query) {
        if (!query || query.length < 2) return;
        
        // Remove duplicates
        this.searchHistory = this.searchHistory.filter(item => item !== query);
        
        // Add to beginning
        this.searchHistory.unshift(query);
        
        // Keep only max items
        if (this.searchHistory.length > this.maxHistoryItems) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
        }
        
        this.saveSearchHistory();
    },
    
    clearHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
    },
    
    showSearchHistory() {
        const resultsMenu = document.getElementById('searchResults');
        if (!resultsMenu || this.searchHistory.length === 0) return;
        
        resultsMenu.classList.add('active');
        resultsMenu.innerHTML = `
            <div class="search-history">
                <div class="search-history-header" style="padding: 15px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 600;">Recent Searches</span>
                    <button onclick="EnhancedSearch.clearHistory(); this.parentElement.parentElement.remove();" 
                            style="background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 0.85rem;">
                        Clear
                    </button>
                </div>
                ${this.searchHistory.map(query => `
                    <div class="search-history-item" 
                         onclick="document.getElementById('mainSearch').value = '${query}'; EnhancedSearch.performSearch('${query}');"
                         style="padding: 12px 20px; cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.2s;">
                        <span style="color: var(--text-primary);">🕒 ${query}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add hover effect
        const historyItems = resultsMenu.querySelectorAll('.search-history-item');
        historyItems.forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            item.addEventListener('mouseleave', function() {
                this.style.background = 'transparent';
            });
        });
    }
};

// Advanced search filters
const SearchFilters = {
    // Available filters
    filters: {
        year: null,
        genre: null,
        rating: null,
        duration: null
    },
    
    // Apply filters to search
    applyFilters(movies) {
        let filtered = [...movies];
        
        if (this.filters.year) {
            filtered = filtered.filter(m => {
                const year = parseInt(m.Year || m.release_date?.split('-')[0] || 0);
                return year >= this.filters.year.min && year <= this.filters.year.max;
            });
        }
        
        if (this.filters.genre) {
            filtered = filtered.filter(m => 
                m.Genre && m.Genre.toLowerCase().includes(this.filters.genre.toLowerCase())
            );
        }
        
        if (this.filters.rating) {
            filtered = filtered.filter(m => 
                parseFloat(m.Rating || 0) >= this.filters.rating
            );
        }
        
        if (this.filters.duration) {
            filtered = filtered.filter(m => {
                const runtime = parseInt(m.Runtime || 0);
                return runtime >= this.filters.duration.min && runtime <= this.filters.duration.max;
            });
        }
        
        return filtered;
    },
    
    // Set filter
    setFilter(type, value) {
        this.filters[type] = value;
    },
    
    // Clear filter
    clearFilter(type) {
        this.filters[type] = null;
    },
    
    // Clear all filters
    clearAllFilters() {
        this.filters = {
            year: null,
            genre: null,
            rating: null,
            duration: null
        };
    }
};

// Voice search (experimental)
const VoiceSearch = {
    recognition: null,
    
    // Initialize voice search
    init() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const searchInput = document.getElementById('mainSearch');
                if (searchInput) {
                    searchInput.value = transcript;
                    EnhancedSearch.handleSearch(transcript);
                }
            };
            
            console.log('🎤 Voice search available');
        }
    },
    
    // Start voice search
    start() {
        if (this.recognition) {
            this.recognition.start();
            console.log('🎤 Listening...');
        }
    }
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        EnhancedSearch.init();
        VoiceSearch.init();
    });
} else {
    EnhancedSearch.init();
    VoiceSearch.init();
}

// Export for use in other scripts
window.EnhancedSearch = EnhancedSearch;
window.SearchFilters = SearchFilters;
window.VoiceSearch = VoiceSearch;

console.log('✅ Enhanced search module loaded');
