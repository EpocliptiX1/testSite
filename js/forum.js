/* =========================================
   DISCUSSION FORUM JAVASCRIPT
   Handles movie discussions, threads, voting
   ========================================= */

const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : window.location.origin;
let currentMovieId = null;
let currentThreadId = null;
let forumMovies = [];
let forumThreads = [];

// Initialize forum on page load
document.addEventListener('DOMContentLoaded', function() {
    loadForumMovies();
});

// Load all movies that have discussion threads
async function loadForumMovies() {
    try {
        const response = await fetch(`${API_BASE}/forum/movies`);
        if (!response.ok) throw new Error('Failed to load forum movies');
        forumMovies = await response.json();
        renderMoviesList();
    } catch (error) {
        console.error('Error loading forum movies:', error);
        renderMoviesList(); // Render empty state
    }
}

// Render movies list in sidebar
function renderMoviesList() {
    const container = document.getElementById('moviesList');
    if (!container) return;

    if (forumMovies.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎬</div>
                <p>No movies yet. Add one to start a discussion!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = forumMovies.map(movie => `
        <div class="movie-item ${currentMovieId === movie.movieId ? 'active' : ''}" 
             onclick="selectMovie('${movie.movieId}', '${escapeHtml(movie.movieTitle)}')">
            <img class="movie-item-poster" src="${movie.poster || '/img/placeholder.jpg'}" alt="${escapeHtml(movie.movieTitle)}">
            <div class="movie-item-info">
                <h4>${escapeHtml(movie.movieTitle)}</h4>
                <p>${movie.threadCount || 0} threads</p>
            </div>
        </div>
    `).join('');
}

// Select a movie and load its threads
async function selectMovie(movieId, movieTitle) {
    currentMovieId = movieId;
    
    // Update UI
    document.getElementById('currentMovieTitle').textContent = movieTitle;
    document.getElementById('currentMovieDesc').textContent = 'Discussion threads for this movie';
    document.getElementById('createThreadBtn').style.display = 'block';
    
    // Update active state
    document.querySelectorAll('.movie-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.movie-item')?.classList.add('active');
    
    // Load threads for this movie
    await loadThreads(movieId);
}

// Load threads for a specific movie
async function loadThreads(movieId) {
    try {
        const response = await fetch(`${API_BASE}/forum/threads?movieId=${movieId}`);
        if (!response.ok) throw new Error('Failed to load threads');
        forumThreads = await response.json();
        renderThreads();
    } catch (error) {
        console.error('Error loading threads:', error);
        renderThreads(); // Render empty state
    }
}

// Render threads list
function renderThreads() {
    const container = document.getElementById('threadsContainer');
    if (!container) return;

    if (forumThreads.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">💬</div>
                <h3>No discussions yet</h3>
                <p>Be the first to start a discussion about this movie!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = forumThreads.map(thread => {
        const userVote = getUserVote(thread);
        return `
            <div class="thread-card" onclick="openThreadDetail('${thread.id}')">
                <div class="thread-votes-column">
                    <button class="vote-btn upvote ${userVote === 'up' ? 'active' : ''}" 
                            onclick="event.stopPropagation(); voteThreadInList('${thread.id}', 'up')">
                        <span>▲</span>
                    </button>
                    <span class="vote-score">${thread.score || 0}</span>
                    <button class="vote-btn downvote ${userVote === 'down' ? 'active' : ''}" 
                            onclick="event.stopPropagation(); voteThreadInList('${thread.id}', 'down')">
                        <span>▼</span>
                    </button>
                </div>
                <div class="thread-content">
                    <div class="thread-header">
                        ${thread.image ? `<img class="thread-thumbnail" src="${thread.image}" alt="Thread image">` : ''}
                        <div class="thread-info">
                            <h3 class="thread-title">${escapeHtml(thread.title)}</h3>
                            <p class="thread-meta">Posted by ${escapeHtml(thread.username)} • UID: ${thread.userUID}</p>
                        </div>
                    </div>
                    <p class="thread-description">${escapeHtml(truncate(thread.description, 200))}</p>
                    <div class="thread-stats">
                        <span class="thread-stat">
                            💬 ${thread.commentCount || 0} comments
                        </span>
                        <span class="thread-stat">
                            📅 ${formatDate(thread.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Get user's vote for a thread
function getUserVote(thread) {
    const userUID = localStorage.getItem('userUID');
    if (!userUID || !thread.voters) return null;
    return thread.voters[userUID] || null;
}

// Open add movie modal
function openAddMovieModal() {
    const userUID = localStorage.getItem('userUID');
    if (!userUID || userUID === '0') {
        showLimitToast('⚠️ Sign in to add movies to the forum!');
        return;
    }
    document.getElementById('addMovieModal').classList.add('active');
}

function closeAddMovieModal() {
    document.getElementById('addMovieModal').classList.remove('active');
    document.getElementById('movieSearchInput').value = '';
    document.getElementById('movieSearchResults').innerHTML = '';
}

// Search movies for forum with autocomplete dropdown
let searchTimeout;
async function searchMoviesForForum() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('movieSearchInput').value.trim();
    const container = document.getElementById('movieSearchResults');
    
    if (query.length < 2) {
        container.innerHTML = '';
        container.classList.remove('active');
        return;
    }

    // Show loading state
    container.classList.add('active');
    container.innerHTML = `
        <div class="search-loading" style="padding: 15px; text-align: center; color: var(--text-muted);">
            Searching...
        </div>
    `;

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
            const movies = await response.json();
            
            if (movies.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No movies found</div>';
                return;
            }

            // Display results as dropdown items (similar to navbar search)
            container.innerHTML = movies.slice(0, 8).map(movie => `
                <div class="search-item-forum" onclick="selectMovieForForum(${movie.ID}, '${escapeHtml(movie['Movie Name'])}', '${movie.poster_full_url || ''}', '${escapeHtml(movie.Genre || '')}')">
                    <img src="${movie.poster_full_url || '/img/placeholder.jpg'}" 
                         alt="${escapeHtml(movie['Movie Name'])}"
                         onerror="this.src='/img/placeholder.jpg'"
                         style="width: 50px; height: 75px; object-fit: cover; border-radius: 4px;">
                    <div class="search-info-forum">
                        <h5 style="margin: 0; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(movie['Movie Name'])}</h5>
                        <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                            ${movie.Year || 'N/A'} • ${movie.Genre || 'Unknown'} • ⭐ ${movie.Rating || 'N/A'}
                        </p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error searching movies:', error);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--error-color);">Search failed. Please try again.</div>';
        }
    }, 300);
}

// Select movie from dropdown and add to forum
async function selectMovieForForum(movieId, movieTitle, poster, genre) {
    // Hide dropdown
    const container = document.getElementById('movieSearchResults');
    container.classList.remove('active');
    container.innerHTML = '';
    
    // Clear search input
    document.getElementById('movieSearchInput').value = '';
    
    // Add movie to forum
    await addMovieToForum(movieId, movieTitle, poster, genre);
}

// Add movie to forum
async function addMovieToForum(movieId, movieTitle, poster, genre) {
    try {
        const userUID = localStorage.getItem('userUID');
        const username = localStorage.getItem('username');

        const response = await fetch(`${API_BASE}/forum/movies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movieId: String(movieId),
                movieTitle,
                poster,
                genre,
                userUID: parseInt(userUID),
                username
            })
        });

        if (!response.ok) throw new Error('Failed to add movie');
        
        showLimitToast('✅ Movie added to forum!');
        closeAddMovieModal();
        await loadForumMovies();
    } catch (error) {
        console.error('Error adding movie:', error);
        showLimitToast('❌ Failed to add movie');
    }
}

// Open create thread modal
function openCreateThreadModal() {
    const userUID = localStorage.getItem('userUID');
    if (!userUID || userUID === '0') {
        showLimitToast('⚠️ Sign in to create threads!');
        return;
    }
    if (!currentMovieId) {
        showLimitToast('⚠️ Select a movie first!');
        return;
    }
    document.getElementById('createThreadModal').classList.add('active');
}

function closeCreateThreadModal() {
    document.getElementById('createThreadModal').classList.remove('active');
    document.getElementById('createThreadForm').reset();
}

// Submit new thread
async function submitThread(event) {
    event.preventDefault();
    
    const title = document.getElementById('threadTitle').value.trim();
    const description = document.getElementById('threadDescription').value.trim();
    const image = document.getElementById('threadImage').value.trim();
    const userUID = localStorage.getItem('userUID');
    const username = localStorage.getItem('username');

    try {
        const response = await fetch(`${API_BASE}/forum/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movieId: currentMovieId,
                title,
                description,
                image,
                userUID: parseInt(userUID),
                username
            })
        });

        if (!response.ok) throw new Error('Failed to create thread');
        
        showLimitToast('✅ Thread created!');
        closeCreateThreadModal();
        await loadThreads(currentMovieId);
    } catch (error) {
        console.error('Error creating thread:', error);
        showLimitToast('❌ Failed to create thread');
    }
}

