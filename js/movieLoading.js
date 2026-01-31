/* 
   Handles Movie Details Page population, Recommendations, and Global Trailer Fetching
*/
//
// 1. GLOBAL CONFIGURATION
window.YT_API_KEY = 'u';
let currentPlaylist = []; 
let activeTrailerIdx = -1; 
 
// 2. GLOBAL TRAILER FETCHER (Used by this file AND mainPageControls.js)
window.fetchYTId = async function(name) {
    const API_KEY = 'u'; 
    try {
        const query = encodeURIComponent(name + " official trailer");
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&maxResults=1&type=video&key=${API_KEY}`);
        const data = await res.json();
        return data.items?.[0]?.id?.videoId || "";
    } catch (e) {
        return "";
    }
}
// 3. PAGE INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    if (!movieId) return;

    try {
        const response = await fetch(`http://localhost:3000/movie/${movieId}`);
        const movie = await response.json();

        // HELPERS
        const cleanList = (str) => str ? String(str).replace(/[\[\]']/g, '').split(',').map(s => s.trim()) : [];
        const formatMoney = (v) => v > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v) : "N/A";

        // FILL UI ELEMENTS
        if(document.getElementById('posterImg')) document.getElementById('posterImg').src = movie.poster_full_url || '/img/placeholder.jpg';
        if(document.getElementById('bgBackdrop')) document.getElementById('bgBackdrop').style.backgroundImage = `url('${movie.poster_full_url}')`;
        
        document.getElementById('title').innerText = movie['Movie Name'] || movie.title || "Unknown";
        document.getElementById('rating').innerText = movie.Rating || movie.imdb_rating || "--";
        document.getElementById('runtime').innerText = movie.Runtime || "N/A";
        document.getElementById('plot').innerText = movie.Plot || movie.Overview || "No description available.";
        document.getElementById('genre').innerText = movie.Genre || "N/A";
        document.getElementById('votes').innerText = movie.Votes || "0";

        const movieYear = parseInt(String(movie.release_date || movie.Released_Year || "").match(/\d{4}/)?.[0]) || null;
        document.getElementById('year').innerText = movieYear || "----";

        // DIRECTORS & STARS
        const directors = cleanList(movie.Directors);
        const stars = cleanList(movie.Stars);
        const techContainer = document.getElementById('techSpecs');
        if (techContainer) {
            const year = parseInt(movieYear);
            const rating = parseFloat(movie.Rating);
            
            //definition of Era
            const isModern = year > 2015;
            const is90sOr2000s = year >= 1990 && year <= 2015;
            const isGoldenAge = year < 1990;

            // 1. Resolution Tag
            let resTag = isModern ? '4K ULTRA HD' : (is90sOr2000s ? 'FULL HD 1080P' : 'RESTORED HD');
            
            // 2. Audio Tag (IMAX didnt rlly exist in the 90s/2000s, Dolby Digital was more common)
            let audioTag = isModern ? 'DOLBY ATMOS' : (is90sOr2000s ? 'DTS-HD MASTER' : 'MONO / STEREO');

            // 3. Aspect Ratio (Animation vs Live Action)
            let aspectRatio = "2.39:1"; // Standard Widescreen
            if (movie.Genre && movie.Genre.includes("Animation") && year < 2000) aspectRatio = "1.66:1";
            if (isGoldenAge) aspectRatio = "1.37:1"; // Academy Ratio

            // 4. Special "Cinematography" Tags
            let specialTag = "";
            if (rating > 8.5 && isModern) specialTag = '<span class="tech-badge gold">IMAX ENHANCED</span>';
            else if (rating > 8.5 && !isModern) specialTag = '<span class="tech-badge gold">CRITERION COLLECTION</span>'; // Film nerd favorite!

            techContainer.innerHTML = `
                <span class="tech-badge">${resTag}</span>
                <span class="tech-badge">${audioTag}</span>
                <span class="tech-badge">ASPECT ${aspectRatio}</span>
                ${specialTag}
            `;
        }
        document.getElementById('directors').innerText = directors[0] || "N/A";
        document.getElementById('actors').innerText = stars.join(', ');

        // FINANCIALS
        const b = parseFloat(movie.budget) || 0;
        const r = parseFloat(movie.revenue) || 0;
        document.getElementById('budget').innerText = formatMoney(b);
        document.getElementById('revenue').innerText = formatMoney(r);

        const statusEl = document.getElementById('financialStatus');
        if (statusEl) {
            if (b > 0 && r > 0) {
                const perc = (((r - b) / b) * 100).toFixed(0);
                statusEl.innerHTML = r > b ? `<span style="color:#46d369;">+${perc}% (Hit)</span>` : `<span style="color:#ff4444;">${perc}% (Flop)</span>`;
            } else {
                statusEl.innerText = "Insufficient Data";
            }
        }

        // PREFILL REVIEW FIELDS (link reviews to this movie)
        const revMovieEl = document.getElementById('revMovie');
        if (revMovieEl) {
            revMovieEl.value = movie['Movie Name'] || movie.title || "";
            revMovieEl.readOnly = true;
        }
        const revMovieIdEl = document.getElementById('revMovieId');
        if (revMovieIdEl) revMovieIdEl.value = movieId;

        // TRIGGER TRAILER FINDER
        setupTrailerButton(movie['Movie Name'] || movie.title, movieYear);

        // START RECOMMENDATIONS
        initRecommendations(movie, movieYear, directors[0], stars);

    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

// 4. RECOMMENDATIONS LOGIC
async function initRecommendations(movie, movieYear, firstDirector, starsList) {
    const renderRow = (data, containerId, label) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (data.length === 0) {
            container.innerHTML = `<p style="color:#666; padding:20px;">No similar titles found.</p>`;
            return;
        }

        container.innerHTML = data.map(m => `
            <div class="mini-card" onclick="window.location.href='movieInfo.html?id=${m.ID}'">
                <img src="${m.poster_full_url}" onerror="this.src='/img/placeholder.jpg'">
                <div class="mini-info">
                    <h4>${m['Movie Name']}</h4>
                    <p>⭐ ${m.Rating || m.imdb_rating} (${m.Votes || 0})</p>
                    <p style="color:#f96d00; font-size:11px; font-weight:bold; margin-top:5px;">${label}</p>
                </div>
            </div>
        `).join('');

        if (containerId === 'genreRow') {
            buildPlaylist(document.getElementById('title').innerText);
        }
    };

    // Genre Row
    fetch(`http://localhost:3000/recommend/genre?genre=${encodeURIComponent(movie.Genre)}&exclude=${movie.ID}`)
        .then(r => r.json()).then(d => renderRow(d, 'genreRow', 'Similar Genre'));

    // Director Row
    if (firstDirector) {
        const dirTitle = document.getElementById('directorTitle');
        if(dirTitle) dirTitle.innerText = `More from ${firstDirector}`;
        fetch(`http://localhost:3000/recommend/director?val=${encodeURIComponent(firstDirector)}&exclude=${movie.ID}`)
            .then(r => r.json()).then(d => renderRow(d, 'directorRow', `Director: ${firstDirector}`));
    }

    // Actor Row
    const actorSelect = document.getElementById('actorSelect');
    if (actorSelect && starsList.length > 0) {
        actorSelect.innerHTML = starsList.map(name => `<option value="${name}">${name}</option>`).join('');
        
        const fetchActorRow = (name) => {
            const actTitle = document.getElementById('actorTitle');
            if(actTitle) actTitle.innerText = `More from ${name}`;
            fetch(`http://localhost:3000/recommend/actors?val=${encodeURIComponent(name)}&exclude=${movie.ID}`)
                .then(r => r.json()).then(d => renderRow(d, 'actorRow', `Starring ${name}`));
        };

        actorSelect.onchange = (e) => fetchActorRow(e.target.value);
        fetchActorRow(starsList[0]);
    }

    // Era Row
    if (movieYear) {
        fetch(`http://localhost:3000/recommend/timeline?year=${movieYear}&exclude=${encodeURIComponent(movie.ID)}`)
            .then(r => r.json()).then(d => {
                const eraTitle = document.getElementById('eraTitle');
                if(eraTitle) eraTitle.innerHTML = `Movies from ${movieYear - 5} - ${movieYear + 5}`;
                renderRow(d, 'timelineRow', 'Same Era');
            });
    }
}

// 5. TRAILER & PLAYLIST NAVIGATION
async function setupTrailerButton(movieName, movieYear) {
    const watchBtn = document.querySelector('.btn-watch');
    const modal = document.getElementById('trailerModal');
    const player = document.getElementById('trailerPlayer');
    
    if (!watchBtn || !modal || !player) return;

    // --- PRIORITY 1: CHECK ACCOUNT LIMITS ---
    const views = parseInt(localStorage.getItem('viewCount')) || 0;
    const tier = localStorage.getItem('userTier') || "Free";
    const limit = (tier === 'Gold') ? Infinity : (tier === 'Premium' ? 20 : 3);

    if (views >= limit) {
        watchBtn.innerText = "Limit Reached (Upgrade)";
        watchBtn.classList.add('btn-unavailable');
        watchBtn.onclick = () => alert("You've reached your daily limit! Upgrade to Gold for unlimited access.");
        return; 
    }

    // --- PRIORITY 2: CHECK YOUTUBE API ---
    watchBtn.innerText = "Searching...";
    watchBtn.classList.remove('btn-unavailable'); 

    try {
        const vId = await window.fetchYTId(`${movieName} ${movieYear}`);
        console.log("THE RAW ID IS:", vId, "TYPE:", typeof vId);


        if (!vId || (typeof vId === 'string' && vId.trim().length === 0)) {
            console.warn("⚠️ TRAILER NOT FOUND - Triggering Fallback");

            // 1. FORCE UNLOCK THE BUTTON (The Fix)
            watchBtn.disabled = false;              // Remove HTML disabled attribute
            watchBtn.style.pointerEvents = "auto";  // Override any CSS blocking clicks
            watchBtn.style.cursor = "pointer";      // Show hand cursor
            watchBtn.classList.remove('btn-unavailable');
            
            // 2. VISUAL FEEDBACK (Optional: Red Border to confirm it worked)
            watchBtn.innerText = "Search on YouTube ↗";
            watchBtn.style.backgroundColor = "#c4302b"; 

            // 3. NUCLEAR EVENT LISTENER (Clone the button to strip old listeners)
            // This prevents any other code from stopping the click
            const newBtn = watchBtn.cloneNode(true);
            watchBtn.parentNode.replaceChild(newBtn, watchBtn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Stop page jumps
                console.log("🔥 CLICK DETECTED - Opening YouTube...");
                
                const query = encodeURIComponent(`${movieName} ${movieYear} trailer`);
                window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
            });

            return;
        }

        // --- PRIORITY 3: ALL CLEAR (SUCCESS) ---
        watchBtn.innerText = "▶ Watch Trailer";
        watchBtn.classList.remove('btn-unavailable');
        watchBtn.style.backgroundColor = ""; // Reset color
        watchBtn.onclick = () => {
            const currentViews = parseInt(localStorage.getItem('viewCount')) || 0;
            if (currentViews >= limit) {
                alert("Limit reached! Please refresh.");
                return;
            }

            localStorage.setItem('viewCount', currentViews + 1);
            if (window.persistUserStats) window.persistUserStats();
            player.src = `https://www.youtube.com/embed/${vId}?autoplay=1&enablejsapi=1`;
            modal.classList.add('show');
            document.body.classList.add('blur-active');
            
            if (typeof activeTrailerIdx !== 'undefined') activeTrailerIdx = 0; 
            if (window.setupNavigation) window.setupNavigation();
        };

    } catch (err) {
        // === SCENARIO B: API CRASHED / NETWORK ERROR ===
        console.error("Trailer Logic Error:", err);
        
        watchBtn.innerText = "Search on YouTube ↗";
        watchBtn.classList.remove('btn-unavailable');
        watchBtn.style.backgroundColor = "#c4302b";

        watchBtn.onclick = () => {
            // FIXED: Added log here too
            console.log("Manual Fallback Triggered (Reason: API Error)");

            // FIXED: Changed 'movieTitle' to 'movieName'
            const query = encodeURIComponent(`${movieName} trailer`);
            window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
        };
    }   
}
// sets up there playlist based on genre row
function buildPlaylist(currentName) {
    const cards = Array.from(document.querySelectorAll('#genreRow .mini-card'));
    currentPlaylist = [{ name: currentName, id: null }];
    cards.forEach(card => {
        const titleElement = card.querySelector('h4');
        if(titleElement) currentPlaylist.push({ name: titleElement.innerText, id: null });
    });
}
// buttons for switching videos in the modal
function setupNavigation() {
    const nextBtn = document.getElementById('nextTrailer');
    const prevBtn = document.getElementById('prevTrailer');
    const player = document.getElementById('trailerPlayer');

    const changeVideo = async (offset) => {
        let newIdx = activeTrailerIdx + offset;
        if (newIdx < 0 || newIdx >= currentPlaylist.length) return;
        activeTrailerIdx = newIdx;
        const movie = currentPlaylist[activeTrailerIdx];
        
        if (!movie.id) {
            const btn = document.querySelector('.btn-watch');
            if (btn) btn.innerText = "Loading Next...";
            movie.id = await window.fetchYTId(movie.name);
            if (btn) btn.innerText = "▶ Watch Trailer";
        }
        
        if (movie.id) player.src = `https://www.youtube.com/embed/${movie.id}?autoplay=1&enablejsapi=1`;
    };

    if (nextBtn) nextBtn.onclick = () => changeVideo(1);
    if (prevBtn) prevBtn.onclick = () => changeVideo(-1);

    window.onmessage = (e) => {
        if (e.origin === "https://www.youtube.com") {
            try {
                const data = JSON.parse(e.data);
                if (data.event === "onStateChange" && data.info === 0) changeVideo(1);
            } catch (err) {}
        }
    };
}

// 6. MODAL CLOSING LOGIC
document.addEventListener('click', (e) => {
    const modal = document.getElementById('trailerModal');
    const player = document.getElementById('trailerPlayer');
    if (!modal || !player) return;
    if (e.target.classList.contains('close-modal') || e.target === modal) {
        modal.classList.remove('show');
        document.body.classList.remove('blur-active');
        player.src = ""; // Stop video on close
    }
});


async function loadReviews() {
    const container = document.getElementById('reviewsGrid');
    if (!container) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const pageMovieId = urlParams.get('id');
        const fetchUrl = pageMovieId ? `http://localhost:3000/reviews?movieId=${encodeURIComponent(pageMovieId)}` : 'http://localhost:3000/reviews';
        const res = await fetch(fetchUrl);
        let reviews = await res.json();

        // Client-side safeguard: filter out legacy reviews that lack movieId
        if (pageMovieId) {
            reviews = reviews.filter(r => r.movieId && String(r.movieId) === String(pageMovieId));
        }

        // 1. Create the "Add Review" Card 
        const addCardHTML = `
            <div class="review-card add-card" onclick="openReviewModal()">
                <div class="plus-icon">+</div>
                <h3>Write a Review</h3>
            </div>
        `;

        // 2. Generate the actual Reviews HTML
        const reviewsHTML = reviews.map(r => {
            const movieLabel = r.movieTitle || r.movie || 'Unknown';
            const movieHTML = r.movieId ? `<a href="movieInfo.html?id=${r.movieId}">${movieLabel}</a>` : movieLabel;
            return `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-pfp" 
                         style="width:40px; height:40px; border-radius:50%; background-color:#444; background-size:cover; background-position:center; ${r.pfp ? `background-image: url('${r.pfp}')` : ''}">
                    </div>
                    <div class="review-info">
                        <h4>${r.user}</h4>
                        <span class="stars">${"⭐".repeat(r.stars)}</span>
                    </div>
                </div>
                <div class="review-body">
                    <p>"${r.text}"</p>
                    <small>Watching: ${movieHTML}</small>
                </div>
            </div>
        `}).join('');

        //Combine 
        container.innerHTML = addCardHTML + reviewsHTML;
        
    } catch (err) {
        console.error("Failed to load reviews:", err);
    }
}

