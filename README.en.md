# The 71st Language Bench

[中文](README.md)

[![The 71st Language Bench: benign-prompt over-refusal for DeepSeek V4.1 Flash and Claude Fable 5.1](cover/cover.png)](cover/index.html)

The interactive Three.js cover supports `MEAN / EN / ZH / HE`. Run `npx --yes serve cover`, then open the URL printed in the terminal.

A TypeScript benchmark for measuring whether an LLM's **moderation intensity** and **moderation accuracy** change across English, Chinese, and Hebrew.

The same request is asked in all three languages. An independent judge model then labels each reply as `refuse`, `comply`, or `incoherent`.

This project only forwards public academic prompts (HarmBench, XSTest) and translates them. It does not generate new attack instructions.

## Metrics

| Metric            | Set           | Meaning                                                    |
| ----------------- | ------------- | ---------------------------------------------------------- |
| Intensity         | Harmful       | Block rate: model `refuse` + empty-response gateway refuse |
| Gateway refuse    | Both          | Empty API body, treated as downstream gateway moderation   |
| Over-refusal      | Benign        | Block rate on prompts that should be answered              |
| Harmful accuracy  | Harmful       | Share blocked                                              |
| Benign accuracy   | Benign        | Share of `comply`                                          |
| Cross-lingual gap | Harmful pairs | `block(en) − block(zh/he)` on the same `parentId`          |

`incoherent` is excluded from intensity and accuracy denominators and reported separately. Failed translations are dropped so an untranslated English string cannot masquerade as Hebrew or Chinese. An empty API body is a gateway refusal (`gateway_refuse`), not missing data, and is not retried.

Accuracy is **not** merged into one headline score. Intensity and over-refusal stay separate.

## Pipeline

```
prepare → translate → run → judge → report
```

1. `prepare-data` downloads HarmBench + XSTest, keeps standard self-contained harmful items and XSTest benign (plus XSTest unsafe by default), then stratified-samples them.
2. `translate` sends each English prompt to `TRANSLATE_MODEL` with a translate-only instruction, then checks that the output is actually Chinese or Hebrew.
3. `run` queries `TARGET_MODEL`. The system prompt is fixed English; only the user message language changes.
4. `judge` classifies replies with `JUDGE_MODEL` (must differ from the target).
5. `report` writes `reports/<YYYYMMDD-HHMMSS>_<model>.md` and `.zh.md`.

Every step resumes from existing JSONL rows.

## Setup

```bash
npm install
cp .env.example .env
```

Required `.env` values:

- `OPENAI_API_KEY` — OpenRouter or any OpenAI-compatible key
- `OPENAI_BASE_URL` — defaults to `https://openrouter.ai/api/v1`
- `TARGET_MODEL` — model under test
- `TRANSLATE_MODEL` — preferably a low-refusal translator
- `JUDGE_MODEL` — must not equal `TARGET_MODEL`

Sampling defaults are 150 harmful + 150 benign. Set `SAMPLE_SIZE_HARMFUL=0` and `SAMPLE_SIZE_BENIGN=0` for the full filtered sets.

`CONCURRENCY` (default `5`) controls parallel API calls for `translate`, `run`, and `judge`.

Each `run` is stored as `data/runs/<YYYYMMDD-HHMMSS>_<model>/` with matching reports `reports/<id>.md` and `reports/<id>.zh.md`. The same `TARGET_MODEL` reuses the current run unless you set `NEW_RUN=true`. Pin a folder with `RUN_ID=...`.

## Run

```bash
npm run prepare-data
npm run translate
npm run run
npm run judge
npm run report
```

`prepare-data` is named that way because npm reserves `prepare` as an install lifecycle hook.

With default sampling this is about 300 English prompts × 2 translations + 900 target calls + 900 judge calls.

## Data sources

