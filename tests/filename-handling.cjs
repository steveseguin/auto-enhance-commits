// Offline, dependency-free regression tests of actual source Git-read functions.
// Run: node tests/filename-handling.cjs [optional-source-path]
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const sourcePath = process.argv[2] || path.join(__dirname, '../scripts/enhance-commits.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const functions = source.split('// --- Git Operations ---')[1].split('// --- AI Enhancement ---')[0];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'enhancer-filenames-'));
// Isolated configuration and environment; no user Git configuration or credentials.
const env = { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C.UTF-8' };
const options = { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
const git = args => cp.execFileSync('git', args, options);
const context = {
  path, process: { env: {} }, log() {}, ScriptError: Error,
  exec(command, opts, callback) { cp.exec(command, { ...opts, cwd: root, env }, callback); },
  execFile(command, args, opts, callback) {
    assert.equal(command, 'git');
    assert.ok(['show', 'diff'].includes(args[1]), 'Only expected read operations allowed');
    cp.execFile(command, args, { ...opts, cwd: root, env }, callback);
  }
};
vm.createContext(context);
// Do not load imports, model initialization, orchestration or publication functions.
vm.runInContext('const MAX_DIFF_SIZE=20000, MAX_FILES_TO_SAMPLE=5, SAMPLE_LINES_PER_FILE=200;\n' +
  functions + '\nglobalThis.api={getChangedFiles,getCommitDiff};', context);
const api = context.api;
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function write(file, content) { fs.writeFileSync(path.join(root, file), content); }
function commit() {
  git(['add', '-A']); git(['commit', '-m', 'fixture']);
  return git(['rev-parse', 'HEAD']).trim();
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
async function checkText(sha, expected) {
  const files = await api.getChangedFiles(sha);
  assert.deepEqual(plain(files), expected);
  const summary = await api.getCommitDiff(sha, files);
  let expectedSummary = '';
  for (const {status, file} of expected) {
    const raw = git(['--literal-pathspecs', 'show', '--unified=5', sha, '--', file]);
    expectedSummary += `\n\n=== ${status}: ${file} ===\n` + raw;
  }
  assert.equal(summary, expectedSummary, 'Summary must contain exactly the selected files and raw Git output');
}
(async () => {
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Offline Test']); git(['config', 'user.email', 'test@example.invalid']);
  write('root.txt', 'root content\n');
  await test('root commit', () => checkText(commit(), [{status:'A', file:'root.txt'}]));
  const names = [
    'ordinary.txt', 'with space.txt', 'café.txt', '日本語.txt', 'tab\tname.txt',
    'line\nname.txt', ' leading.txt', 'trailing.txt ', 'price$USD.txt',
    'quote"name.txt', "single'name.txt", 'back\\slash.txt',
    '$(touch INJECTION_MARKER).txt', '`touch INJECTION_MARKER`.txt',
    '-leading-option.txt', 'literal*.txt', ':(glob)*.txt'
  ];
  for (const [i, file] of names.entries()) {
    write(file, 'unique content ' + i + '\n');
    const sha = commit();
    await test('addition ' + JSON.stringify(file), () => checkText(sha, [{status:'A',file}]));
  }
  await test('shell-looking filenames remain inert', () => assert.equal(fs.existsSync(path.join(root,'INJECTION_MARKER')), false));
  write('literal*.txt', 'literal filename changed\n');
  write('literal-decoy.txt', 'unrelated content must not leak\n');
  await test('wildcard path does not include another changed file', async () => {
    const sha=commit();
    const summary=await api.getCommitDiff(sha,[{status:'M',file:'literal*.txt'}]);
    assert.ok(summary.includes('literal filename changed'));
    assert.ok(!summary.includes('unrelated content must not leak'));
  });
  write(':(glob)*.txt', 'literal magic filename changed\n');
  write('literal-decoy.txt', 'second unrelated content must not leak\n');
  await test('pathspec magic stays literal', async () => {
    const sha=commit();
    const summary=await api.getCommitDiff(sha,[{status:'M',file:':(glob)*.txt'}]);
    assert.ok(summary.includes('literal magic filename changed'));
    assert.ok(!summary.includes('second unrelated content must not leak'));
  });
  write('café.txt', 'changed Unicode content\n');
  await test('Unicode modification', () => checkText(commit(), [{status:'M',file:'café.txt'}]));
  fs.unlinkSync(path.join(root,'café.txt'));
  await test('Unicode deletion', async () => {
    const files = await api.getChangedFiles(commit());
    assert.deepEqual(plain(files), [{status:'D',file:'café.txt'}]);
    assert.match(await api.getCommitDiff(git(['rev-parse','HEAD']).trim(),files), /\[File deleted: café.txt\]/);
  });
  fs.renameSync(path.join(root,'ordinary.txt'),path.join(root,'renamedé.txt'));
  await test('rename remains delete plus add', async () => {
    const sha=commit(); const files=await api.getChangedFiles(sha);
    assert.deepEqual(plain(files), [{status:'D',file:'ordinary.txt'},{status:'A',file:'renamedé.txt'}]);
    const summary=await api.getCommitDiff(sha,files);
    assert.ok(summary.includes('[File deleted: ordinary.txt]'));
    assert.ok(summary.includes('unique content 0'));
  });
  fs.unlinkSync(path.join(root,'root.txt')); fs.symlinkSync('renamedé.txt',path.join(root,'root.txt'));
  await test('type change', () => checkText(commit(), [{status:'T',file:'root.txt'}]));
  write('binaryé.dat', Buffer.from([0,1,2,3,255]));
  await test('Unicode binary addition', async () => {
    const sha=commit(); const files=await api.getChangedFiles(sha);
    assert.deepEqual(plain(files), [{status:'A',file:'binaryé.dat'}]);
    assert.ok((await api.getCommitDiff(sha,files)).includes('[Binary file (A): binaryé.dat]'));
  });
  await test('empty commit', async () => {
    git(['commit','--allow-empty','-m','empty']);
    assert.deepEqual(plain(await api.getChangedFiles(git(['rev-parse','HEAD']).trim())),[]);
  });
  console.log(`${passed} passed; ${failed} failed. No external services used.`);
  process.exitCode = failed ? 1 : 0;
})().finally(() => fs.rmSync(root,{recursive:true,force:true})).catch(error => {console.error(error);process.exitCode=1;});
