# Spelling Practice

A static HTML/CSS/vanilla-JS spelling quiz. The app says a word aloud, the
student spells it out loud and repeats the word, then taps **Show answer** to
check themselves and marks **Got it** / **Missed it**. Missed words can be
re-practiced at the end.

No build step, no dependencies. Speech uses the browser's built-in
`speechSynthesis` (works in Chrome, Edge, Safari, and on iOS/Android).

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Styles (light/dark, phone-friendly) |
| `app.js` | Quiz logic and speech |
| `words.js` | Word lists: 2026–2027 Scripps School Spelling Bee study list (One, Two, Three Bee — 150 words each) |
| `info.js` | Part of speech, definition, and example sentence for every study-list word |
| `audio/` | 1,350 recorded MP3s (word, definition, sentence for each study-list word) |
| `audio-script.json` / `.csv` | The text and file name for every clip |
| `generate-audio.py` | Makes the clips from `audio-script.json` with edge-tts |

The app plays the recorded clips for every study-list word, including study-list
words typed into "My list". The browser's own voice is only a backup: it spells
out the letters and reads words that have no recording. The speed slider also
speeds up or slows down the clips; the default speed plays them as recorded.

To re-record clips: edit the `_tts` text in `audio-script.json`, delete those MP3s
from `audio/`, and run `python generate-audio.py` (it skips files that already exist).

Before showing the answer, the student can tap **Definition** or **Sentence**
(or press D / S). Like at a real bee, the app reads the definition or sentence
and then says the word again. Both are shown with the answer.

"My list" format, one word per line. Everything after the word is optional:

```
because | I stayed inside because it was raining. | for the reason that
fertilizer OR fertiliser
```

If a "My list" word has no definition or sentence, the app looks it up in the
free online dictionary at dictionaryapi.dev, which needs an internet connection
and doesn't always have an example sentence.

The start screen picks a level (One / Two / Three Bee, All, or My list) and how
many words (10 / 20 / 50 / all). "My list" is edited in the app under
**⚙︎ Words** and is saved in that browser only.

Note: the browser's built-in voice can mispronounce harder words
(e.g. *duende*, *Krio*, *spes phthisica*) and can't tell heteronyms like
*lead* apart. Check tricky ones against Merriam-Webster or the Word Club app.

## Deploy to GitHub Pages

1. Create a new public repo on GitHub (e.g. `spelling-practice`).
2. Upload these four files to the repo root (Add file → Upload files).
3. Settings → Pages → Source: **Deploy from a branch**, Branch: `main` / `root`.
4. After a minute it is live at `https://<your-username>.github.io/spelling-practice/`.

To run locally: `python3 -m http.server` in this folder and open
http://localhost:8000 (opening `index.html` directly also works).

## Roadmap: an AI version that listens and grades

See the notes in the chat summary; short version:

1. **Capture** — `getUserMedia` + `MediaRecorder` to record the attempt
   (needs HTTPS, which GitHub Pages provides).
2. **Transcribe letters** — this is the hard part. General speech
   recognizers turn "b-e-c-a-u-s-e" into words like "be see a use". Options:
   - Web Speech API `SpeechRecognition` (free, Chrome/Safari, but sends
     audio to Google/Apple and is poor at letter sequences).
   - **Whisper (tiny/base) in the browser** via Transformers.js + WebGPU/WASM —
     open source, on-device, private. Prompt it with
     "Spelling: B E C A U S E" style context to bias toward letters.
   - **Gemma 3n** (multimodal, audio input, designed for phones) via
     Google's MediaPipe LLM Inference API / LiteRT on web — can take the audio
     plus the target word and return a structured judgement.
3. **Normalize** — map heard tokens to letters ("bee"→B, "see/sea"→C,
   "you"→U, "double l"→LL, "why"→Y) before comparing.
4. **Grade** — compare to the target letter-by-letter (edit distance) and
   highlight the first wrong letter. Keep a "teacher override" button.
5. **Track** — store per-word history and resurface missed words
   (spaced repetition).
