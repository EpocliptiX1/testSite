#!/usr/bin/env bash
set -euo pipefail

echo "Installing LibreTranslate..."
python3 -m pip install libretranslate

echo "Starting LibreTranslate on http://localhost:5000 ..."
if [[ -z "${LIBRETRANSLATE_LOAD_ONLY:-}" ]]; then
	export LIBRETRANSLATE_LOAD_ONLY="en,ru,kk"
fi
libretranslate --load-only "$LIBRETRANSLATE_LOAD_ONLY"
