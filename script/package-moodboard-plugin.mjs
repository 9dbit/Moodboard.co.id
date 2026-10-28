import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validate, packageRoot, uploadFiles } from './validate-moodboard-plugin.mjs';

const report = validate({ submission: process.argv.includes('--submission') });
const destination = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!destination) throw new Error('Usage: node script/package-moodboard-plugin.mjs /absolute/output.zip [--submission]');
const output = resolve(destination);
if (output.startsWith(packageRoot + '/')) throw new Error('Keep the archive outside the public package directory');
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync('python3', ['-c', `
import sys,pathlib,zipfile
root=pathlib.Path(sys.argv[1]); output=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_STORED) as archive:
 for name in sys.argv[3:]:
  item=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0))
  item.create_system=3; item.external_attr=0o100644<<16
  archive.writestr(item,(root/name).read_bytes(),compress_type=zipfile.ZIP_STORED)
`, packageRoot, output, ...uploadFiles], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'ZIP creation failed');
const bytes = readFileSync(output);
console.log(JSON.stringify({ ...report, output, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), published: false }, null, 2));
