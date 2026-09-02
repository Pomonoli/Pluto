const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const load=()=>import(pathToFileURL(path.join(__dirname,'../public/js/screen-wake-lock.js')).href);
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(request){
  const {createScreenWakeLock}=await load();
  const document=new EventTarget(),window=new EventTarget(),locks=[];
  document.visibilityState='visible';
  const navigator={wakeLock:{request:request||async function(type){
    assert.equal(type,'screen');const lock=new EventTarget();lock.released=false;
    lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'))};
    locks.push(lock);return lock;
  }}};
  const controller=createScreenWakeLock({navigator,document,window});
  return{controller,document,window,locks};
}

test('wake lock alleen actief tijdens zichtbaar spel, opnieuw na achtergrond en vrij na afloop',async()=>{
  const {controller,document,window,locks}=await harness();
  assert.equal(locks.length,0);controller.setActive(true);await settle();assert.equal(locks.length,1);
  controller.setActive(true);await settle();assert.equal(locks.length,1);
  document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(locks[0].released,true);
  document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(locks.length,2);
  window.dispatchEvent(new Event('pagehide'));await settle();assert.equal(locks[1].released,true);
  window.dispatchEvent(new Event('pageshow'));await settle();assert.equal(locks.length,3);
  controller.setActive(false);await settle();assert.equal(locks[2].released,true);
  document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(locks.length,3);
});

test('late wake lock na verlaten spel wordt meteen losgelaten zonder dubbele aanvraag',async()=>{
  let resolve,calls=0,released=false;
  const {controller}=await harness(()=>{calls++;return new Promise(done=>{resolve=done})});
  controller.setActive(true);controller.setActive(false);controller.setActive(true);
  assert.equal(calls,1);controller.setActive(false);
  resolve({release:async()=>{released=true}});await settle();assert.equal(released,true);
});

test('geweigerde of ontbrekende wake lock geeft geen fouten en geen herhaalde aanvragen per render',async()=>{
  let calls=0;const {controller}=await harness(async()=>{calls++;throw new Error('denied')});
  controller.setActive(true);await settle();controller.setActive(true);await settle();assert.equal(calls,1);
  controller.setActive(false);controller.setActive(true);await settle();assert.equal(calls,2);
  const {createScreenWakeLock}=await load(),document=new EventTarget(),window=new EventTarget();document.visibilityState='visible';
  createScreenWakeLock({navigator:{},document,window}).setActive(true);await settle();
});
