'use strict';

const MAP_STEPS = 15;
const SHOP_NAMES = {general:'旅商人',cards:'カード商',relic:'遺物商',medicine:'薬師',forge:'鍛冶屋'};
const ROUTE_KINDS = ['battle','elite','event','shop','camp','treasure','trail','boss'];
const TRAVELERS = {
  mercenary:{name:'旅の傭兵',price:35,text:'次の戦闘の開始時に防御+10。'},
  scout:{name:'道案内の斥候',price:30,text:'次の戦闘の初手を1枚追加。'},
  herbalist:{name:'旅の薬師',price:25,text:'次の戦闘で最初に受ける毒を無効化。'},
  trader:{name:'カードの行商人',price:0,text:'同じレアリティの別のカードに交換。'}
};

const LEGACY_MAP = [
  ['battle','battle','battle','battle','battle'],['battle','event','battle','battle','event'],
  ['battle','battle','event','battle','battle'],['elite','camp','battle','battle','event'],
  ['battle','battle','battle','battle','battle'],['battle','event','battle','battle','battle'],
  ['shop','camp','elite','battle','event'],['battle','battle','battle','battle','battle'],
  ['battle','elite','event','battle','battle'],['battle','camp','battle','battle','event'],
  ['battle','battle','shop','battle','battle'],['elite','battle','event','battle','battle'],
  ['battle','battle','battle','battle','battle'],['camp','camp','camp','shop','battle'],['boss','boss','boss']
];

function mixedNode() {
  const n = Math.random();
  if (n<.47) return 'battle';
  if (n<.59) return 'elite';
  if (n<.74) return 'shop';
  if (n<.86) return 'camp';
  if (n<.91) return 'treasure';
  return 'trail';
}

function makeExpedition(state, legacy = false) {
  const roles = ['combat', ...shuffled(['combat','side','story','companion','market','camp','cache',...Array(6).fill('mixed')])];
  const rows = roles.map((role,row)=>{
    const width = 3+Math.floor(Math.random()*3);
    if (legacy && row<state.path.length) return [...LEGACY_MAP[row]];
    if (role==='combat') return Array.from({length:width},()=>row>0 && Math.random()<.25?'elite':'battle');
    if (['side','story','companion'].includes(role)) return Array(width).fill('event');
    if (role==='market') return Array(width).fill('shop');
    if (role==='camp') return shuffled(['camp','shop','trail',...Array.from({length:width-3},()=>pick(['camp','shop']))]);
    if (role==='cache') return shuffled(['treasure','shop','trail',...Array.from({length:width-3},()=>pick(['treasure','camp']))]);
    return Array.from({length:width},mixedNode);
  });
  rows.push(['boss']);
  if (legacy && state.path.length===MAP_STEPS) state.path[14]=0;
  const positions = rows.map(row=>row.length===1?[50]:row.map((_,i)=>
    Math.round((i+.5)/row.length*100+(Math.random()-.5)*3)));
  const shops = rows.map(row=>{
    const kinds = shuffled(Object.keys(SHOP_NAMES));
    return row.map((kind,lane)=>kind==='shop'?kinds[lane%kinds.length]:null);
  });
  const links = positions.slice(0,-1).map((left,row)=>{
    const right = positions[row+1], edges = [];
    const add = (a,b)=>{if (!edges.some(([x,y])=>x===a&&y===b)) edges.push([a,b]);};
    left.forEach((x,a)=>{
      const near = right.map((v,b)=>({b,d:Math.abs(v-x)})).sort((p,q)=>p.d-q.d);
      add(a,near[0].b);
      if (near[1]?.d<35 && Math.random()<.65) add(a,near[1].b);
    });
    right.forEach((x,b)=>{
      if (edges.some(([,y])=>y===b)) return;
      const closest = left.reduce((best,v,a)=>Math.abs(v-x)<Math.abs(left[best]-x)?a:best,0);
      add(closest,b);
    });
    if (legacy && row+1<state.path.length) add(state.path[row],state.path[row+1]);
    return edges;
  });
  return {rows,positions,shops,links};
}

