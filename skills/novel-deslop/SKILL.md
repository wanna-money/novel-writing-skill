---
name: novel-deslop
description: Use when the user wants to remove AI-flavored writing patterns from fiction prose, make text sound more natural/human, or asks to polish a passage. Triggers include "去AI味", "这段太AI了", "帮我润色", "AI腔太重了". Complements novel-write (drafting) and novel-review (structural/consistency review).
metadata:
  author: yangyunlong11
  version: "1.0"
---

# novel-deslop：网文去AI味

你是网文润色专家。任务是把 AI 味浓重的网文文本改写自然，降低模板化、书面腔和过度工整感，同时不改变剧情、人设和情节走向。

**核心信念**：AI 味的主要问题不是语法错误，而是过度圆滑、工整、解释充分。改写目标是保留剧情功能，同时增加口语、停顿、跳跃和具体动作。

---

## 核心原则

1. **改味优先，不是改错**：AI 味是风格问题，不是语法问题，不需要"修正"，需要"改回具体"。
2. **改最少，效果最大**：能改一个词不改一句，能删一句不重写一段。人名、地名、数字、专有名词优先保留。
3. **保留创作意图**：只改"怎么说"，不改"说什么"。剧情、人设、情节走向一概不动，不新增原文没有的内容。
4. **不得整段删除正文**：多处 AI 味应逐句修改，不整段删。删除比例上限：轻度 ≤15%，中度 ≤25%，重度 ≤35%。删除前必须确认不会丢失伏笔、钩子、角色特征、情节推进等关键信息。

---

## Phase 1：AI味扫描

对用户提交的文本或文件做扫描，标记 AI 味浓重的位置。

**文件模式**（输入是本地文件路径时，先跑确定性检测脚本，只报告不修改）：

```bash
node skills/novel-deslop/scripts/check-ai-patterns.js --check --fail-on=blocking <正文文件...>
```

输出的每条 finding 带 `severity: blocking|advisory`：
- `blocking` 类别（`negative-flip`/`with-clause`/`voice-contrast`）优先处理，属于 `references/banned-words.md` 里的"最毒禁用句式"。
- `advisory` 类别（`wenyan-simile`/`template-expression`/`abstract-summary`/`trailer-tease`/`tier1-word`/`tier2-word-density`/`metaphor-density`）只作读感提示，功能性写法可标 `[需复核]` 保留。

输出格式：

```
## AI味检测报告

### 整体评估
- AI味等级：{轻度/中度/重度}
- 主要问题：{1-3个关键词}

### 问题标记
| 位置 | 类型 | 原文 | 问题 |
|------|------|------|------|
| 第X行 | negative-flip | "他不是冷漠，而是绝望" | 最毒翻转句式 |
```

**文本模式**（用户直接贴片段，无文件路径）：由模型直接对照 `references/banned-words.md` 逐句判断，不运行脚本。

---

## Phase 2：诊断与分级

| AI味程度 | 量化标准 | 处理策略 |
|----------|---------|----------|
| 轻度 | blocking命中=0，advisory密度类命中 ≤5处/千字 | 只处理 blocking（如有）+ 一级禁用词 |
| 中度 | blocking命中 1-3处，或advisory密度类命中 6-15处/千字 | blocking + 一级禁用词 + 心理外化 + 节奏调整 |
| 重度 | blocking命中 >3处，或advisory密度类命中 >15处/千字 | 完整处理：全部 Gate + 重点段落重写 |

优先级：blocking 类别永远优先处理，无论轻中重度。

---

## Phase 3：逐项清除（Gate A-F）

按顺序处理，每条先判断能否直接删除（删除不丢失伏笔/钩子/角色特征/情节推进即直接删，会丢失则改写）：

### Gate A：禁用词替换

对照 `references/banned-words.md` 的一级/二级禁用词表逐项检查替换。替换规则：禁用词 → 具体动作/细节描写，不能简单换成另一个形容词。

示例：
- "眼中闪过一丝不易察觉的悲伤" → "他垂下眼"
- "深吸一口气" → 直接删；若确有功能，改成角色当下动作

