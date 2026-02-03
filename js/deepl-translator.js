/* =========================================
   DEEPL TRANSLATION FRAMEWORK
   Live translation using DeepL API
   ========================================= */

class DeepLTranslator {
    constructor() {
        this.useBackend = true;
        this.apiKey = localStorage.getItem('deeplApiKey') || '';
        this.apiEndpoint = localStorage.getItem('deeplApiEndpoint') || 'https://api-free.deepl.com/v2/translate';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.backendEndpoint = isLocal ? 'http://localhost:3000/translate' : '/translate';
        this.sourceLanguage = 'EN'; // Default source
        this.targetLanguage = localStorage.getItem('targetLanguage') || 'EN';
        this.cache = {}; // Cache translations to reduce API calls
        this.isTranslating = false;
        this.translateTimer = null;
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
        if (this.useBackend) return true;
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

        const targetLang = String(options.targetLang || this.targetLanguage || 'EN').toUpperCase();
        const sourceLang = options.sourceLang || this.sourceLanguage;

        // Check cache
        const cacheKey = `${sourceLang}:${targetLang}:${text}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            if (this.useBackend) {
                const sourcePayload = sourceLang && String(sourceLang).toUpperCase() !== 'AUTO'
                    ? String(sourceLang).toUpperCase()
                    : undefined;

                const response = await fetch(this.backendEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        target_lang: targetLang,
                        source_lang: sourcePayload
                    })
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error('DeepL proxy error body:', errorBody);
                    throw new Error(`DeepL proxy error: ${response.status}`);
                }

                const data = await response.json();
                const translatedText = data.translations?.[0]?.text || text;
                if (this.isRefusalTranslation(translatedText)) {
                    return text;
                }
                this.cache[cacheKey] = translatedText;
                return translatedText;
            }

            const params = new URLSearchParams({
                text: text,
                target_lang: targetLang
            });

            if (sourceLang && sourceLang !== 'AUTO') {
                params.append('source_lang', sourceLang);
            }

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            if (!response.ok) {
                throw new Error(`DeepL API error: ${response.status}`);
            }

            const data = await response.json();
            const translatedText = data.translations[0].text;
            if (this.isRefusalTranslation(translatedText)) {
                return text;
            }

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

        const targetLang = String(options.targetLang || this.targetLanguage || 'EN').toUpperCase();
        const sourceLang = options.sourceLang || this.sourceLanguage;

        try {
            if (this.useBackend) {
                const sourcePayload = sourceLang && String(sourceLang).toUpperCase() !== 'AUTO'
                    ? String(sourceLang).toUpperCase()
                    : undefined;

                const response = await fetch(this.backendEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: texts,
                        target_lang: targetLang,
                        source_lang: sourcePayload
                    })
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error('DeepL proxy error body:', errorBody);
                    throw new Error(`DeepL proxy error: ${response.status}`);
                }

                const data = await response.json();
                return (data.translations || []).map((t, idx) => {
                    const candidate = t.text;
                    return this.isRefusalTranslation(candidate) ? texts[idx] : candidate;
                });
            }

            const params = new URLSearchParams();
            texts.forEach(text => params.append('text', text));
            params.append('target_lang', targetLang);
            if (sourceLang && sourceLang !== 'AUTO') {
                params.append('source_lang', sourceLang);
            }

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            if (!response.ok) {
                throw new Error(`DeepL API error: ${response.status}`);
            }

            const data = await response.json();
            return data.translations.map((t, idx) => {
                const candidate = t.text;
                return this.isRefusalTranslation(candidate) ? texts[idx] : candidate;
            });
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

    normalizeTargetLanguage(lang) {
        const map = {
            en: 'EN',
            ru: 'RU',
            kz: 'RU'
        };
        return map[String(lang || '').toLowerCase()] || 'EN';
    }

    shouldTranslateText(text) {
        const trimmed = String(text || '').trim();
        if (!trimmed) return false;
        if (trimmed.length < 2) return false;
        if (!/[A-Za-zА-Яа-яЁё]/.test(trimmed)) return false;
        return true;
    }

    async translateTextNodes(root = document.body, options = {}) {
        if (!root || this.isTranslating) return;
        this.isTranslating = true;

        try {
            const nodes = [];
            const texts = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    const tag = parent.tagName;
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'].includes(tag)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (parent.closest('[data-no-translate], .no-translate')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const originalText = node.__deeplOriginalText ?? node.nodeValue;
                    if (!this.shouldTranslateText(originalText)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            let current;
            while ((current = walker.nextNode())) {
                const originalText = current.__deeplOriginalText ?? current.nodeValue;
                if (!current.__deeplOriginalText) {
                    current.__deeplOriginalText = current.nodeValue;
                }
                nodes.push(current);
                texts.push(originalText);
            }

            const chunkSize = 40;
            for (let i = 0; i < texts.length; i += chunkSize) {
                const chunkTexts = texts.slice(i, i + chunkSize);
                const translated = await this.translateBatch(chunkTexts, {
                    targetLang: options.targetLang || this.targetLanguage,
                    sourceLang: options.sourceLang || 'AUTO'
                });

                translated.forEach((text, idx) => {
                    const node = nodes[i + idx];
                    if (node) node.nodeValue = text;
                });
            }
        } finally {
            this.isTranslating = false;
        }
    }

    resetTextNodes(root = document.body) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let current;
        while ((current = walker.nextNode())) {
            if (current.__deeplOriginalText !== undefined) {
                current.nodeValue = current.__deeplOriginalText;
            }
        }
    }

    isRefusalTranslation(text) {
        const normalized = String(text || '').trim().toLowerCase();
        return normalized === 'извините, но я не могу вам в этом помочь.'
            || normalized === 'извините, но я не могу вам помочь.';
    }

    async translatePageAuto() {
        if (!this.isConfigured()) return;
        const userLang = localStorage.getItem('userLanguage') || 'en';
        const target = this.normalizeTargetLanguage(userLang);
        if (target === 'EN') {
            this.resetTextNodes();
            return;
        }

        this.setTargetLanguage(target);
        await this.translateTextNodes(document.body, { targetLang: target, sourceLang: 'AUTO' });
    }

    scheduleAutoTranslate(delayMs = 500) {
        if (this.translateTimer) clearTimeout(this.translateTimer);
        this.translateTimer = setTimeout(() => {
            this.translatePageAuto();
        }, delayMs);
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

window.addEventListener('languageChanged', (event) => {
    const targetLang = deepLTranslator.normalizeTargetLanguage(event.detail.language);
    if (targetLang === 'EN') {
        deepLTranslator.resetTextNodes();
        return;
    }
    deepLTranslator.setTargetLanguage(targetLang);
    deepLTranslator.scheduleAutoTranslate(250);
});

document.addEventListener('DOMContentLoaded', () => {
    deepLTranslator.scheduleAutoTranslate(500);
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