// Vote on thread from list
async function voteThreadInList(threadId, vote) {
    await voteOnThread(threadId, vote);
    await loadThreads(currentMovieId);
}

// Open thread detail modal
async function openThreadDetail(threadId) {
    currentThreadId = threadId;
    const thread = forumThreads.find(t => t.id === threadId);
    if (!thread) return;

    // Update modal content
    document.getElementById('threadDetailTitle').textContent = thread.title;
    document.getElementById('threadDetailAuthor').textContent = `Posted by ${thread.username} • UID: ${thread.userUID}`;
    document.getElementById('threadDetailDescription').textContent = thread.description;
    document.getElementById('threadScore').textContent = thread.score || 0;
    
    const imageEl = document.getElementById('threadDetailImage');
    if (thread.image) {
        imageEl.src = thread.image;
        imageEl.style.display = 'block';
    } else {
        imageEl.style.display = 'none';
    }

    // Update vote buttons
    const userVote = getUserVote(thread);
    document.querySelectorAll('#threadDetailModal .vote-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (userVote) {
        document.querySelector(`#threadDetailModal .vote-btn.${userVote}vote`)?.classList.add('active');
    }

    // Load comments
    await loadComments(threadId);

    // Show modal
    document.getElementById('threadDetailModal').classList.add('active');
}

