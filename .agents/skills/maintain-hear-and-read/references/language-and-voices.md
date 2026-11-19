# Language and voice goals

Read for practice-language selection, voice discovery/ranking, locale changes or language/voice session preferences. For utterance lifecycle and pronunciation, use the speech section of the maintenance reference linked from SKILL.md.

- Offer exactly Hungarian (`hu`), Spanish (`es`) and German (`de`) as practice languages. Keep controls in English; do not imply translated UI or automatic text translation. Current website adapters import Hungarian and must return their language explicitly.
- Use only voices actually exposed by `speechSynthesis.getVoices()`. Handle asynchronous `voiceschanged`, an initially empty catalog, refresh, and unavailable saved choices. Never infer voice availability from browser brand or a cloud-service catalog.
- Prefer natural/neural, premium and enhanced metadata signals, then known real language-specific system families. Exclude novelty, eSpeak and MBROLA voices. Offer only the highest available tier, retaining dialect choices within that tier. Do not substitute another language or label a standard voice neural.
- Treat ranking as a heuristic: the browser has no measured quality score, and better sound does not guarantee word-boundary events. Local/default flags are tie breakers, not evidence of premium quality. Identify potentially online voices and provide preview plus install/refresh/recording guidance for standard-only or missing voices.
- Set utterance language to the chosen voice locale and use the practice locale for segmentation. Update reader/editor language attributes. Cancel obsolete speech, previews and shadowing on language changes without discarding custom text, unsaved drafts or recordings. Preserve alignment when words are unchanged; explicitly report any necessary timing reset.
- Replace only untouched demo text automatically when choosing another language. Save per-language voice choices and session language/voice preferences; legacy sessions default to Hungarian. An unavailable saved voice must degrade visibly to a matching Auto choice, never silently to another language.
- Test ranking, exclusions, dialects, metadata variants and legacy sessions with synthetic catalogs. Separately verify real exposed voices and browser UI behavior; fixture voices are not proof of audible quality or cloud availability.

