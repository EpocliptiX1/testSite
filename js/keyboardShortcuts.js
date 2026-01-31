/* =========================================
   KEYBOARD SHORTCUTS FOR POWER USERS
   ========================================= */

const KeyboardShortcuts = {
    // Shortcut mappings
    shortcuts: {
        // Navigation
        'h': () => window.location.href = '/html/indexMain.html',
        'Home': () => window.location.href = '/html/indexMain.html',
        'm': () => window.location.href = '/html/allMovies.html',
        'l': () => window.location.href = '/html/personalList.html',
        'p': () => window.location.href = '/html/customPlaylists.html',
        
        // Search
        '/': () => {
            const searchInput = document.getElementById('mainSearch');
            if (searchInput) {
                searchInput.focus();
            }
        },
        'Escape': () => {
            // Close modals
            if (window.closeMovie) window.closeMovie();
            if (window.closeSignupModal) window.closeSignupModal();
            if (window.closeSettings) window.closeSettings();
            if (window.closeRedirectModal) window.closeRedirectModal();
            
            // Blur search
            const searchInput = document.getElementById('mainSearch');
            if (searchInput && document.activeElement === searchInput) {
                searchInput.blur();
            }
        },
        
        // Theme toggle
        't': () => {
            if (window.toggleSiteTheme) window.toggleSiteTheme();
        },
        
        // Language toggle
        'Shift+L': () => {
            const langs = ['en', 'ru', 'kz'];
            const currentLang = window.i18n.getCurrentLanguage();
            const currentIndex = langs.indexOf(currentLang);
            const nextLang = langs[(currentIndex + 1) % langs.length];
            if (window.selectLanguage) window.selectLanguage(nextLang);
        },
        
        // Hero slider navigation
        'ArrowLeft': () => {
            if (window.prevSlide && !isInputFocused()) window.prevSlide();
        },
        'ArrowRight': () => {
            if (window.nextSlide && !isInputFocused()) window.nextSlide();
        },
        
        // Account menu
        'a': () => {
            if (window.toggleAccountMenu) window.toggleAccountMenu();
        },
        
        // Settings
        ',': () => {
            if (window.openSettings) window.openSettings();
        },
        
        // Sign in/Sign up
        's': () => {
            if (window.openSignInModal) window.openSignInModal();
        },
        'Shift+S': () => {
            if (window.openSignupModal) window.openSignupModal();
        },
        
        // Help dialog
        '?': () => {
            showKeyboardShortcuts();
        },
        
        // Refresh/Reload
        'r': () => {
            if (!isInputFocused()) {
                window.location.reload();
            }
        }
    },
    
    // Initialize keyboard shortcuts
    init() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (isInputFocused() && !['Escape', 'Enter'].includes(e.key)) {
                return;
            }
            
            // Build key combination
            let key = e.key;
            if (e.shiftKey && key.length === 1) {
                key = 'Shift+' + key.toUpperCase();
            }
            
            // Execute shortcut if exists
            if (this.shortcuts[key]) {
                e.preventDefault();
                this.shortcuts[key]();
            }
        });
        
        console.log('⌨️ Keyboard shortcuts enabled. Press ? for help.');
    }
};

// Helper function to check if input is focused
function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );
}

// Show keyboard shortcuts help
function showKeyboardShortcuts() {
    const helpModal = document.createElement('div');
    helpModal.className = 'shortcuts-modal-overlay';
    helpModal.innerHTML = `
        <div class="shortcuts-content">
            <span class="close-shortcuts" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>⌨️ Keyboard Shortcuts</h2>
            
            <div class="shortcuts-grid">
                <div class="shortcuts-section">
                    <h3>Navigation</h3>
                    <div class="shortcut-item">
                        <kbd>H</kbd> or <kbd>Home</kbd>
                        <span>Go to Home</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>M</kbd>
                        <span>Go to Movies</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>L</kbd>
                        <span>Go to My List</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>P</kbd>
                        <span>Go to Playlists</span>
                    </div>
                </div>
                
                <div class="shortcuts-section">
                    <h3>Actions</h3>
                    <div class="shortcut-item">
                        <kbd>/</kbd>
                        <span>Focus Search</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>Close Modal/Unfocus</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>T</kbd>
                        <span>Toggle Theme</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Shift+L</kbd>
                        <span>Cycle Language</span>
                    </div>
                </div>
                
                <div class="shortcuts-section">
                    <h3>Hero Slider</h3>
                    <div class="shortcut-item">
                        <kbd>←</kbd>
                        <span>Previous Slide</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>→</kbd>
                        <span>Next Slide</span>
                    </div>
                </div>
                
                <div class="shortcuts-section">
                    <h3>Account</h3>
                    <div class="shortcut-item">
                        <kbd>A</kbd>
                        <span>Toggle Account Menu</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>,</kbd>
                        <span>Open Settings</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>S</kbd>
                        <span>Sign In</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Shift+S</kbd>
                        <span>Sign Up</span>
                    </div>
                </div>
                
                <div class="shortcuts-section">
                    <h3>Other</h3>
                    <div class="shortcut-item">
                        <kbd>R</kbd>
                        <span>Refresh Page</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>?</kbd>
                        <span>Show This Help</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(helpModal);
    
    // Close on click outside
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.remove();
        }
    });
}

// Styles for shortcuts modal
const shortcutsStyles = document.createElement('style');
shortcutsStyles.textContent = `
.shortcuts-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--overlay-bg, rgba(0, 0, 0, 0.85));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
}

.shortcuts-content {
    background: var(--bg-card, #111);
    color: var(--text-primary, #fff);
    padding: 40px;
    border-radius: 12px;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: var(--shadow-lg, 0 8px 16px rgba(0, 0, 0, 0.5));
}

.close-shortcuts {
    position: absolute;
    top: 20px;
    right: 20px;
    font-size: 2rem;
    cursor: pointer;
    color: var(--text-muted, #888);
    transition: color 0.2s;
}

.close-shortcuts:hover {
    color: var(--text-primary, #fff);
}

.shortcuts-content h2 {
    margin: 0 0 30px 0;
    font-size: 1.8rem;
}

.shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
}

.shortcuts-section h3 {
    margin: 0 0 15px 0;
    color: var(--accent-primary, #ff6b00);
    font-size: 1.1rem;
    border-bottom: 2px solid var(--border-color, #333);
    padding-bottom: 8px;
}

.shortcut-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    color: var(--text-secondary, #ccc);
}

.shortcut-item kbd {
    background: var(--bg-tertiary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: monospace;
    font-size: 0.9rem;
    min-width: 40px;
    text-align: center;
    box-shadow: 0 2px 0 var(--border-color, #333);
}

.shortcut-item span {
    flex: 1;
}

@media (max-width: 768px) {
    .shortcuts-content {
        padding: 20px;
        max-width: 95%;
    }
    
    .shortcuts-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
}
`;
document.head.appendChild(shortcutsStyles);

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KeyboardShortcuts.init());
} else {
    KeyboardShortcuts.init();
}

// Export for use in other scripts
window.KeyboardShortcuts = KeyboardShortcuts;
window.showKeyboardShortcuts = showKeyboardShortcuts;

console.log('✅ Keyboard shortcuts loaded');
