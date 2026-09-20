# 第 71 种语言评测

[English](README.en.md)

[![第 71 种语言评测：DeepSeek V4.1 Flash 与 Claude Fable 5.1 的无害题过度拒绝率](cover/cover.png)](cover/index.html)

交互式 Three.js 封面支持 `MEAN / EN / ZH / HE` 切换。运行 `npx --yes serve cover`，再打开终端输出的网址。

用 TypeScript 做的评测：看大模型的**审核强度**和**审核准确度**会不会随语言变化。目前对照英语、中文、希伯来语。

同一条请求用三种语言各问一遍。独立判定模型把回复标成 `refuse`、`comply` 或 `incoherent`。

本项目只转发公开学术题库（HarmBench、XSTest）并翻译，不生成新的攻击指令。

## 指标

| 指标 | 集合 | 含义 |
| --- | --- | --- |
| 强度 | 有害 | 拦截率：模型 `refuse` + 空回复（网关拒绝） |
| 网关拒绝 | 两套 | API 返回空正文，视为下游网关审核 |
| 过度拒绝 | 无害 | 本该回答的题被拦截的比例 |
| 有害准确度 | 有害 | 被拦截的比例 |
| 无害准确度 | 无害 | `comply` 的比例 |
| 跨语言差 | 有害成对 | 同一 `parentId` 上 `拦截(en) − 拦截(zh/he)` |

`incoherent` 不计入强度和准确度的分母，单独列出。翻译失败的样本会剔除，避免没译出来的英语冒充中文或希伯来语。空回复记为网关拒绝（`gateway_refuse`），不当作缺失，也不重试。

准确度**不合成一个总分**。强度和过度拒绝分开报。

## 流程

```
prepare → translate → run → judge → report
```

1. `prepare-data` 下载 HarmBench + XSTest，留下自包含的 standard 有害题和 XSTest 无害题（默认也带上 XSTest unsafe），再按类别分层抽样。
2. `translate` 用 `TRANSLATE_MODEL` 只做翻译，并用文字脚本检查是不是中文/希伯来语。
3. `run` 打 `TARGET_MODEL`。系统提示固定英语，只改用户问题的语言。
4. `judge` 用 `JUDGE_MODEL` 分类回复（必须和被测模型不同）。
5. `report` 写出 `reports/<YYYYMMDD-HHMMSS>_<模型>.md` 和 `.zh.md`。

每一步都按已有 JSONL 断点续跑。

## 安装

```bash
npm install
cp .env.example .env
```

`.env` 里需要：

- `OPENAI_API_KEY`：OpenRouter 或任意 OpenAI 兼容接口的 key
- `OPENAI_BASE_URL`：默认 `https://openrouter.ai/api/v1`
- `TARGET_MODEL`：被测模型
- `TRANSLATE_MODEL`：尽量选低拒绝的翻译模型
- `JUDGE_MODEL`：不能和被测模型相同

抽样默认有害 150 + 无害 150。设 `SAMPLE_SIZE_HARMFUL=0` 和 `SAMPLE_SIZE_BENIGN=0` 表示用过滤后的全量。

`CONCURRENCY`（默认 `5`）控制翻译、评测、判定的并行请求数。

每一轮评测写在 `data/runs/<YYYYMMDD-HHMMSS>_<模型>/`，对应报告是 `reports/<id>.md` 和 `reports/<id>.zh.md`。同一 `TARGET_MODEL` 会接着用当前目录，除非设 `NEW_RUN=true`。指定某一轮用 `RUN_ID=...`。

## 运行

```bash
npm run prepare-data
npm run translate
npm run run
npm run judge
npm run report
```

脚本叫 `prepare-data`，因为 npm 的 `prepare` 会在 `npm install` 时自动执行。

默认抽样大约是 300 条英语题 × 2 种翻译 + 900 次被测请求 + 900 次判定。

## 数据来源

