const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

function element(tag,classes='',text=''){
  const names=new Set(classes.split(' '));
  return{tag,text,children:[],attributes:{},
    classList:{add:name=>names.add(name),remove:name=>names.delete(name),contains:name=>names.has(name),toggle:(name,on)=>on?names.add(name):names.delete(name)},
    append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
    setAttribute(name,value){this.attributes[name]=value}
  };
}

test('resultaatscherm houdt hostacties intact en geeft niet-hosts Rematch en Verlaten',async()=>{
  const {createGameUi}=await import(pathToFileURL(path.join(__dirname,'../public/js/game-ui.js')).href);
  const calls=[],els={gameStage:element('div'),gameResult:element('div')},state={selection:null};
  const ui=createGameUi({state,els,E:element,requestRematch:()=>calls.push('rematch'),requestReturnToLobby:()=>calls.push('lobby'),requestLeaveFinishedRoom:()=>calls.push('leave')});
  ui.registerPlugin('fixture',{render(){}});
  const room={isHost:true,players:[],gameState:{kind:'fixture',gameOver:true,resultText:''}};
  ui.renderGame(room);
  const card=els.gameResult.children[0],actions=card.children.at(-1).children;
  assert.deepEqual(actions.map(button=>button.text),['Rematch','Naar lobby','Sluiten']);
  actions[0].onclick();actions[1].onclick();assert.deepEqual(calls,['rematch','lobby']);
  actions[2].onclick();assert.equal(els.gameResult.classList.contains('hidden'),true);
  assert.equal(els.gameResult.attributes['aria-hidden'],'true');
  ui.renderGame({...room,isHost:false});
  const guestActions=els.gameResult.children[0].children.at(-1).children;
  assert.deepEqual(guestActions.map(button=>button.text),['Rematch','Verlaten']);
  guestActions[0].onclick();assert.equal(els.gameResult.classList.contains('hidden'),true);
  guestActions[1].onclick();assert.deepEqual(calls,['rematch','lobby','leave']);
  assert.equal(guestActions[1].classList.contains('danger-button'),true);
  ui.renderGame({...room,gameState:{kind:'fixture',gameOver:false}});
  assert.equal(els.gameResult.children.length,0);assert.equal(els.gameResult.classList.contains('hidden'),true);
});
