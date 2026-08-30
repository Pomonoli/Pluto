'use strict';

function publicCustomMap(engine,row,viewerUserId=null){
  let validation;
  try{const map=engine.sanitizeMapDefinition(row.map,{validate:false});validation=engine.validateMapPlayability(map)}
  catch(error){validation={ok:false,errors:[error.message||'Ongeldige map.']}}
  return {id:row.id,name:row.name,ownerName:row.ownerName,ownerUserId:row.ownerUserId,createdAt:row.createdAt,updatedAt:row.updatedAt,map:row.map,canEdit:Boolean(viewerUserId&&Number(viewerUserId)===Number(row.ownerUserId)),validation};
}

function configureHttp(engine,{app,db,requireUser}){
  app.get('/api/minigolf/maps',(req,res)=>{try{const viewer=db.getUserFromCookieHeader(req.headers.cookie);res.json({ok:true,maps:db.listMinigolfMaps().map(row=>publicCustomMap(engine,row,viewer?.id))})}catch(error){console.error(error);res.status(500).json({ok:false,error:'Maps konden niet geladen worden.'})}});
  app.post('/api/minigolf/maps',(req,res)=>{try{const user=requireUser(req,res);if(!user)return;const map=engine.sanitizeMapDefinition(req.body?.map||req.body||{}),row=db.createMinigolfMap(user.id,map.name,map);res.json({ok:true,map:publicCustomMap(engine,row,user.id)})}catch(error){res.status(400).json({ok:false,error:error.message||'Map kon niet opgeslagen worden.'})}});
  app.put('/api/minigolf/maps/:id',(req,res)=>{try{const user=requireUser(req,res);if(!user)return;const map=engine.sanitizeMapDefinition(req.body?.map||req.body||{}),row=db.updateMinigolfMap(Number(req.params.id),user.id,map.name,map);if(!row)return res.status(404).json({ok:false,error:'Map niet gevonden of niet van jou.'});res.json({ok:true,map:publicCustomMap(engine,row,user.id)})}catch(error){res.status(400).json({ok:false,error:error.message||'Map kon niet aangepast worden.'})}});
  app.delete('/api/minigolf/maps/:id',(req,res)=>{const user=requireUser(req,res);if(!user)return;const deleted=db.deleteMinigolfMap(Number(req.params.id),user.id);if(!deleted)return res.status(404).json({ok:false,error:'Map niet gevonden of niet van jou.'});res.json({ok:true})});
  app.post('/api/minigolf/test-shot',(req,res)=>{try{const map=engine.sanitizeMapDefinition(req.body?.map||{},{validate:false}),start={x:Number(req.body?.ball?.x??map.start.x),y:Number(req.body?.ball?.y??map.start.y)},result=engine.simulateShot(map,start,Number(req.body?.angle),Number(req.body?.power),Array.isArray(req.body?.removedPropIds)?req.body.removedPropIds.map(String):[]);res.json({ok:true,result})}catch(error){res.status(400).json({ok:false,error:error.message||'Testslag mislukt.'})}});
  app.get('/minigolf/editor',(_req,res)=>res.sendFile(require('node:path').join(__dirname,'../../public/index.html')));
}

module.exports={configureHttp,publicCustomMap};
