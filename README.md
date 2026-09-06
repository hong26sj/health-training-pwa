# Health Training PWA

PeakWatch-style health/training dashboard MVP built as a standalone PWA.

## Goal
- Preserve the existing `workout-logger` repository unchanged.
- Reuse compatible Strength/Google Apps Script data contracts only where useful.
- Validate real-world usability on iPhone before deeper Pro-feature reverse specification.

## MVP scope
- Today dashboard: recovery, stress, body energy, training intensity, sleep, key vitals.
- Detail views for recovery, stress, body energy, training intensity and sleep.
- Health metrics overview.
- Training load overview (ATL/CTL/TSB placeholders until daily fitness aggregation is connected).
- Strength workout entry/recent history shell prepared for existing API integration.
- PWA manifest/service worker and local cache.

## Data modes
The first build includes a demo data adapter so the UI can be evaluated immediately. A Google Apps Script adapter is isolated in `js/data-source.js` for later connection to the existing Drive pipeline without coupling the UI to the old repository.

## Important
Do not commit Google Drive folder IDs, API keys, passwords or auth tokens to this repository.