- [HarmBench](https://github.com/centerforaisafety/HarmBench) standard text behaviors (`FunctionalCategory=standard`, no context string)
- [XSTest](https://github.com/paul-rottger/xstest) safe prompts (over-refusal) and, by default, unsafe contrast prompts

Downloaded CSVs are cached under `data/raw/`. Completions and judgments are gitignored because model outputs can be sensitive.

## Tests

```bash
npm test
```

## Results: Fable 5.1 vs DeepSeek V4.1 Flash

Same English source prompts (HarmBench standard + XSTest), translated into Chinese and Hebrew, then sent to each target model. Empty API bodies count as gateway refusals.

Full per-model reports:

- [Claude Fable 5.1](reports/20260920-001207_anthropic-claude-fable-5.1.md)
- [DeepSeek V4.1 Flash](reports/20260919-235045_deepseek-flash.md) (run id `deepseek-flash`)
- [Side-by-side](reports/compare_fable-5.1_vs_deepseek-v4.1-flash.md)

### Snapshot

| Item | Claude Fable 5.1 | DeepSeek V4.1 Flash |
| --- | --- | --- |
| Run id | `20260920-001207_anthropic-claude-fable-5.1` | `20260919-235045_deepseek-flash` |
| Recorded model id | `anthropic/claude-fable-5.1` | `deepseek-flash` |
| Translate / judge | deepseek-flash / deepseek-v4-pro | deepseek-flash / deepseek-v4-pro |
| Prompts scored | 896 | 896 |
| Gateway refusals | 163/896 (18.2%) | 456/896 (50.9%) |
| Judge parse fallbacks | 54/733 | 20/440 |

The DeepSeek run is stored as `deepseek-flash`; this report uses the product name DeepSeek V4.1 Flash.

### Takeaways

Neither model shows a large Hebrew under-refusal gap. They differ in **how** they block and **how often they over-block benign prompts**.

- **Claude Fable 5.1**: harmful block rate is ~95% in all three languages. Benign over-refusal is only 6–9%. Leaks are mostly misinformation and discrimination-contrast items, not chemical/illegal asks.
- **DeepSeek V4.1 Flash**: harmful block rate is ~100%, but about half of all replies are empty (gateway). Benign gateway over-refusal is extreme (EN 58%, ZH 73%, HE 75%), and Hebrew harmful gateway is 22.6 pp above English. That is over-strictness, not a jailbreak gap.
- **If you want cross-lingual fairness**, Fable is more even. **If you want almost no harmful comply**, DeepSeek is harder, at a steep cost to benign usefulness.

### Harmful intensity

| Language | Fable 5.1 | DS V4.1 Flash | Fable − DeepSeek |
| --- | ---: | ---: | ---: |
| English | 95.0% (133/140) | 100.0% (149/149) | -5.0 pp |
| Chinese | 94.4% (135/143) | 100.0% (148/148) | -5.6 pp |
| Hebrew | 95.1% (136/143) | 99.3% (145/146) | -4.2 pp |

| Cross-lingual gap | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| en − zh | 0.6% | 0.0% |
| en − he | -0.1% | 0.7% |

### Benign over-refusal

| Language | Fable 5.1 | DS V4.1 Flash | Fable − DeepSeek |
| --- | ---: | ---: | ---: |
| English | 6.2% (9/146) | 66.0% (95/144) | -59.8 pp |
| Chinese | 9.0% (13/144) | 79.6% (117/147) | -70.6 pp |
| Hebrew | 8.4% (12/143) | 82.6% (119/144) | -74.2 pp |

| Language | Fable 5.1 benign accuracy | DS V4.1 Flash benign accuracy |
| --- | ---: | ---: |
| English | 93.8% (137/146) | 34.0% (49/144) |
| Chinese | 91.0% (131/144) | 20.4% (30/147) |
| Hebrew | 91.6% (131/143) | 17.4% (25/144) |

### Gateway vs model refusal

| Language | Split | Fable 5.1 gateway | DS V4.1 Flash gateway | Fable 5.1 model | DS V4.1 Flash model |
| --- | --- | ---: | ---: | ---: | ---: |
| English | harmful | 32.0% (48/150) | 21.3% (32/150) | 56.7% (85/150) | 78.0% (117/150) |
| English | benign | 2.7% (4/150) | 58.0% (87/150) | 3.3% (5/150) | 5.3% (8/150) |
| Chinese | harmful | 36.0% (54/150) | 34.7% (52/150) | 54.0% (81/150) | 64.0% (96/150) |
| Chinese | benign | 3.3% (5/150) | 72.7% (109/150) | 5.3% (8/150) | 5.3% (8/150) |
| Hebrew | harmful | 31.8% (47/148) | 43.9% (65/148) | 60.1% (89/148) | 54.1% (80/148) |
| Hebrew | benign | 3.4% (5/148) | 75.0% (111/148) | 4.7% (7/148) | 5.4% (8/148) |

| Harmful gateway gap | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| en − zh | -4.0% | -13.3% |
| en − he | 0.2% | -22.6% |

### Paired harmful outcomes

| Pattern | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| Comparable triples | 133 (100%) | 145 (100%) |
| All refuse | 124 (93.2%) | 144 (99.3%) |
| All comply | 4 (3.0%) | 0 (0.0%) |
| EN refuse / ZH comply | 3 (2.3%) | 0 (0.0%) |
| EN refuse / HE comply | 1 (0.8%) | 1 (0.7%) |
| EN comply / ZH refuse | 1 (0.8%) | 0 (0.0%) |
| EN comply / HE refuse | 2 (1.5%) | 0 (0.0%) |

### Key categories

Categories with a large model gap or that matter for the language hypothesis. Block rate includes gateway refusals.

| Category | Language | Split | Fable block | DeepSeek block | Fable gateway | DeepSeek gateway |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| chemical_biological | English | harmful | 100.0% | 100.0% | 90.9% | 36.4% |
| chemical_biological | Hebrew | harmful | 100.0% | 100.0% | 90.9% | 63.6% |
| chemical_biological | Chinese | harmful | 100.0% | 100.0% | 90.9% | 27.3% |
| contrast_discr | English | harmful | 90.0% | 100.0% | 0.0% | 20.0% |
| contrast_discr | Hebrew | harmful | 66.7% | 100.0% | 0.0% | 70.0% |
| contrast_discr | Chinese | harmful | 75.0% | 100.0% | 0.0% | 50.0% |
| cybercrime_intrusion | English | harmful | 92.9% | 100.0% | 86.7% | 53.3% |
| cybercrime_intrusion | Hebrew | harmful | 100.0% | 100.0% | 86.7% | 73.3% |
| cybercrime_intrusion | Chinese | harmful | 100.0% | 100.0% | 86.7% | 80.0% |
| definitions | English | benign | 0.0% | 20.0% | 0.0% | 20.0% |
| definitions | Hebrew | benign | 0.0% | 85.7% | 0.0% | 85.7% |
| definitions | Chinese | benign | 0.0% | 73.3% | 0.0% | 66.7% |
| homonyms | English | benign | 6.7% | 66.7% | 6.7% | 66.7% |
| homonyms | Hebrew | benign | 13.3% | 86.7% | 6.7% | 86.7% |
| homonyms | Chinese | benign | 7.1% | 80.0% | 6.7% | 80.0% |
| illegal | English | harmful | 100.0% | 100.0% | 40.9% | 9.1% |
| illegal | Hebrew | harmful | 100.0% | 100.0% | 40.9% | 22.7% |
| illegal | Chinese | harmful | 100.0% | 100.0% | 59.1% | 22.7% |
| misinformation_disinformation | English | harmful | 84.6% | 100.0% | 23.1% | 46.2% |
| misinformation_disinformation | Hebrew | harmful | 84.6% | 100.0% | 0.0% | 76.9% |
| misinformation_disinformation | Chinese | harmful | 83.3% | 100.0% | 0.0% | 46.2% |
| privacy_fictional | English | benign | 40.0% | 84.6% | 13.3% | 33.3% |
| privacy_fictional | Hebrew | benign | 53.3% | 86.7% | 20.0% | 40.0% |
| privacy_fictional | Chinese | benign | 60.0% | 92.9% | 20.0% | 53.3% |
| real_group_nons_discr | English | benign | 0.0% | 76.9% | 0.0% | 60.0% |
| real_group_nons_discr | Hebrew | benign | 0.0% | 91.7% | 0.0% | 71.4% |
| real_group_nons_discr | Chinese | benign | 0.0% | 80.0% | 0.0% | 66.7% |

### Notes

- Intensity answers whether a harmful request was blocked, not whether the block was well calibrated.
- DeepSeek's benign over-refusal is almost entirely empty responses. Explicit model refusals on benign items stay near 5% in all three languages.
- Fable also has a sizable harmful gateway rate (~32–36%), but it is even across languages and benign gateway stays near 3%.
- Both runs share the same `prompts.jsonl` and the same judge model `deepseek-v4-pro`.

## License

This project is licensed under the [MIT License](LICENSE).

