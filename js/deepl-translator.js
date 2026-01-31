/* =========================================
   DEEPL TRANSLATION FRAMEWORK
   Live translation using DeepL API
   ========================================= */

class DeepLTranslator {
    constructor() {
        this.apiKey = localStorage.getItem('deeplApiKey') || '';
        this.apiEndpoint = localStorage.getItem('deeplApiEndpoint') || 'https://api-free.deepl.com/v2/translate';
        this.sourceLanguage = 'EN'; // Default source
        this.targetLanguage = localStorage.getItem('targetLanguage') || 'EN';
        this.cache = {}; // Cache translations to reduce API calls
    }

    // Set API key and optionally endpoint (for pro users)
    setApiKey(key, isPro = false) {
        this.apiKey = key;
        localStorage.setItem('deeplApiKey', key);
        
        // Set endpoint based on subscription type
        const endpoint = isPro 
            ? 'https://api.deepl.com/v2/translate'
            : 'https://api-free.deepl.com/v2/translate';
        this.apiEndpoint = endpoint;
        localStorage.setItem('deeplApiEndpoint', endpoint);
    }

    // Get API key
    getApiKey() {
        return this.apiKey;
    }

    // Check if API key is configured
    isConfigured() {
        return this.apiKey && this.apiKey.length > 0;
    }

    // Set target language
    setTargetLanguage(lang) {
        this.targetLanguage = lang;
        localStorage.setItem('targetLanguage', lang);
    }

    // Get target language
    getTargetLanguage() {
        return this.targetLanguage;
    }

    // Translate text
    async translate(text, options = {}) {
        if (!this.isConfigured()) {
            console.warn('DeepL API key not configured');
            return text; // Return original text
        }

        if (!text || text.trim() === '') {
            return text;
        }

        const targetLang = options.targetLang || this.targetLanguage;
        const sourceLang = options.sourceLang || this.sourceLanguage;

        // Check cache
        const cacheKey = `${sourceLang}:${targetLang}:${text}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    text: text,
                    target_lang: targetLang,
                    source_lang: sourceLang
                })
            });

            if (!response.ok) {
                throw new Error(`DeepL API error: ${response.status}`);
            }

            const data = await response.json();
            const translatedText = data.translations[0].text;

            // Cache the translation
            this.cache[cacheKey] = translatedText;

            return translatedText;
        } catch (error) {
            console.error('Translation error:', error);
            return text; // Return original text on error
        }
    }

    // Translate multiple texts
    async translateBatch(texts, options = {}) {
        if (!this.isConfigured() || !texts || texts.length === 0) {
            return texts;
        }

        const targetLang = options.targetLang || this.targetLanguage;
        const sourceLang = options.sourceLang || this.sourceLanguage;

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    text: texts,
                    target_lang: targetLang,
                    source_lang: sourceLang
                })
            });

            if (!response.ok) {
                throw new Error(`DeepL API error: ${response.status}`);
            }

            const data = await response.json();
            return data.translations.map(t => t.text);
        } catch (error) {
            console.error('Batch translation error:', error);
            return texts; // Return original texts on error
        }
    }

    // Translate DOM element
    async translateElement(element, options = {}) {
        if (!element) return;

        const originalText = element.getAttribute('data-original-text') || element.textContent;
        
        // Store original text for future reference
        if (!element.hasAttribute('data-original-text')) {
            element.setAttribute('data-original-text', originalText);
        }

        const translatedText = await this.translate(originalText, options);
        element.textContent = translatedText;
    }

    // Translate all elements with data-translate attribute
    async translatePage() {
        if (!this.isConfigured()) {
            console.warn('DeepL API key not configured. Skipping translation.');
            return;
        }

        const elements = document.querySelectorAll('[data-translate]');
        const promises = [];

        elements.forEach(element => {
            promises.push(this.translateElement(element));
        });

        await Promise.all(promises);
    }

    // Reset to original language
    resetPage() {
        const elements = document.querySelectorAll('[data-original-text]');
        elements.forEach(element => {
            element.textContent = element.getAttribute('data-original-text');
        });
    }

    // Get supported languages
    getSupportedLanguages() {
        return {
            'BG': 'Bulgarian',
            'CS': 'Czech',
            'DA': 'Danish',
            'DE': 'German',
            'EL': 'Greek',
            'EN': 'English',
            'ES': 'Spanish',
            'ET': 'Estonian',
            'FI': 'Finnish',
            'FR': 'French',
            'HU': 'Hungarian',
            'ID': 'Indonesian',
            'IT': 'Italian',
            'JA': 'Japanese',
            'KO': 'Korean',
            'LT': 'Lithuanian',
            'LV': 'Latvian',
            'NB': 'Norwegian',
            'NL': 'Dutch',
            'PL': 'Polish',
            'PT': 'Portuguese',
            'RO': 'Romanian',
            'RU': 'Russian',
            'SK': 'Slovak',
            'SL': 'Slovenian',
            'SV': 'Swedish',
            'TR': 'Turkish',
            'UK': 'Ukrainian',
            'ZH': 'Chinese'
        };
    }
}

// Create global instance
const deepLTranslator = new DeepLTranslator();

// Export to window for easy access
window.deepLTranslator = deepLTranslator;

// Auto-translate on language change event
window.addEventListener('targetLanguageChanged', (event) => {
    const targetLang = event.detail.language;
    deepLTranslator.setTargetLanguage(targetLang);
    deepLTranslator.translatePage();
});

// Helper function to translate specific text
window.translateText = async function(text, targetLang) {
    return await deepLTranslator.translate(text, { targetLang });
};

// Helper function to enable/disable translation
window.toggleTranslation = function(enabled) {
    if (enabled && deepLTranslator.isConfigured()) {
        deepLTranslator.translatePage();
    } else {
        deepLTranslator.resetPage();
    }
};

console.log('✅ DeepL Translation Framework loaded');
console.log('💡 Configure API key in Settings to enable live translation');
console.log('🌐 Use window.translateText(text, targetLang) to translate text');
console.log('🔄 Use window.toggleTranslation(enabled) to toggle page translation');
