#!/usr/bin/env node
'use strict';

const fs = require('fs');

const USAGE = `Usage: node check-degeneration.js [--check] [--json] <file...>

Detects model-degeneration signals in generated prose: verbatim repetition,
truncation, placeholder text, and writing-metadata leakage into prose.

Categories: repetition (blocking), truncation (blocking), placeholder (blocking),
            meta-leak (advisory)
`;

const PLACEHOLDER_PATTERNS = [/待补充/g, /\bTODO\b/gi, /\bTBD\b/gi, /\[需复核\]/g, /___+/g];

const META_LEAK_PATTERNS = [
  /第[一二三四五六七八九十百千万两0-9]+章/g,
  /上一章|上章|前一章/g,
  /细纲|伏笔追踪/g,
];

function splitLines(text) {
  return text.split(/\r?\n/);
}

function checkRepetition(lines, findings) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 6) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (lines[j].trim() === line) {
        findings.push({
          line: i + 1,
          category: 'repetition',
          severity: 'blocking',
          excerpt: line.slice(0, 40),
          note: `与第${j + 1}行完全重复，疑似模型复读`,
        });
      }
    }
  }
}

function checkTruncation(text, lines, findings) {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return;
  const lastChar = trimmed[trimmed.length - 1];
  const properEnders = new Set(['。', '！', '？', '"', '」', '』', '.', '!', '?']);
  if (!properEnders.has(lastChar)) {
    findings.push({
      line: lines.length,
      category: 'truncation',
      severity: 'blocking',
      excerpt: trimmed.slice(-40),
      note: '文本结尾未以合法标点收束，疑似生成截断',
    });
  }
}

function checkPlaceholder(lines, findings) {
  lines.forEach((line, i) => {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      let match;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(line)) !== null) {
        findings.push({
          line: i + 1,
          category: 'placeholder',
          severity: 'blocking',
          excerpt: line.slice(Math.max(0, match.index - 15), match.index + match[0].length + 15),
          note: '占位符文本泄漏进正文',
        });
      }
    }
  });
}

function checkMetaLeak(lines, findings) {
  lines.forEach((line, i) => {
    for (const pattern of META_LEAK_PATTERNS) {
      let match;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(line)) !== null) {
        findings.push({
          line: i + 1,
          category: 'meta-leak',
          severity: 'advisory',
          excerpt: line.slice(Math.max(0, match.index - 15), match.index + match[0].length + 15),
          note: '写作工程词泄漏，改成角色可感知的事件/物件/相对时间（角色在故事内真实讨论"第X章"文本时例外）',
        });
      }
    }
  });
}

function analyzeFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = splitLines(text);
  const findings = [];

  checkRepetition(lines, findings);
  checkTruncation(text, lines, findings);
  checkPlaceholder(lines, findings);
  checkMetaLeak(lines, findings);

  return findings.map((f) => ({ file: filePath, ...f }));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const asJson = args.includes('--json');
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

  const hasBlocking = allFindings.some((f) => f.severity === 'blocking');
  process.exit(hasBlocking ? 1 : 0);
}

main();