function closeThreadDetailModal() {
    document.getElementById('threadDetailModal').classList.remove('active');
    currentThreadId = null;
}

// Load comments for a thread
async function loadComments(threadId) {
    try {
        const response = await fetch(`${API_BASE}/forum/threads/${threadId}/comments`);
        if (!response.ok) throw new Error('Failed to load comments');
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        renderComments([]);
    }
}

// Render comments
function renderComments(comments) {
    const container = document.getElementById('threadComments');
    if (!container) return;

    if (comments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No comments yet. Be the first!</p>';
        return;
    }

    const userUID = localStorage.getItem('userUID');
    container.innerHTML = comments.map(comment => {
        const hasUpvoted = comment.voters && comment.voters[userUID];
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.username)}</span>
                    <span class="comment-meta">UID: ${comment.userUID} • ${formatDate(comment.createdAt)}</span>
                </div>
                <p class="comment-text">${escapeHtml(comment.text)}</p>
                <div class="comment-actions">
                    <button class="comment-upvote ${hasUpvoted ? 'active' : ''}" 
                            onclick="upvoteComment('${comment.id}')">
                        <span>▲</span>
                        <span>${comment.upvotes || 0}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Vote on thread
async function voteThread(vote) {
    await voteOnThread(currentThreadId, vote);
    
    // Reload thread detail
    const thread = forumThreads.find(t => t.id === currentThreadId);
    if (thread) {
        await loadThreads(currentMovieId);
        openThreadDetail(currentThreadId);
    }
}

// Vote on thread (shared function)
async function voteOnThread(threadId, vote) {
    const userUID = localStorage.getItem('userUID');
    if (!userUID || userUID === '0') {
        showLimitToast('⚠️ Sign in to vote!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/forum/threads/${threadId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userUID: parseInt(userUID),
                vote
            })
        });

        if (!response.ok) {
            const error = await response.json();
            showLimitToast(`⚠️ ${error.error}`);
            return;
        }

        const result = await response.json();
        showLimitToast('✅ Vote recorded!');
    } catch (error) {
        console.error('Error voting:', error);
        showLimitToast('❌ Failed to vote');
    }
}

// Submit comment
async function submitComment(event) {
    event.preventDefault();
    
    const text = document.getElementById('commentInput').value.trim();
    const userUID = localStorage.getItem('userUID');
    const username = localStorage.getItem('username');

    if (!userUID || userUID === '0') {
        showLimitToast('⚠️ Sign in to comment!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/forum/threads/${currentThreadId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userUID: parseInt(userUID),
                username,
                text
            })
        });

        if (!response.ok) throw new Error('Failed to post comment');
        
        document.getElementById('commentInput').value = '';
        showLimitToast('✅ Comment posted!');
        await loadComments(currentThreadId);
    } catch (error) {
        console.error('Error posting comment:', error);
        showLimitToast('❌ Failed to post comment');
    }
}

// Upvote comment
async function upvoteComment(commentId) {
    const userUID = localStorage.getItem('userUID');
    if (!userUID || userUID === '0') {
        showLimitToast('⚠️ Sign in to upvote!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/forum/threads/${currentThreadId}/comments/${commentId}/upvote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userUID: parseInt(userUID)
            })
        });

        if (!response.ok) {
            const error = await response.json();
            showLimitToast(`⚠️ ${error.error}`);
            return;
        }

        showLimitToast('✅ Upvoted!');
        await loadComments(currentThreadId);
    } catch (error) {
        console.error('Error upvoting:', error);
        showLimitToast('❌ Failed to upvote');
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Toast notification function (if not already defined)
function showLimitToast(message) {
    if (window.showLimitToast) {
        window.showLimitToast(message);
    } else {
        alert(message);
    }
}