document.addEventListener('DOMContentLoaded', loadReviews);
window.openReviewModal = () => document.getElementById('reviewModal').classList.add('active');
window.closeReviewModal = () => document.getElementById('reviewModal').classList.remove('active');

window.submitReview = async function() {
    const user = localStorage.getItem('username') || "Guest";
    const userPFP = localStorage.getItem('userPFP');
    
    const textVal = document.getElementById('revText').value;
    const movieTitleVal = document.getElementById('revMovie') ? document.getElementById('revMovie').value : '';
    const movieIdVal = document.getElementById('revMovieId') ? document.getElementById('revMovieId').value : (new URLSearchParams(window.location.search)).get('id') || null;

    if (!movieTitleVal || !textVal) {
        showToast("Please fill out all fields!", true);
        return;
    }

    const data = {
        user: user,
        pfp: userPFP,
        movieTitle: movieTitleVal,
        movieId: movieIdVal,
        stars: parseInt(document.getElementById('revStars').value, 10) || 0,
        text: textVal
    };

    try {
        const res = await fetch('http://localhost:3000/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            // Close modal first
            if (typeof closeReviewModal === 'function') closeReviewModal();
            else {
                 // back if function missing
                 document.getElementById('reviewModal').classList.remove('active');
            }

            // Show success message
            showToast("Review Posted Successfully!");
            
            // Refresh reviews
            if(window.loadReviews) window.loadReviews(); 
        } else {
            showToast("Error posting review.", true);
        }
    } catch (err) {
        console.error(err);
        showToast("Server connection failed.", true);
    }
};
// Run on load
 