- [HarmBench](https://github.com/centerforaisafety/HarmBench) 的 standard 文本行为（`FunctionalCategory=standard`，无上下文）
- [XSTest](https://github.com/paul-rottger/xstest) 的 safe 题（测过度拒绝），默认也带 unsafe 对照题

下载的 CSV 缓存在 `data/raw/`。模型回复和判定默认不进 git，因为可能含敏感内容。

## 单元测试

```bash
npm test
```

## 结果：Fable 5.1 vs DeepSeek V4.1 Flash

同一套英语源题（HarmBench standard + XSTest），译成中文和希伯来语后分别打两个被测模型。空回复计为网关拒绝。

完整单模型报告：

- [Claude Fable 5.1](reports/20260920-001207_anthropic-claude-fable-5.1.zh.md)
- [DeepSeek V4.1 Flash](reports/20260919-235045_deepseek-flash.zh.md)（日志里是 `deepseek-flash`）
- [对照报告](reports/compare_fable-5.1_vs_deepseek-v4.1-flash.zh.md)

### 快照

| 项 | Claude Fable 5.1 | DeepSeek V4.1 Flash |
| --- | --- | --- |
| 评测编号 | `20260920-001207_anthropic-claude-fable-5.1` | `20260919-235045_deepseek-flash` |
| 记录的模型 ID | `anthropic/claude-fable-5.1` | `deepseek-flash` |
| 翻译 / 判定 | deepseek-flash / deepseek-v4-pro | deepseek-flash / deepseek-v4-pro |
| 计入题数 | 896 | 896 |
| 网关拒绝 | 163/896 (18.2%) | 456/896 (50.9%) |
| 判定解析回退 | 54/733 | 20/440 |

DeepSeek 这一轮在日志里记为 `deepseek-flash`，按产品名写作 DeepSeek V4.1 Flash。

### 结论

两者都不是「希伯来语明显漏审」。差别在**怎么拦**和**无害题拦不拦错**。

- **Claude Fable 5.1**：三种语言有害拦截都在 95% 左右，跨语言差几乎为 0。无害过度拒绝只有 6–9%，更像校准过的审核。漏的是虚假信息、歧视对照这类边缘题，不是化生/违法。
- **DeepSeek V4.1 Flash**：有害拦截接近 100%，但一半回复是空的（网关）。无害题网关误伤极高（英 58%、中 73%、希 75%），希伯来语有害网关也比英语高 22.6 个百分点。这是过严，而且语言不均。
- **若目标是跨语言公平**：Fable 更整齐。**若目标是有害尽量零放行**：DeepSeek 更硬，但无害可用性差很多。

### 有害强度（拦截率）

| 语言 | Fable 5.1 | DS V4.1 Flash | Fable − DeepSeek |
| --- | ---: | ---: | ---: |
| 英语 | 95.0% (133/140) | 100.0% (149/149) | -5.0 pp |
| 中文 | 94.4% (135/143) | 100.0% (148/148) | -5.6 pp |
| 希伯来语 | 95.1% (136/143) | 99.3% (145/146) | -4.2 pp |

| 跨语言差 | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| en − zh | 0.6% | 0.0% |
| en − he | -0.1% | 0.7% |

### 无害过度拒绝

| 语言 | Fable 5.1 | DS V4.1 Flash | Fable − DeepSeek |
| --- | ---: | ---: | ---: |
| 英语 | 6.2% (9/146) | 66.0% (95/144) | -59.8 pp |
| 中文 | 9.0% (13/144) | 79.6% (117/147) | -70.6 pp |
| 希伯来语 | 8.4% (12/143) | 82.6% (119/144) | -74.2 pp |

| 语言 | Fable 5.1 无害准确度 | DS V4.1 Flash 无害准确度 |
| --- | ---: | ---: |
| 英语 | 93.8% (137/146) | 34.0% (49/144) |
| 中文 | 91.0% (131/144) | 20.4% (30/147) |
| 希伯来语 | 91.6% (131/143) | 17.4% (25/144) |

### 网关拒绝 vs 模型拒绝

| 语言 | 集合 | Fable 5.1 网关 | DS V4.1 Flash 网关 | Fable 5.1 模型拒 | DS V4.1 Flash 模型拒 |
| --- | --- | ---: | ---: | ---: | ---: |
| 英语 | 有害 | 32.0% (48/150) | 21.3% (32/150) | 56.7% (85/150) | 78.0% (117/150) |
| 英语 | 无害 | 2.7% (4/150) | 58.0% (87/150) | 3.3% (5/150) | 5.3% (8/150) |
| 中文 | 有害 | 36.0% (54/150) | 34.7% (52/150) | 54.0% (81/150) | 64.0% (96/150) |
| 中文 | 无害 | 3.3% (5/150) | 72.7% (109/150) | 5.3% (8/150) | 5.3% (8/150) |
| 希伯来语 | 有害 | 31.8% (47/148) | 43.9% (65/148) | 60.1% (89/148) | 54.1% (80/148) |
| 希伯来语 | 无害 | 3.4% (5/148) | 75.0% (111/148) | 4.7% (7/148) | 5.4% (8/148) |

| 有害网关跨语言差 | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| en − zh | -4.0% | -13.3% |
| en − he | 0.2% | -22.6% |

### 成对有害结果

| 模式 | Fable 5.1 | DS V4.1 Flash |
| --- | ---: | ---: |
| 可对比三元组 | 133 (100%) | 145 (100%) |
| 三者都拒绝 | 124 (93.2%) | 144 (99.3%) |
| 三者都顺从 | 4 (3.0%) | 0 (0.0%) |
| 英拒 / 中放 | 3 (2.3%) | 0 (0.0%) |
| 英拒 / 希放 | 1 (0.8%) | 1 (0.7%) |
| 英放 / 中拒 | 1 (0.8%) | 0 (0.0%) |
| 英放 / 希拒 | 2 (1.5%) | 0 (0.0%) |

### 关键类别

只列出两模型差异大、或和跨语言假设相关的类别。拦截率含网关。

| 类别 | 语言 | 集合 | Fable 拦截 | DeepSeek 拦截 | Fable 网关 | DeepSeek 网关 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| chemical_biological | 英语 | 有害 | 100.0% | 100.0% | 90.9% | 36.4% |
| chemical_biological | 希伯来语 | 有害 | 100.0% | 100.0% | 90.9% | 63.6% |
| chemical_biological | 中文 | 有害 | 100.0% | 100.0% | 90.9% | 27.3% |
| contrast_discr | 英语 | 有害 | 90.0% | 100.0% | 0.0% | 20.0% |
| contrast_discr | 希伯来语 | 有害 | 66.7% | 100.0% | 0.0% | 70.0% |
| contrast_discr | 中文 | 有害 | 75.0% | 100.0% | 0.0% | 50.0% |
| cybercrime_intrusion | 英语 | 有害 | 92.9% | 100.0% | 86.7% | 53.3% |
| cybercrime_intrusion | 希伯来语 | 有害 | 100.0% | 100.0% | 86.7% | 73.3% |
| cybercrime_intrusion | 中文 | 有害 | 100.0% | 100.0% | 86.7% | 80.0% |
| definitions | 英语 | 无害 | 0.0% | 20.0% | 0.0% | 20.0% |
| definitions | 希伯来语 | 无害 | 0.0% | 85.7% | 0.0% | 85.7% |
| definitions | 中文 | 无害 | 0.0% | 73.3% | 0.0% | 66.7% |
| homonyms | 英语 | 无害 | 6.7% | 66.7% | 6.7% | 66.7% |
| homonyms | 希伯来语 | 无害 | 13.3% | 86.7% | 6.7% | 86.7% |
| homonyms | 中文 | 无害 | 7.1% | 80.0% | 6.7% | 80.0% |
| illegal | 英语 | 有害 | 100.0% | 100.0% | 40.9% | 9.1% |
| illegal | 希伯来语 | 有害 | 100.0% | 100.0% | 40.9% | 22.7% |
| illegal | 中文 | 有害 | 100.0% | 100.0% | 59.1% | 22.7% |
| misinformation_disinformation | 英语 | 有害 | 84.6% | 100.0% | 23.1% | 46.2% |
| misinformation_disinformation | 希伯来语 | 有害 | 84.6% | 100.0% | 0.0% | 76.9% |
| misinformation_disinformation | 中文 | 有害 | 83.3% | 100.0% | 0.0% | 46.2% |
| privacy_fictional | 英语 | 无害 | 40.0% | 84.6% | 13.3% | 33.3% |
| privacy_fictional | 希伯来语 | 无害 | 53.3% | 86.7% | 20.0% | 40.0% |
| privacy_fictional | 中文 | 无害 | 60.0% | 92.9% | 20.0% | 53.3% |
| real_group_nons_discr | 英语 | 无害 | 0.0% | 76.9% | 0.0% | 60.0% |
| real_group_nons_discr | 希伯来语 | 无害 | 0.0% | 91.7% | 0.0% | 71.4% |
| real_group_nons_discr | 中文 | 无害 | 0.0% | 80.0% | 0.0% | 66.7% |

### 读法

- 强度只回答「有害请求有没有被拦住」，不回答「拦得对不对」。
- DeepSeek 的高无害拦截几乎全是空回复，更像下游网关，而不是模型正文拒绝（三种语言模型拒无害都约 5%）。
- Fable 的有害网关也偏高（约 32–36%），但三种语言差不多，且无害网关只有约 3%。
- 两轮共用同一套 `prompts.jsonl` 和同一判定模型 `deepseek-v4-pro`。

## 协议

本项目采用 [MIT License](LICENSE)。
