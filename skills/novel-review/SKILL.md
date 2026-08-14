---
name: novel-review
description: Use when the user wants a multi-angle review of fiction chapters/text — structural quality, prose/AI-taste quality, or setting consistency. Triggers include "审查一下", "帮我看看这章", "评审", "review这段". full mode spawns three parallel reviewer subagents when available; falls back to solo (single-thread sequential) mode otherwise.
metadata:
  author: wanna-money
  version: "1.0"
---

# novel-review：多视角对抗式审查

你是审查协调器。职责是找出小说文本中的结构、文字、一致性问题，并给出可执行修改建议。

**执行铁律：审查是找问题，不是验证正确性。**

---

## Review Mode 选择

- `/novel-review` 或未指定模式 → 默认尝试 `full`：并行 spawn `outline-architect`、`narrative-writer`、`consistency-checker` 三个 agent。
- `/novel-review solo` → 不 spawn agent，由当前会话执行基础审查。
- **降级规则**：如果当前已经在子 agent 内执行（不递归 spawn）、Agent/Task 工具不可用、或任一 spawn 失败，自动降级为 `solo`，并在报告开头写明 `Fallback: <原因> -> solo`。

---

## Phase 1：收集待审查内容

1. **确定审查范围**：用户指定了章节/文件则只审查指定内容；未指定则优先审查最近修改的正文文件（`git diff --name-only` 中的正文相关文件），否则询问用户要审查哪一章。
2. **读取支撑材料**：正文、相关设定（`设定/角色/*.md`）、大纲（`大纲/细纲_第N章.md`）、追踪文件（`追踪/伏笔.md`、`追踪/角色状态.md`）；缺失时在报告中标记证据不足，不阻塞审查。
3. **确定性预检**（审查范围含本地文件路径时）：
   ```bash
   node skills/novel-deslop/scripts/check-ai-patterns.js --check --fail-on=all <正文文件...>
   node skills/novel-deslop/scripts/check-degeneration.js --check <正文文件...>
   ```
   将结果合并进 `prose` 类别 Findings：`check-ai-patterns.js` 的 blocking 类别按 S2 处理，advisory 按 S3/S4；`check-degeneration.js` 的 blocking（复读/截断/占位符）按 S1/S2 处理，advisory 按 S4。novel-review 不修改文件，需要自动修复时建议转 `novel-deslop`。

---

## 统一 Findings Schema（所有模式必须使用）

```yaml
- severity: S1 | S2 | S3 | S4
  category: structure | prose | consistency
  location: 文件路径:行号 或 章节/段落描述
  evidence: "引用原文或具体证据"
  issue: "问题描述"
  fix: "可执行修改建议"
```

严重度定义见 `references/quality-rubric.md`。

---

## Phase 2：并行 Spawn Agent（full 模式）

执行降级检查（见"Review Mode 选择"）后，若仍为 `full`，并行调用：

**Agent 1: outline-architect**（审结构）
```
prompt: 你是 outline-architect，从故事架构层面审查以下内容。你的任务是【找问题】，不是验证正确性。
审查范围：{文件路径/章节/必要摘录}
评分标准：{references/quality-rubric.md「结构维度检查项」内联}
检查项：
1. 本章是否推进了故事主题？
2. 情绪节奏是否合理？
3. 钩子和反转设计质量如何？
4. 是否有角色/设定膨胀？
输出格式：VERDICT: APPROVE/CONCERNS/REJECT
FINDINGS: 使用统一 Findings Schema，severity 必须是 S1-S4，category=structure
```

**Agent 2: narrative-writer**（审文字/AI味）
```
prompt: 你是 narrative-writer，从文字质量层面审查以下内容。你的任务是【找问题】，不是验证正确性。
审查范围：{文件路径/章节/必要摘录}
评分标准：{references/quality-rubric.md「文字维度检查项」内联}
禁用词/句式参考：{skills/novel-deslop/references/banned-words.md 摘要}
检查项：
1. 是否存在禁用词/套话/陈词滥调？
2. 心理描写是否外化？
3. 节奏是否均匀？
4. 结尾是否有总结性/升华性语句？
输出格式：VERDICT: APPROVE/CONCERNS/REJECT
FINDINGS: 使用统一 Findings Schema，severity 必须是 S1-S4，category=prose
```

**Agent 3: consistency-checker**（审一致性）
```
prompt: 你是 consistency-checker，使用 grep-first + 推理型审查检测事实矛盾。你的任务是【找事实矛盾】，不做创作评判。
审查范围：{文件路径/章节/必要摘录}
已知角色：{从设定文件提取角色列表}
检查项：
1. 角色属性是否前后一致？
2. 世界规则是否被违反？
3. 伏笔状态是否前后一致？
4. 时间线是否自洽？
输出格式：VERDICT: APPROVE/CONCERNS/REJECT
FINDINGS: 使用统一 Findings Schema，severity 必须是 S1-S4，category=consistency
```

---

## Phase 3：综合裁决

1. 收集实际执行的 reviewer VERDICT 和 FINDINGS。
2. 合并去重：按 severity 排序（S1>S2>S3>S4），同级内按影响范围排序。
3. 输出综合审查报告，列出实际模式、fallback 原因（如有）、审查范围和证据不足项。

---

## Phase 4：输出报告（full 模式）

```md
=== 故事审查报告 ===
Effective Mode: full
Fallback: none
审查范围: {章节/文件}

## Verdict Summary
- outline-architect: APPROVE / CONCERNS(n) / REJECT
- narrative-writer: APPROVE / CONCERNS(n) / REJECT
- consistency-checker: APPROVE / CONCERNS(n) / REJECT

## Severity Counts
- S1: n / S2: n / S3: n / S4: n

## 综合评定
APPROVE(通过) / CONCERNS(有问题) / REJECT(需重写)

## 发现的问题
{按统一 Findings Schema 列出所有问题，S1→S4排序}

## 证据不足 / 需补充
{缺失设定、无法核查事实等}

## 修改建议
{按 S1→S4 优先级排列}
```

---

## solo 模式

不 spawn agent。由当前会话依次执行三个维度的基础检查，参照 `references/quality-rubric.md` 和 `references/quality-checklist.md`。

```md
=== 故事审查报告（solo）===
Effective Mode: solo
Fallback: {none | agent unavailable -> solo | spawn failed -> solo | subagent recursion guard -> solo}
审查范围: {章节/文件}

## 基础检查结果

### 结构
{对照 quality-rubric.md「结构维度检查项」逐项检查}

### 文字/AI味
{对照 quality-rubric.md「文字维度检查项」+ 脚本预检结果}

### 一致性（grep + 推理扫描）
{字面事实冲突 + 推理型一致性发现；无则写"未发现"}

### Findings
{按统一 Findings Schema 列出，severity 必须是 S1-S4}

### 修改建议
{按优先级排列}
```

---

## 参考资料

| 文件 | 何时加载 |
|------|----------|
| `references/quality-rubric.md` | 所有模式的评分基准 |
| `references/quality-checklist.md` | solo 模式基础检查项 |
| `skills/novel-deslop/references/banned-words.md` | 文字维度审查的禁用词参考 |

---

## 流程衔接

| 时机 | 跳转到 |
|------|--------|
| 要修改查出的结构/情节问题 | novel-write |
| 发现AI味需清理 | novel-deslop |

---

## 语言

跟随用户的语言回复，用户用什么语言就用什么语言回复。中文回复遵循《中文文案排版指北》。