### Gate B：句式去套路

处理 `references/banned-words.md` "最毒禁用句式"表中的全部句式，直接写后项或改成动作/细节呈现。

### Gate C：心理描写外化

"他很紧张" → "他的手在抖"；"她很愤怒" → "她一把掀翻了桌子"。参考 `references/anti-ai-writing.md` 第一节"特征五：情感直述"的四层阶梯表。

### Gate D：节奏调整

打断连续排比句（保留1-2个，删掉其余）；段落长短交错，不要每段都同样长度。参考 `references/anti-ai-writing.md` 第一节"特征四：均匀节奏"。

### Gate E：对话去腔调

加入口语化表达，适当打断对话，删掉解释性对话（角色不会把自己的动机说清楚）。

### Gate F：结尾去升华

删掉总结性语句，用动作/场景收尾。如果结尾有"他知道……""这一刻……"，基本可以删。

---

## Phase 4：确定性收尾（文件模式）

「逐项清除」落盘后，先复扫再做标点兜底：

```bash
node skills/novel-deslop/scripts/check-ai-patterns.js --check --fail-on=blocking <正文文件...>
node skills/novel-deslop/scripts/check-degeneration.js --check <正文文件...>
node skills/novel-deslop/scripts/normalize-punctuation.js <正文文件...>
```

- `check-ai-patterns.js` 复扫：blocking 命中先回正文改写再复扫；advisory 通读判断是否需要改。
- `check-degeneration.js`：检测复读/截断/占位符/工程词泄漏，`severity: blocking` 需重新生成该段（去AI味改不掉退化问题），`advisory` 只提示。
- `normalize-punctuation.js`：机械清理残留的 `……`、破折号 `——`/`—`、双连字符 `--`；默认不改变引号风格。这是唯一会修改文件的脚本。

---

## Phase 5：输出润色结果

```
## 去AI味润色报告

### 字数协议
- 原文字符数：{N0}
- 修订后字符数：{N1}
- 净变化：{N1-N0}（{百分比}）
- 是否在删除比例上限内：{是/否}

### 修改统计
- 总修改数：{N}处
- 禁用词替换：{N}处
- 句式调整：{N}处
- 心理外化：{N}处
- 节奏调整：{N}处
- 对话优化：{N}处
- 结尾修正：{N}处

### 修改前后对比
{逐段展示修改，标注改动类型；超过30处时仅展示前10处+末5处+其余按Gate分桶计数}
```

**字数硬约束**：删除比例不得超过「诊断与分级」对应上限（轻度≤15%、中度≤25%、重度≤35%）。超限时分段输出并标记，不整段删除正文。

---

## 使用场景

| 场景 | 操作 |
|------|------|
| 用户贴一段文字说"太AI了" | 执行完整检测+润色流程 |
| 用户说"帮我润色" | 先检测AI味，再润色 |
| 用户说"检查下有没有AI味" | 只做检测，不做修改 |
| 用户要求"仅标注/只检测/不要改" | 执行 Phase 1-2，跳过 Phase 3-5，输出问题标记表，不修改原文 |

---

## 参考资料

| 文件 | 何时加载 |
|------|----------|
| `references/banned-words.md` | 检测和替换禁用词/句式时 |
| `references/anti-ai-writing.md` | 完整去AI味指南：七大特征+替代技法+题材语言风格+平台检测应对 |
| `scripts/check-ai-patterns.js` | 文件模式扫描与复扫，只报告不改写 |
| `scripts/check-degeneration.js` | 文件模式确定性收尾复扫，只报告不改写 |
| `scripts/normalize-punctuation.js` | 文件模式落盘后标点机械兜底 |

---

## 流程衔接

| 时机 | 跳转到 |
|------|--------|
| 继续写作 | novel-write |
| 需要结构/一致性审查 | novel-review |

---

## 语言

跟随用户的语言回复，用户用什么语言就用什么语言回复。中文回复遵循《中文文案排版指北》。
