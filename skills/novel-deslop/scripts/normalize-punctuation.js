#!/usr/bin/env node
'use strict';

const fs = require('fs');

const USAGE = `Usage: node normalize-punctuation.js [--check] <file...>

Mechanically cleans up leftover ellipses, em-dashes, double-hyphens, and
standalone divider lines. Does not change quote style. This is the only
novel-deslop script that writes to files (unless --check is given).

--check reports what would change without writing, exits 1 if any change needed.
`;

function normalizeText(text) {
  let result = text;
  let changed = false;

  const ellipsisPattern = /……|\.{3,}/g;
  if (ellipsisPattern.test(result)) {
    changed = true;
    result = result.replace(ellipsisPattern, '。');
  }

  const emDashPattern = /——|—/g;
  if (emDashPattern.test(result)) {
    changed = true;
    result = result.replace(emDashPattern, '，');
  }

  const doubleHyphenPattern = /--+/g;
  if (doubleHyphenPattern.test(result)) {
    changed = true;
    result = result.replace(doubleHyphenPattern, '');
  }

  const dividerLinePattern = /^-{3,}\s*$/gm;
  if (dividerLinePattern.test(result)) {
    changed = true;
    result = result.replace(dividerLinePattern, '');
  }

  result = result.replace(/[ \t]+\n/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');

  return { result, changed };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const checkOnly = args.includes('--check');
  const files = args.filter((a) => !a.startsWith('--'));

  if (files.length === 0) {
    process.stderr.write('Error: no input files given.\n\n' + USAGE);
    process.exit(1);
  }

  let anyChanged = false;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      process.stderr.write(`Error: file not found: ${file}\n`);
      process.exit(1);
    }
    const original = fs.readFileSync(file, 'utf8');
    const { result, changed } = normalizeText(original);

    if (changed) {
      anyChanged = true;
      if (checkOnly) {
        process.stdout.write(`${file}: would normalize punctuation (ellipsis/em-dash/hyphen/divider cleanup)\n`);
      } else {
        fs.writeFileSync(file, result, 'utf8');
        process.stdout.write(`${file}: normalized\n`);
      }
    } else {
      process.stdout.write(`${file}: no changes needed\n`);
    }
  }

  process.exit(checkOnly && anyChanged ? 1 : 0);
}

main();
