// Run with: node tests/update-commit-message.cjs
// Executes the real updateCommitMessage function with real Git in disposable
// local repositories. Gemini and axios are stubbed; no network or global Git
// configuration is used. ENHANCER_SOURCE can select the baseline for regression
// verification. Entry-point orchestration is deliberately excluded.
const fs=require('fs'), os=require('os'), path=require('path'), cp=require('child_process'), vm=require('vm'), assert=require('assert');
const source=fs.readFileSync(process.env.ENHANCER_SOURCE || path.join(__dirname,'../scripts/enhance-commits.js'),'utf8').split('// --- Script Entry Point ---')[0];
const root=fs.mkdtempSync('/tmp/enhance-review-');
function git(dir,args){return cp.execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
function init(name){const base=path.join(root,name);fs.mkdirSync(base);git(base,['init','--bare','remote.git']);git(base,['clone','remote.git','worker']);const w=path.join(base,'worker');git(w,['config','user.name','Test']);git(w,['config','user.email','test@example.invalid']);git(w,['checkout','-b','main']);fs.writeFileSync(path.join(w,'a'),'a');git(w,['add','.']);git(w,['commit','-m','initial']);git(w,['push','-u','origin','main']);git(base,['--git-dir=remote.git','symbolic-ref','HEAD','refs/heads/main']);return {base,w,remote:path.join(base,'remote.git')}}
function load(w){const context={require(n){if(n==='axios')return {};if(n==='@google/generative-ai')return {GoogleGenerativeAI:class{getGenerativeModel(){return {}}}};if(n==='child_process')return {exec(c,o,cb){cp.exec(c,{...o,cwd:w},cb)}};return require(n)},process:{env:{GEMINI_API_KEY:'offline-stub'},cwd:()=>w,exit:c=>{throw Error('exit '+c)}},console:{log(){}},Date};vm.createContext(context);vm.runInContext(source+'\nglobalThis.update=updateCommitMessage;',context);return context.update}
(async()=>{let count=0;
function tip(s){return git(s.base,['--git-dir=remote.git','rev-parse','main'])}
function advance(s){git(s.base,['clone','remote.git','other']);const o=path.join(s.base,'other');git(o,['config','user.name','Other']);git(o,['config','user.email','other@example.invalid']);fs.writeFileSync(path.join(o,'new-work'),'important newer work');git(o,['add','.']);git(o,['commit','-m','newer work']);git(o,['push']);return git(o,['rev-parse','HEAD'])}
async function scenario(name,fn){await fn(init(name));count++;console.log('PASS '+name)}
try {
await scenario('normal',async s=>{const sha=tip(s);assert.equal(await load(s.w)('enhanced',sha),true);assert.notEqual(tip(s),sha);assert.equal(git(s.base,['--git-dir=remote.git','log','-1','--format=%s']),'enhanced')});
await scenario('remote-advanced',async s=>{const sha=tip(s),newer=advance(s);assert.equal(await load(s.w)('enhanced',sha),false);assert.equal(tip(s),newer);assert.match(git(s.base,['--git-dir=remote.git','ls-tree','--name-only','main']),/new-work/)});
await scenario('tracking-ref-refreshed',async s=>{const sha=tip(s),newer=advance(s);git(s.w,['fetch']);assert.equal(git(s.w,['rev-parse','origin/main']),newer);assert.equal(await load(s.w)('enhanced',sha),false);assert.equal(tip(s),newer)});
await scenario('local-head-moved',async s=>{const sha=tip(s);git(s.w,['commit','--allow-empty','-m','local-new']);const local=git(s.w,['rev-parse','HEAD']);assert.equal(await load(s.w)('enhanced',sha),false);assert.equal(git(s.w,['rev-parse','HEAD']),local);assert.equal(tip(s),sha)});
await scenario('missing-sha',async s=>{const sha=tip(s);assert.equal(await load(s.w)('enhanced'),false);assert.equal(git(s.w,['rev-parse','HEAD']),sha);assert.equal(tip(s),sha)});
await scenario('detached',async s=>{const sha=tip(s);git(s.w,['checkout','--detach']);assert.equal(await load(s.w)('enhanced',sha),false);assert.equal(git(s.w,['rev-parse','HEAD']),sha);assert.equal(tip(s),sha)});
await scenario('missing-upstream',async s=>{const sha=tip(s);git(s.w,['branch','--unset-upstream']);assert.equal(await load(s.w)('enhanced',sha),false);assert.equal(git(s.w,['rev-parse','HEAD']),sha);assert.equal(tip(s),sha)});
await scenario('renamed-remote-and-local-branch',async s=>{const sha=tip(s);git(s.w,['remote','rename','origin','publish']);git(s.w,['branch','-m','work']);assert.equal(await load(s.w)('enhanced',sha),true);assert.notEqual(tip(s),sha)});
await scenario('explicit-ref-only',async s=>{const sha=tip(s);git(s.w,['branch','other']);git(s.w,['push','origin','other']);git(s.w,['config','--add','remote.origin.push','refs/heads/other:refs/heads/main']);assert.equal(await load(s.w)('enhanced',sha),true);assert.notEqual(tip(s),sha);assert.equal(git(s.base,['--git-dir=remote.git','rev-parse','other']),sha)});
console.log(`${count} offline Git integration tests passed; no external services contacted.`);
} finally {fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
