# Syllabus Calendar Performance Budgets

| Operation | Budget | Enforcement or measurement |
| --- | ---: | --- |
| Upload body | 10 MB | Rejected before extraction |
| Extracted PDF | 100 pages / 500,000 characters | Rejected before model submission |
| Gemini extraction | 60 seconds | Abort signal |
| Calendar provider request | 15 seconds per request | Abort signal |
| Import stages | PDF, model, persistence, total | `Server-Timing` response header |

Calendar bulk operations intentionally execute provider writes sequentially. This respects provider throttling and preserves an exact persisted result for every item. Import stage timings contain durations only and do not include filenames, syllabus text, user IDs, tokens, or model output.
