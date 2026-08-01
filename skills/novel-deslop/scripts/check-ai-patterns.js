#!/usr/bin/env node
'use strict';

const fs = require('fs');

const USAGE = `Usage: node check-ai-patterns.js [--check] [--json] [--fail-on=blocking|all] <file...>

Detects high-risk AI-flavor prose patterns for novel-deslop. Reports only,
never rewrites (rewriting is contextual and must stay human-judged).

Blocking categories (always addressed first): negative-flip, with-clause, voice-contrast
Advisory categories: wenyan-simile, template-expression, abstract-summary, trailer-tease,
                      tier1-word, tier2-word-density, metaphor-density

--fail-on=blocking (default) exits 1 only when a blocking finding exists.
--fail-on=all exits 1 when any finding exists.
`;

const BLOCKING_CATEGORIES = new Set(['negative-flip', 'with-clause', 'voice-contrast']);

// Corresponds to banned-words.md's "一级禁用词" section (category: tier1-word)
const TIER1_WORDS = [
  '仿佛', '犹如', '宛若', '如同', '一丝', '一抹', '些许', '几分', '隐约',
  '毫无征兆', '几不可闻', '微不可察', '深吸一口气', '不禁',
  '眼中闪过', '嘴角勾起', '眉头微皱', '眉眼低垂', '瞳孔微缩', '瞳孔收缩',
  '瞳孔一缩', '指节泛白', '眼神锐利', '目光锐利',
  '心中一动', '心头一震', '心下了然', '心中暗道', '心底泛起', '不由得',
  '心中一凛', '心中涌起一股',
  '不容置疑', '不容置喙', '不易察觉', '显而易见', '毫无疑问', '不可否认', '前所未有',
];

// Corresponds to banned-words.md's "二级禁用词" section (category: tier2-word-density)
const TIER2_WORDS = ['缓缓', '微微', '轻轻', '淡淡', '突然', '陡然', '骤然', '猛然', '瞬间', '猛地'];

// Used for banned-words.md's "比喻分类" section (category: metaphor-density)
const METAPHOR_MARKERS = ['好像', '像是', '仿佛', '宛如', '如同', '犹如'];

function splitLines(text) {
  return text.split(/\r?\n/);
}

function findAllIndices(line, needle) {
  const indices = [];
  let idx = line.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = line.indexOf(needle, idx + needle.length);
  }
  return indices;
}

function excerptAround(line, idx, needleLen, radius = 20) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(line.length, idx + needleLen + radius);
  return line.slice(start, end);
}

function checkNegativeFlip(line, lineNo, findings) {
  const pattern = /不是([^，,。！？!?\n]{1,20})[，,]\s*(?:而)?是([^，,。！？!?\n]{1,20})/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    findings.push({
      line: lineNo,
      category: 'negative-flip',
      severity: 'blocking',
      excerpt: excerptAround(line, match.index, match[0].length),
      note: '否定铺垫后接肯定翻转，直接写后项',
    });
  }
}

function checkWithClause(line, lineNo, findings) {
  const pattern = /，\s*带着[^，,。！？!?\n]{1,20}/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    findings.push({
      line: lineNo,
      category: 'with-clause',
      severity: 'blocking',
      excerpt: excerptAround(line, match.index, match[0].length),
      note: '"，带着..."万能状语，删掉或换具体动作',
    });
  }
}

function checkVoiceContrast(line, lineNo, findings) {
  const patterns = [
    /声音不大[，,]?\s*却[^。！？!?\n]{1,20}/g,
    /平静无波/g,
    /声音平直/g,
    /听不出情绪/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      findings.push({
        line: lineNo,
        category: 'voice-contrast',
        severity: 'blocking',
        excerpt: excerptAround(line, match.index, match[0].length),
        note: '无情绪声线描写，直接写台词内容或动作',
      });
    }
  }
}

function checkWenyanSimile(line, lineNo, findings) {
  const pattern = /(?:仿佛|犹如|宛若)[^。！？!?\n]{0,20}一般/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    findings.push({
      line: lineNo,
      category: 'wenyan-simile',
      severity: 'advisory',
      excerpt: excerptAround(line, match.index, match[0].length),
      note: '文言腔比喻，删掉或白描',
    });
  }
}

function checkTemplateExpression(line, lineNo, findings) {
  const patterns = [/眼中闪过一?[丝抹][^。！？!?\n]{0,15}/g, /嘴角勾起一?抹[^。！？!?\n]{0,15}/g];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      findings.push({
        line: lineNo,
        category: 'template-expression',
        severity: 'advisory',
        excerpt: excerptAround(line, match.index, match[0].length),
        note: '模板化表情描写，改成具体动作',
      });
    }
  }
}

