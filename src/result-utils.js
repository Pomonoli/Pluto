function competitionPlacements(items,valueSelector,descending=true){
  const values=[...new Set(items.map(valueSelector))].sort((a,b)=>descending?b-a:a-b);
  const places=new Map(values.map((value,index)=>[value,index+1]));
  return new Map(items.map((item)=>[item.id,places.get(valueSelector(item))]));
}

module.exports={competitionPlacements};
