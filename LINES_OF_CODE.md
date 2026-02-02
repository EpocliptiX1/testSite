# Lines of Code Report - testSite Project

*Last Updated: 2026-02-02*

## Categorization by File Type

### CSS Files (Total Lines: 5,143)
| Lines | File Path |
|------:|-----------|
| 3,809 | `./css/style.css` |
| 778 | `./css/theme-enhancements.css` |
| 556 | `./css/forum.css` |

### JavaScript Files (Total Lines: 5,507)
| Lines | File Path |
|------:|-----------|
| 1,640 | `./js/mainPageControls.js` |
| 614 | `./js/customPlaylist.js` |
| 568 | `./js/i18n.js` |
| 557 | `./js/forum.js` |
| 453 | `./js/movieLoading.js` |
| 388 | `./js/enhancedSearch.js` |
| 384 | `./js/netflixFeatures.js` |
| 342 | `./js/keyboardShortcuts.js` |
| 304 | `./js/recommendations.js` |
| 241 | `./js/deepl-translator.js` |
| 233 | `./js/myList.js` |
| 221 | `./js/encryption.js` |
| 152 | `./js/allMovies.js` |
| 151 | `./js/theme.js` |

### HTML Files (Total Lines: 2,036)
| Lines | File Path |
|------:|-----------|
| 501 | `./html/indexMain.html` |
| 432 | `./html/movieInfo.html` |
| 351 | `./html/allMovies.html` |
| 320 | `./html/personalList.html` |
| 259 | `./html/searchQueryResult.html` |
| 149 | `./html/forum.html` |
| 123 | `./html/customPlaylists.html` |

### Backend Files (Total Lines: 1,168)
| Lines | File Path |
|------:|-----------|
| 1,168 | `./Backend/server.js` |

### Python Scripts (Total Lines: 120)
| Lines | File Path |
|------:|-----------|
| 69 | `./datasets/merge_movies.py` |
| 51 | `./datasets/fix_database.py` |

---

## Overall Summary

| Metric | Value |
|--------|------:|
| **Total Lines of Code** | **14,814** |
| **Total Script Files** | **27** |

### By Category

| Category | Lines | Percentage |
|----------|------:|-----------:|
| CSS Files | 5,143 | 34.7% |
| JavaScript Files | 5,507 | 37.2% |
| HTML Files | 2,036 | 13.8% |
| Backend (Node.js) | 1,168 | 7.9% |
| Python Scripts | 120 | 0.8% |
| Other | 840 | 5.6% |

### Top 5 Largest Files

1. `./css/style.css` - 3,809 lines
2. `./js/mainPageControls.js` - 1,640 lines
3. `./Backend/server.js` - 1,168 lines
4. `./css/theme-enhancements.css` - 778 lines
5. `./js/customPlaylist.js` - 614 lines

---

## How This Report Was Generated

This report was generated using the following command:

```bash
find . -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.py" -o -name "*.sql" -o -name "*.php" -o -name "*.java" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" \) ! -path "./.git/*" ! -path "*/node_modules/*" -exec wc -l {} + | sort -nr
```

To regenerate this report, run the above command from the project root directory.