function validExpedition(map) {
  if (!map || !['rows','positions','shops','links'].every(key=>Array.isArray(map[key]))) return false;
  if (map.rows.length!==15 || map.positions.length!==15 || map.shops.length!==15 || map.links.length!==14) return false;
  return map.rows.every((row,i)=>{
    if (!Array.isArray(row) || !Array.isArray(map.positions[i]) || !Array.isArray(map.shops[i])) return false;
    if (i===14 ? row.length!==1 || row[0]!=='boss' : !between(row.length,3,5) || row.some(kind=>kind==='boss')) return false;
    return map.positions[i].length===row.length && map.shops[i].length===row.length
      && row.every((kind,lane)=>ROUTE_KINDS.includes(kind) && between(map.positions[i][lane],5,95)
        && (kind==='shop'?Object.hasOwn(SHOP_NAMES,map.shops[i][lane]):map.shops[i][lane]===null));
  }) && map.links.every((edges,row)=>Array.isArray(edges)
    && edges.every(edge=>Array.isArray(edge) && edge.length===2 && between(edge[0],0,map.rows[row].length-1)
      && between(edge[1],0,map.rows[row+1].length-1))
    && map.rows[row].every((_,i)=>edges.some(([a])=>a===i))
    && map.rows[row+1].every((_,i)=>edges.some(([,b])=>b===i)));
}

function routeLanes(state,row) {
  return state.expedition.rows[row]?.map((_,lane)=>lane) ?? [];
}

function nextLanes(state,row,lane) {
  return state.expedition.links[row]?.filter(([a])=>a===lane).map(([,b])=>b) ?? [];
}

function availableLanes(state) {
  const previous = state.path[state.row-1];
  return previous==null ? routeLanes(state,state.row) : nextLanes(state,state.row-1,previous);
}

const POTIONS = {
  small:{name:'小回復薬',desc:'購入時、HP15回復。',price:25,heal:15},
  large:{name:'大回復薬',desc:'購入時、HP32回復。',price:50,heal:32},
  detox:{name:'解毒の備え',desc:'次の戦闘で最初に受ける毒を無効化。',price:20,prep:'herbalist'},
  guard:{name:'防御薬',desc:'次の戦闘開始時、防御+12。',price:30,prep:'guard'},
  tonic:{name:'活力薬',desc:'次の戦闘中、筋力+1。',price:40,prep:'tonic'}
};
const BASE_SERVICE_PRICES = {heal:30,remove:55,upgrade:80,relic:160,trade:45,herbalist:25,scout:30,
  ...Object.fromEntries(Object.entries(POTIONS).map(([id,potion])=>[id,potion.price]))};

function makeShop(state,kind) {
  let cards=[], services=[];
  const factor=pick([.9,1,1.1]);
  if (kind==='general') {
    cards=whichCards('shop',3);
    services=shuffled(['small','remove','upgrade','relic']).slice(0,2);
  } else if (kind==='cards') {
    cards=['attack','defense','utility'].map(category=>pick(DATA.cards.filter(card=>card.category===category)).id);
    cards.push(...shuffled(DATA.cards.filter(card=>!cards.includes(card.id))).slice(0,3).map(card=>card.id));
    services=[pick(['small','remove'])];
  } else if (kind==='forge') {
    const offers=shuffled(['upgrade','trade','cards']).slice(0,2+Math.floor(Math.random()*2));
    if (offers.includes('cards')) cards=whichCards('shop',1);
    services=offers.filter(key=>key!=='cards');
  } else if (kind==='medicine') {
    const immediate=pick(['small','large']);
    services=[immediate,...shuffled(Object.keys(POTIONS).filter(id=>id!==immediate)).slice(0,2)];
  } else services=['relic'];
  const upgraded=kind==='forge'?[...cards]:[];
  const prices=cards.map(id=>Math.round({common:40,uncommon:65,rare:95}[CARDS[id].rarity]*factor)+(upgraded.includes(id)?40:0));
  const costs={...BASE_SERVICE_PRICES,remove:75+(state.removals||0)*20};
  if (kind==='general') {
    const discount=Math.floor(Math.random()*(cards.length+services.length));
    if (discount<cards.length) prices[discount]=Math.round(prices[discount]*.8);
    else {
      const key=services[discount-cards.length];
      costs[key]=Math.round(costs[key]*.8);
    }
  }
  return {kind,cards,prices,upgraded,costs,services,removed:false,used:[],
    relics:shuffled(DATA.relics.map(r=>r.id).filter(id=>!state.relics.includes(id))).slice(0,kind==='general'?1:3)};
}
