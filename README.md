# novel-writing-skill

万能小说写作工具集，覆盖短篇/中篇/长篇，适配玄幻/科幻/修仙/奇幻/末世等主流题材。

三个协同的 Claude Skill，参考 [oh-story-claudecode](https://github.com/worldwonderer/oh-story-claudecode) 的多技能架构，整合《三体》《龙族》《诛仙》等经典作品写作手法。

## 三个 Skill

| Skill | 职责 | 触发词示例 |
|------|------|-----------|
| `novel-write` | 六阶段写作方法论：立项定调→世界观构建→人物矩阵→大纲编制→章节写作→连贯性维护 | "帮我写玄幻小说"、"立项"、"写大纲"、"写第N章" |
| `novel-deslop` | 去AI味：AI味扫描→分级→逐项清除(Gate A-F)→确定性脚本复扫→润色报告 | "去AI味"、"这段太AI了"、"帮我润色" |
| `novel-review` | 多视角审查：结构/文字/一致性三视角并行审查，S1-S4 分级报告 | "审查一下"、"帮我看看这章"、"评审" |

三者可独立触发，典型协作顺序：`novel-write` 写完一章 → `novel-deslop` 去AI味 → `novel-review` 审查 → 按报告返回对应 skill 修改。

## 共享子 Agent

`agents/` 目录下三个子 agent，随插件安装自动注册（Claude Code 会话启动时加载为 `subagent_type`），被上述三个 skill 共享调用：

- **narrative-writer**：正文执行 + 去AI味 Gate A-F 改写 + 审查中的文字/AI味视角
- **outline-architect**：世界观/大纲/钩子结构设计 + 审查中的结构视角
- **consistency-checker**：只读一致性检查（角色属性/伏笔/时间线），consistency 视角唯一使用方

任一 agent 不可用时，各 skill 自动降级为主线程直接执行，不阻塞流程。

## 功能亮点

- **六阶段写作流程**：立项定调 → 世界观构建 → 人物矩阵 → 大纲编制 → 章节写作 → 连贯性维护
- **确定性去AI味检测**：三个纯 Node.js 脚本（无第三方依赖），正则捕捉最毒句式、禁用词密度、复读/截断/占位符退化信号
- **三层大纲体系**：总纲→卷纲→章纲，推荐大纲:正文 = 1:2.5–3
- **伏笔追踪系统**：三级分类管理，自动提示逾期未收的伏笔
- **题材适配**：硬科幻/都市奇幻/玄幻修仙/西式奇幻各有专项语言风格指南
- **多视角对抗式审查**：结构/文字/一致性三个独立视角并行审查，统一 S1-S4 严重度输出

## 文件结构

```
novel-writing-skill/
├── agents/                          # 共享子 agent（插件根目录，自动注册）
│   ├── narrative-writer.md
│   ├── outline-architect.md
│   └── consistency-checker.md
└── skills/
    ├── novel-write/
    │   ├── SKILL.md                 # 六阶段方法论
    │   ├── references/              # worldbuilding / character-design / outline-system /
    │   │                             # narrative-techniques / genre-adaptation /
    │   │                             # continuity-management / content-compliance
    │   └── assets/                  # 立项/大纲/章节总结/人物档案/伏笔追踪模板
    ├── novel-deslop/
    │   ├── SKILL.md
    │   ├── references/              # anti-ai-writing.md / banned-words.md
    │   └── scripts/                 # check-ai-patterns.js / check-degeneration.js /
    │                                 # normalize-punctuation.js
    └── novel-review/
        ├── SKILL.md
        └── references/              # quality-rubric.md / quality-checklist.md
```

## 使用

当你提出写小说、去AI味或审查相关的请求时，对应 skill 会自动触发：

- "帮我写一篇玄幻短篇"（novel-write）
- "设计这部科幻小说的世界观"（novel-write）
- "这段文字太AI味了，帮我润色"（novel-deslop）
- "审查一下第三章"（novel-review）

## License

MIT
