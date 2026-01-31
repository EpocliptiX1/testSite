/* =========================================
   CREDENTIAL ENCRYPTION SYSTEM
   Uses simple XOR cipher + Base64 for basic encryption
   Note: This is basic encryption for demo purposes.
   For production, use proper encryption libraries.
   ========================================= */

// Simple encryption key (in production, this should be more complex)
const ENCRYPTION_KEY = 'LegionSpace2026SecureKey!@#';

// XOR cipher for encryption/decryption
function xorCipher(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

// Encrypt text
function encrypt(text) {
    if (!text) return '';
    try {
        // Apply XOR cipher
        const xored = xorCipher(text, ENCRYPTION_KEY);
        // Encode to Base64
        return btoa(xored);
    } catch (error) {
        console.error('Encryption error:', error);
        return text; // Fallback to plain text if encryption fails
    }
}

// Decrypt text
function decrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
        // Decode from Base64
        const xored = atob(encryptedText);
        // Apply XOR cipher (XOR is reversible)
        return xorCipher(xored, ENCRYPTION_KEY);
    } catch (error) {
        console.error('Decryption error:', error);
        return encryptedText; // Fallback to original text if decryption fails
    }
}

// Enhanced encryption with salt (more secure)
function encryptWithSalt(text) {
    if (!text) return '';
    try {
        // Add random salt
        const salt = Math.random().toString(36).substring(2, 10);
        const saltedText = salt + text;
        
        // Apply XOR cipher
        const xored = xorCipher(saltedText, ENCRYPTION_KEY);
        
        // Encode to Base64
        return btoa(xored);
    } catch (error) {
        console.error('Encryption error:', error);
        return text;
    }
}

// Decrypt with salt
function decryptWithSalt(encryptedText) {
    if (!encryptedText) return '';
    try {
        // Decode from Base64
        const xored = atob(encryptedText);
        
        // Apply XOR cipher
        const saltedText = xorCipher(xored, ENCRYPTION_KEY);
        
        // Remove salt (first 8 characters)
        return saltedText.substring(8);
    } catch (error) {
        console.error('Decryption error:', error);
        return encryptedText;
    }
}

// Hash password (one-way hash for comparison)
function hashPassword(password) {
    if (!password) return '';
    
    // Simple hash function (for demo - use bcrypt/argon2 in production)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to hex and add some salt
    return Math.abs(hash).toString(16) + '_hashed';
}

// Secure storage wrapper
const SecureStorage = {
    // Store encrypted item
    setItem(key, value) {
        try {
            const encrypted = encryptWithSalt(value);
            localStorage.setItem(key, encrypted);
            return true;
        } catch (error) {
            console.error('SecureStorage.setItem error:', error);
            return false;
        }
    },
    
    // Retrieve and decrypt item
    getItem(key) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            return decryptWithSalt(encrypted);
        } catch (error) {
            console.error('SecureStorage.getItem error:', error);
            return null;
        }
    },
    
    // Remove item
    removeItem(key) {
        localStorage.removeItem(key);
    },
    
    // Store object (encrypted)
    setObject(key, obj) {
        try {
            const json = JSON.stringify(obj);
            return this.setItem(key, json);
        } catch (error) {
            console.error('SecureStorage.setObject error:', error);
            return false;
        }
    },
    
    // Retrieve object (decrypted)
    getObject(key) {
        try {
            const json = this.getItem(key);
            if (!json) return null;
            return JSON.parse(json);
        } catch (error) {
            console.error('SecureStorage.getObject error:', error);
            return null;
        }
    }
};

// Credential manager for user accounts
const CredentialManager = {
    // Save user credentials (encrypted)
    saveCredentials(email, password) {
        try {
            const credentials = {
                email: email,
                password: password, // Stored encrypted
                savedAt: new Date().toISOString()
            };
            
            SecureStorage.setObject('userCredentials', credentials);
            return true;
        } catch (error) {
            console.error('Failed to save credentials:', error);
            return false;
        }
    },
    
    // Get saved credentials (decrypted)
    getCredentials() {
        try {
            return SecureStorage.getObject('userCredentials');
        } catch (error) {
            console.error('Failed to get credentials:', error);
            return null;
        }
    },
    
    // Clear saved credentials
    clearCredentials() {
        SecureStorage.removeItem('userCredentials');
    },
    
    // Check if credentials are saved
    hasCredentials() {
        return this.getCredentials() !== null;
    },
    
    // Verify password (comparing hashes)
    verifyPassword(inputPassword, savedPasswordHash) {
        return hashPassword(inputPassword) === savedPasswordHash;
    }
};

// Export for use in other scripts
window.crypto_utils = {
    encrypt,
    decrypt,
    encryptWithSalt,
    decryptWithSalt,
    hashPassword,
    SecureStorage,
    CredentialManager
};

console.log('✅ Encryption utilities loaded');
