// @vitest-environment node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';
import { SessionSchema } from '../contracts';

it('parses all actual Python response models with the browser Zod contract', () => {
  const python = path.resolve(process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python');
  const output = execFileSync(python, ['tests/export_contracts.py'], { cwd: path.resolve('../backend'), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const records: unknown[] = JSON.parse(output);
  expect(records).toHaveLength(945);
  const parsed = records.map(value => SessionSchema.parse(value));
  expect(new Set(parsed.map(value => value.scene.ending).filter(Boolean))).toEqual(new Set(['liberation', 'escape', 'inheritance']));
}, 15000);
