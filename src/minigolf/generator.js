'use strict';

const THEMES = ['gates','sandSnake','pinkBog','farm','boostRun','waterChicane','pinball','islands','crossroads','gauntlet'];
const DISPLAY = {
  gates:'Poortenrace',sandSnake:'Zandslang',pinkBog:'Roze Moeras',farm:'Boerderij',boostRun:'Boost Boulevard',
  waterChicane:'Waterchicane',pinball:'Pinball Park',islands:'Eilandhoppen',crossroads:'Kruispunt',gauntlet:'Hindernisbaan'
};

function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rand(rng,min,max){return min+rng()*(max-min)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function wall(x,y,w,h,i){return{id:`wall${i+1}`,x,y,w,h}}
function ellipse(type,cx,cy,rx,ry,i){return{id:`${type}${i+1}`,type,shape:'ellipse',cx,cy,rx,ry}}
function rect(type,x,y,w,h,i,r=18){return{id:`${type}${i+1}`,type,shape:'rect',x,y,w,h,r}}
function tree(cx,cy,i){return{id:`tree${i+1}`,kind:'tree',shape:'circle',cx,cy,r:27,destructible:true}}
function rock(cx,cy,i){return{id:`rock${i+1}`,kind:'rock',shape:'circle',cx,cy,r:26,destructible:false}}
function tractor(x,y,i){return{id:`tractor${i+1}`,kind:'tractor',shape:'rect',x,y,w:76,h:46,destructible:true}}
function hay(x,y,i){return{id:`hay${i+1}`,kind:'hay',shape:'rect',x,y,w:66,h:44,destructible:true}}
function boost(x,y,angle,i,strength=1.1){return{id:`boost${i+1}`,x,y,w:105,h:42,angle,strength}}

function baseMap(theme,seed,index,rng){
  const top=rng()<.5;
  const startY=top?rand(rng,82,142):rand(rng,378,438);
  const cupY=top?rand(rng,378,438):rand(rng,82,142);
  const startZone={x:38,y:clamp(startY-47,22,404),w:145,h:94,r:14};
  const difficulty={gates:'Normaal',sandSnake:'Normaal',pinkBog:'Moeilijk',farm:'Normaal',boostRun:'Makkelijk',waterChicane:'Moeilijk',pinball:'Moeilijk',islands:'Expert',crossroads:'Normaal',gauntlet:'Expert'}[theme];
  const max={Makkelijk:4,Normaal:5,Moeilijk:6,Expert:7}[difficulty];
  return {id:`smart-${theme}-${seed}-${index}`,name:`${DISPLAY[theme]} ${index+1}`,theme,gimmick:DISPLAY[theme],difficulty,maxStrokes:max,startZone,start:{x:startZone.x+startZone.w/2,y:startZone.y+startZone.h/2},cup:{x:rand(rng,785,835),y:cupY},terrain:[],walls:[],props:[],boosts:[]};
}
function routeY(map,x,bend=0){const t=clamp((x-map.start.x)/(map.cup.x-map.start.x),0,1);return map.start.y+(map.cup.y-map.start.y)*t+Math.sin(t*Math.PI)*bend}
function gatePair(map,x,y,gap,i){
  const topEnd=clamp(y-gap/2,70,440), bottomStart=clamp(y+gap/2,80,450);
  if(topEnd>42)map.walls.push(wall(x,22,36,topEnd-22,i*2));
  if(bottomStart<498)map.walls.push(wall(x,bottomStart,36,498-bottomStart,i*2+1));
}

function generate(theme,seed,index=0){
  const rng=mulberry32((seed+index*2654435761)>>>0);const map=baseMap(theme,seed,index,rng);const bend=rand(rng,-72,72);
  if(theme==='gates'){
    [285,465,645].forEach((x,i)=>gatePair(map,x,routeY(map,x,bend),rand(rng,112,142),i));
    if(rng()<.75)map.boosts.push(boost(525,routeY(map,575,bend)-21,Math.atan2(map.cup.y-routeY(map,575,bend),map.cup.x-575),0,1.08));
  }
  if(theme==='sandSnake'){
    [250,395,540,685].forEach((x,i)=>map.terrain.push(ellipse('sand',x,clamp(routeY(map,x,bend)+(i%2?74:-74),70,450),94,57,i)));
    map.props.push(tree(420,clamp(routeY(map,420,bend)-112,48,472),0),tree(650,clamp(routeY(map,650,bend)+112,48,472),1));
  }
  if(theme==='pinkBog'){
    [300,485,670].forEach((x,i)=>map.terrain.push(ellipse('cement',x,clamp(routeY(map,x,bend)+(i%2?58:-58),76,444),112,80,i)));
    gatePair(map,500,routeY(map,500,bend),128,0);
  }
  if(theme==='farm'){
    [300,470,640].forEach((x,i)=>{const y=routeY(map,x,bend);map.props.push(i===1?tractor(x-38,y-23,i):hay(x-33,y-22,i))});
    map.props.push(tree(360,clamp(routeY(map,360,bend)-118,45,475),3),tree(710,clamp(routeY(map,710,bend)+112,45,475),4));
    map.terrain.push(ellipse('sand',560,clamp(routeY(map,560,bend)+108,65,455),95,55,0));
  }
  if(theme==='boostRun'){
    const angle=Math.atan2(map.cup.y-map.start.y,map.cup.x-map.start.x);
    [245,430,615].forEach((x,i)=>map.boosts.push(boost(x-52,routeY(map,x,0)-21,angle,i,1.15+i*.08)));
    gatePair(map,365,routeY(map,365,0),120,0);gatePair(map,570,routeY(map,570,0),120,1);
  }
  if(theme==='waterChicane'){
    [310,505,685].forEach((x,i)=>map.terrain.push(ellipse('water',x,clamp(routeY(map,x,bend)+(i%2?120:-120),84,436),110,66,i)));
    map.terrain.push(ellipse('sand',565,clamp(routeY(map,565,bend)-82,72,448),88,50,4));
  }
  if(theme==='pinball'){
    [[300,-94],[390,90],[505,-84],[615,92],[705,-74]].forEach(([x,o],i)=>map.props.push(rock(x,clamp(routeY(map,x,bend)+o,55,465),i)));
    if(rng()<.75)map.boosts.push(boost(430,routeY(map,480,bend)-21,0,0,1.12));
  }
  if(theme==='islands'){
    [270,435,600].forEach((x,i)=>map.terrain.push(ellipse('water',x,clamp(routeY(map,x,bend)+(i%2?132:-132),88,432),112,72,i)));
    gatePair(map,385,routeY(map,385,bend),136,0);gatePair(map,590,routeY(map,590,bend),136,1);
    map.boosts.push(boost(475,routeY(map,525,bend)-21,Math.atan2(map.cup.y-routeY(map,525,bend),map.cup.x-525),0,1.15));
  }
  if(theme==='crossroads'){
    const y=routeY(map,465,0);map.terrain.push(rect('sand',345,y-55,240,110,0,22),rect('cement',435,65,100,390,0,22));
    map.props.push(tree(305,clamp(y-116,45,475),0),tree(640,clamp(y+116,45,475),1));
    map.boosts.push(boost(590,y-21,Math.atan2(map.cup.y-y,map.cup.x-590),0,1.06));
  }
  if(theme==='gauntlet'){
    map.terrain.push(ellipse('sand',300,clamp(routeY(map,300,bend)+108,70,450),95,55,0),ellipse('cement',555,clamp(routeY(map,555,bend)-92,75,445),95,65,0),ellipse('water',720,clamp(routeY(map,720,bend)+122,82,438),94,58,0));
    map.props.push(tractor(385,routeY(map,420,bend)-23,0),tree(545,clamp(routeY(map,545,bend)+110,45,475),1),rock(650,clamp(routeY(map,650,bend)-108,45,475),2));
    gatePair(map,500,routeY(map,500,bend),132,0);map.boosts.push(boost(690,routeY(map,742,bend)-21,Math.atan2(map.cup.y-routeY(map,742,bend),map.cup.x-742),0,1.2));
  }
  return map;
}

function generateSmartMap(seed,index=0,theme=null){return generate(theme||THEMES[index%THEMES.length],seed,index)}
module.exports={THEMES,DISPLAY,generateSmartMap};
