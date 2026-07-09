# Handwriting Check Policy

## Response Contract

`HandwritingCheckService` expects Gemini to return JSON only.

```json
{
  "isPenHandwriting": true,
  "text": "recognized handwriting body",
  "similarityScore": 98,
  "scriptureReference": "잠언 4:23",
  "confidence": "high",
  "notes": "short explanation"
}
```

`text` must contain only the handwritten body used for comparison. Scripture
references, printed translations, and helper text belong in
`scriptureReference` or `notes`, not in `text`.

## Similarity Score Guide

- `95-100`: same text, with only punctuation or spacing differences.
- `85-94`: same passage, with minor omitted or extra characters.
- `60-84`: recognizable passage, but meaningful words are missing, added, or reordered.
- `1-59`: weak match or likely different passage.
- `null`: image cannot be read as pen handwriting, Gemini did not provide a numeric score, or the response was malformed.

The service clamps numeric scores to `0-100`. Non-numeric scores are treated as
`null` instead of being coerced.

## Defensive Cases

- Missing Gemini text content returns a low-confidence null result.
- Non-JSON Gemini text returns a low-confidence null result with the raw text in
  `notes`.
- Malformed optional fields are normalized to `null`.
- Unknown confidence values fall back to `low`.
- Scripture references are accepted only as non-empty strings.

## Regression Samples

Use `public/img_test/handwriting_test.jpg` as the current smoke sample. The
expected behavior is:

- `text`: Korean handwritten body only.
- `scriptureReference`: `잠언 4:23`.
- `similarityScore`: high 90s when only punctuation differs.