function checkAbstractSummary(line, lineNo, findings) {
  const patterns = [
    /这一刻[，,]?[^\n。！？!?]{0,20}(?:终于|才)(?:明白|意识到)/g,
    /从这一刻开始/g,
    /(?:命运|宿命)[^\n。！？!?]{0,20}(?:齿轮|棋局|獠牙|改写)/g,
    /(?:反击|复仇|故事)[^\n。！？!?]{0,12}才刚刚开始/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      findings.push({
        line: lineNo,
        category: 'abstract-summary',
        severity: 'advisory',
        excerpt: excerptAround(line, match.index, match[0].length),
        note: 'AI收束腔，回到角色当下可见的动作/物件/对话',
      });
    }
  }
}

function checkTrailerTease(line, lineNo, findings) {
  const pattern = /他不知道的是|她不知道的是|殊不知/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    findings.push({
      line: lineNo,
      category: 'trailer-tease',
      severity: 'advisory',
      excerpt: excerptAround(line, match.index, match[0].length),
      note: '上帝视角剧透预告，用具体钩子物件/事件收束',
    });
  }
}

function checkTier1Words(line, lineNo, findings) {
  for (const word of TIER1_WORDS) {
    for (const idx of findAllIndices(line, word)) {
      findings.push({
        line: lineNo,
        category: 'tier1-word',
        severity: 'advisory',
        excerpt: excerptAround(line, idx, word.length),
        note: `一级禁用词"${word}"，替换为具体动作/细节`,
      });
    }
  }
}

function checkTier2WordDensity(text, findings) {
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return;
  const perKilo = 1000 / totalChars;
  for (const word of TIER2_WORDS) {
    const count = (text.match(new RegExp(word, 'g')) || []).length;
    if (count * perKilo > 3) {
      findings.push({
        line: 0,
        category: 'tier2-word-density',
        severity: 'advisory',
        excerpt: `"${word}" 全文出现 ${count} 次`,
        note: `密度超过每千字3次阈值（约${(count * perKilo).toFixed(1)}次/千字），需替换部分`,
      });
    }
  }
}

function checkMetaphorDensity(text, findings) {
  let count = 0;
  for (const marker of METAPHOR_MARKERS) {
    count += (text.match(new RegExp(marker, 'g')) || []).length;
  }
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return;
  const perKilo = (count * 1000) / totalChars;
  if (perKilo > 3) {
    findings.push({
      line: 0,
      category: 'metaphor-density',
      severity: 'advisory',
      excerpt: `比喻标记全文出现 ${count} 次`,
      note: `密度约${perKilo.toFixed(1)}次/千字，超过阈值，检查是否成片堆叠`,
    });
  }
}

function analyzeFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = splitLines(text);
  const findings = [];

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    checkNegativeFlip(line, lineNo, findings);
    checkWithClause(line, lineNo, findings);
    checkVoiceContrast(line, lineNo, findings);
    checkWenyanSimile(line, lineNo, findings);
    checkTemplateExpression(line, lineNo, findings);
    checkAbstractSummary(line, lineNo, findings);
    checkTrailerTease(line, lineNo, findings);
    checkTier1Words(line, lineNo, findings);
  });

  checkTier2WordDensity(text, findings);
  checkMetaphorDensity(text, findings);

  return findings.map((f) => ({ file: filePath, ...f }));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const asJson = args.includes('--json');
  const failOnArg = args.find((a) => a.startsWith('--fail-on='));
  const failOn = failOnArg ? failOnArg.split('=')[1] : 'blocking';
  const files = args.filter((a) => !a.startsWith('--'));

  if (files.length === 0) {
    process.stderr.write('Error: no input files given.\n\n' + USAGE);
    process.exit(1);
  }

  let allFindings = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      process.stderr.write(`Error: file not found: ${file}\n`);
      process.exit(1);
    }
    allFindings = allFindings.concat(analyzeFile(file));
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(allFindings, null, 2) + '\n');
  } else if (allFindings.length === 0) {
    process.stdout.write('No findings.\n');
  } else {
    for (const f of allFindings) {
      process.stdout.write(`${f.file}:${f.line} [${f.severity}] ${f.category} — ${f.excerpt}\n  ${f.note}\n`);
    }
    process.stdout.write(`\nTotal: ${allFindings.length} finding(s).\n`);
  }

  const hasBlocking = allFindings.some((f) => BLOCKING_CATEGORIES.has(f.category));
  const shouldFail = failOn === 'all' ? allFindings.length > 0 : hasBlocking;
  process.exit(shouldFail ? 1 : 0);
}

main();
