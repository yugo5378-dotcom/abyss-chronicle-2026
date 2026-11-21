'use strict';

const SAVE = 'abyss_chronicle_episode2_v1';
const CARDS = Object.fromEntries(DATA.cards.map(card => [card.id, card]));
const STARTER = [0,0,1,1,4,5,20,20,20,25,34,40].map(n => 'e2_' + n);
const clone = item => JSON.parse(JSON.stringify(item));
const pick = array => array[Math.floor(Math.random() * array.length)];
const shuffled = array => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const between = (x, low, high) => Number.isInteger(x) && x >= low && x <= high;
const screenNames = ['hub','story','map','battle','reward','camp','shop','event','treasure','trail','lost','ending'];

function maxEnergy(state) {
  return state.chapter >= 1 ? 5 : 4;
}

function chapterStart(state) {
  Object.assign(state, {
    row: 0, lane: 1, screen: 'story', scene: 0, page: 0, path: [],
    battle: null, reward: null, shop: null, event: null, treasure:null, traveler:null, prep:null, removals:0, tradeOffers:{}
  });
  state.expedition = makeExpedition(state);
  state.checkpoint = {
    hp: state.hp, maxHp: state.maxHp, gold: state.gold, deck: clone(state.deck),
    relics: [...state.relics], wins: state.wins
  };
}

function createRun(difficulty, priorEnding) {
  const state = {
    version: 1, chapter: 0, journey:{cleared:0,seen:[]}, difficulty, priorEnding, hp: 72, maxHp: 72, gold: 80,
    deck: STARTER.map(id => ({id, upgraded:false})), relics: [], wins: 0
  };
  chapterStart(state);
  state.screen='hub';
  return state;
}

function validBuild(build) {
  return build && between(build.maxHp,72,500) && between(build.hp,0,build.maxHp)
    && between(build.gold,0,1000000) && between(build.wins,0,9999)
    && Array.isArray(build.deck) && between(build.deck.length,8,999)
    && build.deck.every(item => item && Object.hasOwn(CARDS,item.id) && typeof item.upgraded === 'boolean')
    && Array.isArray(build.relics) && build.relics.every(n => between(n,0,11))
    && new Set(build.relics).size === build.relics.length;
}

function readRun(storage) {
  try {
    const state = JSON.parse(storage.getItem(SAVE));
    if (!state) return {state:null};
    if (state.version !== 1 || !validBuild(state) || !validBuild(state.checkpoint)
      || !['standard','veteran'].includes(state.difficulty) || !['dawn','watch','unknown'].includes(state.priorEnding)
      || !between(state.chapter,0,7) || !between(state.row,0,14) || !between(state.lane,0,4)
      || !between(state.scene,0,3) || !between(state.page,0,1) || !screenNames.includes(state.screen)
      || !Array.isArray(state.path) || state.path.length>15
      || !state.path.every(n => between(n,0,4))) return {state:null, corrupt:true};
    if (state.screen === 'battle') {
      const battle = state.battle;
      if (!battle || !Array.isArray(battle.enemies) || !battle.enemies.some(enemy => enemy.hp>0)
        || !['hand','pile','discard','exhaust'].every(key => Array.isArray(battle[key])
          && battle[key].every(item => item && Object.hasOwn(CARDS,item.id)))
        || !Array.isArray(battle.log) || !between(battle.price,0,6)) return {state:null,corrupt:true};
    }
    if (state.screen==='reward' && (!Array.isArray(state.reward?.cards) ||
      !state.reward.cards.every(id=>Object.hasOwn(CARDS,id)) ||
      !(state.reward.relic==null || between(state.reward.relic,0,11)))) return {state:null,corrupt:true};
    if (state.screen==='event' && !between(state.event,0,2)) return {state:null,corrupt:true};
    if (state.screen === 'shop' && !Array.isArray(state.shop?.cards)) return {state:null,corrupt:true};
    const migrated=state.expedition==null;
    if (migrated) {
      if (!state.path.every((n,row)=>between(n,0,LEGACY_MAP[row].length-1))) return {state:null,corrupt:true};
      state.expedition=makeExpedition(state,true);
    }
    if (!validExpedition(state.expedition) || !state.path.every((n,row)=>between(n,0,state.expedition.rows[row].length-1))) {
      return {state:null,corrupt:true};
    }
    if (state.screen==='shop' && !state.shop.kind) {
      state.shop={...makeShop(state,'general'),...state.shop,prices:state.shop.cards.map(id=>({common:45,uncommon:65,rare:95}[CARDS[id].rarity])),services:['remove']};
    }
    if (state.screen==='shop' && (!Object.hasOwn(SHOP_NAMES,state.shop.kind) ||
      !Array.isArray(state.shop.prices) || state.shop.prices.length!==state.shop.cards.length ||
      !state.shop.cards.every(id=>Object.hasOwn(CARDS,id)) || !state.shop.prices.every(price=>between(price,1,10000)) ||
      !['services','used','relics'].every(key=>Array.isArray(state.shop[key])) ||
      !state.shop.services.every(key=>Object.hasOwn(BASE_SERVICE_PRICES,key)) ||
      !state.shop.relics.every(id=>between(id,0,11)) ||
      (state.shop.costs && !Object.values(state.shop.costs).every(price=>between(price,1,10000))) ||
      (state.shop.upgraded && !Array.isArray(state.shop.upgraded)))) return {state:null,corrupt:true};
    if (state.screen==='trail' && !Object.hasOwn(TRAVELERS,state.traveler)) return {state:null,corrupt:true};
    if (state.screen==='treasure' && !state.treasure?.every?.(id=>Object.hasOwn(CARDS,id))) return {state:null,corrupt:true};
    const journalMigrated=state.journey==null;
    if (journalMigrated) state.journey=legacyJourney(state);
    if (!validJourney(state.journey)) return {state:null,corrupt:true};
    if (state.replay && (!validBuild(state.replay) || state.replay.screen!=='hub' ||
      !validBuild(state.replay.checkpoint) || !between(state.replay.chapter,0,7) ||
      !validExpedition(state.replay.expedition) || state.replay.replay)) return {state:null,corrupt:true};
    return {state,migrated:migrated||journalMigrated};
  } catch {
    return {state:null,corrupt:true};
  }
}

function validJourney(journey) {
  return between(journey?.cleared,0,8) && Array.isArray(journey.seen)
    && journey.seen.length<=32 && new Set(journey.seen).size===journey.seen.length
    && journey.seen.every(id=>between(id,0,31));
}

function legacyJourney(state) {
  const cleared = state.screen==='ending'?8:state.chapter;
  const seen = Array.from({length:cleared*4},(_,i)=>i);
  if (cleared===8) return {cleared,seen};
  const read = state.screen==='story'?state.scene:state.row===14?3:state.row>=6?2:1;
  for (let i=0;i<read;i++) seen.push(state.chapter*4+i);
  return {cleared,seen};
}

function departRegion(state, chapter) {
  if (state.screen!=='hub' || !between(chapter,0,Math.min(7,state.journey.cleared))) return false;
  if (chapter<state.journey.cleared) state.replay=clone(state);
  state.chapter=chapter;
  state.hp=state.maxHp;
  chapterStart(state);
  return true;
}

function reachHub(state, completed=false) {
  if (state.replay) {
    const snapshot=state.replay, journal=state.journey;
    delete state.replay;
    Object.assign(state,snapshot,{journey:journal});
    return;
  }
  if (!completed) Object.assign(state,clone(state.checkpoint));
  state.screen='hub';
  state.hp=state.maxHp;
  state.battle=null;state.reward=null;state.shop=null;state.event=null;state.treasure=null;state.traveler=null;state.prep=null;
  state.path=[];state.row=0;state.lane=0;
}

function previousEnding(storage) {
  try {
    const id = JSON.parse(storage.getItem('abyss_chronicle_v01'))?.campaign?.epilogue20;
    return ['dawn','watch'].includes(id) ? id : 'unknown';
  } catch {
    return 'unknown';
  }
}

const relicValue = (state, kind) => DATA.relics.filter(r => r.kind === kind && state.relics.includes(r.id))
  .reduce((total, r) => total + r.value, 0);

function earnRelic(state, id) {
  if (!between(id,0,11) || state.relics.includes(id)) return;
  const relic = DATA.relics[id];
  state.relics.push(id);
  if (relic.kind === 'hp') {
    state.maxHp += relic.value;
    state.hp += relic.value;
  }
}

function whichCards(kind, count) {
  const exclude = new Set();
  return Array.from({length:count}, () => {
    const odds = Math.random();
    const rare = kind === 'boss' || odds < (kind === 'elite' ? .25 : .10);
    const rarity = rare ? 'rare' : odds < .64 ? 'uncommon' : 'common';
    const card = pick(DATA.cards.filter(c => c.rarity === rarity && !exclude.has(c.id)));
    exclude.add(card.id);
    return card.id;
  });
}

function chooseNode(state, lane, balance) {
  if (state.screen !== 'map' || !availableLanes(state).includes(lane)) return false;
  const kind = state.expedition.rows[state.row][lane];
  state.lane = lane;
  state.path.push(lane);
  if (kind === 'boss') {
    state.screen = 'story'; state.scene = 2; state.page = 0;
  } else if (kind === 'battle' || kind === 'elite') {
    beginBattle(state, kind, balance);
  } else {
    state.screen = kind;
    if (kind === 'shop') state.shop = makeShop(state,state.expedition.shops[state.row][lane]);
    if (kind === 'treasure') state.treasure = whichCards('elite',3);
    if (kind === 'trail') state.traveler = pick(Object.keys(TRAVELERS));
    if (kind === 'event') state.event = pick([0,1,2]);
  }
  return true;
}

function nextStory(state, balance) {
  if (state.page === 0) { state.page = 1; return; }
  const sceneId=state.chapter*4+state.scene;
  if (!state.journey.seen.includes(sceneId)) state.journey.seen.push(sceneId);
  if (state.scene === 2) { beginBattle(state,'boss',balance); return; }
  if (state.scene === 3) {
    if (state.replay) { reachHub(state,true); return; }
    state.journey.cleared=Math.max(state.journey.cleared,state.chapter+1);
    if (state.chapter === 7) { state.screen = 'ending'; return; }
    state.chapter++;
    state.maxHp += 5;
    state.hp = state.maxHp;
    state.gold += 35;
    reachHub(state,true);
    return;
  }
  state.screen = 'map';
}

function advanceNode(state) {
  if (state.row === 14) {
    state.screen = 'story'; state.scene = 3; state.page = 0;
  } else {
    state.row++;
    if (state.row === 6) { state.screen = 'story'; state.scene = 1; state.page = 0; }
    else state.screen = 'map';
  }
  state.reward = null;
  state.shop = null;
  state.event = null;
  state.treasure = null;
  state.traveler = null;
  state.tradeOffers = {};
}

function retryChapter(state) {
  Object.assign(state, clone(state.checkpoint));
  chapterStart(state);
}

function readyEnemy(entry, name, index, extras = {}) {
  return {...entry, name, index, maxHp:entry.hp, block:0, str:0, weak:0, vuln:0, poison:0,
    step:0, phase:0, staggered:false, ...extras};
}

function formation(state, type, balance) {
  const chapter = DATA.chapters[state.chapter];
  if (type === 'boss') return balance.boss.map((entry,index) =>
    readyEnemy(entry, entry.part ? '封印の核' : chapter.boss,index,{boss:!entry.part})
  );
  const entries = balance.road[state.row][type].map(i => balance.table[i]);
  const count = type === 'battle' && state.row > 1 && state.chapter > 0
    && entries.some(e=>e.count===3) && Math.random()<.20 ? 3 : 2;
  const pool = entries.filter(e=>e.count===count);
  const front = pool.filter(e=> type === 'elite' ? e.role === '隊長' : e.combatRole === 'striker');
  const back = pool.filter(e=>type === 'elite' ? e.role !== '隊長' : e.combatRole !== 'striker');
  const first = pick(front.length ? front : pool);
  const other = back.length ? back : pool;
  return [first,...Array.from({length:count-1},()=>pick(other))].map((entry,index)=>
    readyEnemy(entry,chapter.enemies[type==='elite' && index===0?3:index],index));
}

function addLog(battle, message) {
  battle.log = [...battle.log.slice(-7), message];
}

function beginBattle(state, type, balance) {
  const battle = state.battle = {
    type, enemies:formation(state,type,balance), escort:balance.escort ?? null, escortSummoned:false,
    staggerNeed:balance.stagger ?? 18, chargeDamage:0, nextEnemy:3,
    turn:0, price:0, energy:0, block:0, poison:0, weak:0,
    // Chapter growth offsets the longer health bars and keeps early cards usable.
    str:3+state.chapter*3+relicValue(state,'str'), dex:3+state.chapter*3+relicValue(state,'dex'),
    passiveBlock:0, passiveHeal:0, spentDraw:false,
    hand:[], pile:shuffled(state.deck), discard:[], exhaust:[], target:0, log:[]
  };
  battle.enemies.forEach(enemy => {
    enemy.weak = relicValue(state,'weak');
    enemy.vuln = relicValue(state,'vuln');
  });
  state.screen = 'battle';
  addLog(battle,'戦闘開始');
  battle.prep=state.prep;
  state.prep=null;
  startTurn(state);
}

function draw(battle, count) {
  for (let i=0; i<count && battle.hand.length < 10; i++) {
    if (!battle.pile.length) {
      battle.pile = shuffled(battle.discard);
      battle.discard = [];
    }
    if (!battle.pile.length) return;
    battle.hand.push(battle.pile.pop());
  }
}

function heal(state, amount) {
  const added = Math.min(amount,state.maxHp-state.hp);
  state.hp += added;
  return added;
}

function startTurn(state) {
  const battle = state.battle;
  battle.turn++;
  battle.spentDraw = false;
  battle.energy = maxEnergy(state);
  battle.block = battle.passiveBlock;
  battle.chargeDamage = 0;
  if (battle.passiveHeal) heal(state,battle.passiveHeal);
  if (battle.turn === 1) {
    battle.block += relicValue(state,'block') + (battle.prep==='mercenary'?10:battle.prep==='guard'?12:0);
    if (battle.prep==='tonic') battle.str++;
    battle.energy += relicValue(state,'energy');
  }
  draw(battle, 5 + (state.chapter >= 2 ? 1 : 0) + (battle.turn === 1 ? relicValue(state,'draw') + (battle.prep==='scout'?1:0) : 0));
  for (const enemy of battle.enemies) enemy.phase = Number(enemy.hp*2 <= enemy.maxHp);
  const charging = battle.enemies.some(enemy => enemy.hp>0 && enemy.boss && intent(enemy,battle).kind==='charge');
  if (charging && battle.escort && !battle.escortSummoned) {
    battle.escortSummoned = true;
    battle.enemies.push(readyEnemy(battle.escort,'儀式の護衛',battle.nextEnemy++,{escort:true}));
  }
}

function intent(enemy,battle) {
  if (enemy.part) return {kind:'part',value:6};
  const cycle = enemy.phases[enemy.phase ?? 0];
  const [kind, base, strong] = cycle[enemy.step % cycle.length];
  let value = base;
  if (kind === 'attack') {
    if (strong && enemy.staggered) return {kind:'stagger',value:0};
    value = Math.floor((base+enemy.str)*(enemy.weak>0?.75:1));
    if (strong && battle.enemies.some(e=>e.part && e.hp===0)) value=Math.floor(value*.75);
  }
  return {kind,value,strong};
}

function selectedEnemy(battle) {
  return battle.enemies.find(e=>e.index === battle.target && e.hp>0)
    ?? battle.enemies.find(e=>e.hp>0);
}

const ROYAL_EMBER = {firstChapter:5,energy:1,recovery:12};

function royalEmberStatus(state) {
  const battle=state.battle;
  if (state.screen!=='battle' || battle?.type!=='boss' || state.chapter<ROYAL_EMBER.firstChapter) return null;
  const recovered=Math.min(ROYAL_EMBER.recovery,state.maxHp-state.hp);
  const reason=battle.royalEmberUsed?'使用済み':battle.energy<ROYAL_EMBER.energy?'EN不足':!recovered?'HP満タン':'';
  return {recovered,reason};
}

function useRoyalEmber(state) {
  const status=royalEmberStatus(state);
  if (!status || status.reason) return false;
  const battle=state.battle;
  battle.energy-=ROYAL_EMBER.energy;
  battle.royalEmberUsed=true;
  addLog(battle,'王の残火 · HP+'+heal(state,status.recovered));
  return true;
}

function projection(state, item, enemy = null) {
  const card = CARDS[item.id], battle = state.battle;
  const price = card.hp || 0;
  const available = battle ? Math.min(6,battle.price+price) : 0;
  const spend = Boolean(card.spend && available >= card.spend);
  const damage = (target) => {
    const base = card.hit || card.aoe || 0;
    if (!base) return 0;
    const beforeStatus = base+(item.upgraded?3:0)+(battle?.str || 0)+(spend?(card.bonusHit||0):0);
    return Math.floor(Math.floor(beforeStatus*(battle?.weak>0?.75:1))*(target?.vuln>0?1.5:1));
  };
  const block = card.block ? card.block+(item.upgraded?3:0)+(battle?.dex || 0)+(spend?(card.bonusBlock||0):0) : 0;
  const recovery = card.heal ? card.heal+(item.upgraded?2:0)+(spend?(card.bonusHeal||0):0) : 0;
  return {
    price, spend, damage:damage(enemy), damageFor:damage, block,
    recovery, actualHeal:Math.min(recovery,state.maxHp-state.hp+price),
    hits:card.hits||1, energy:spend?(card.bonusEnergy||0):0,
    draw:(card.draw||0)+(card.draw && item.upgraded?1:0)+(spend?(card.bonusDraw||0):0),
    allWeak:(card.allWeak||0)+(spend?(card.bonusAllWeak||0):0),
    allVuln:(card.allVuln||0)+(spend?(card.bonusAllVuln||0):0)
  };
}

function damageEnemy(enemy, amount, battle, bypass = false) {
  const blocked = bypass ? 0 : Math.min(enemy.block,amount);
  enemy.block -= blocked;
  const lost = Math.min(enemy.hp,amount-blocked);
  enemy.hp -= lost;
  if (lost && enemy.boss && intent(enemy,battle).kind === 'charge') {
    battle.chargeDamage += lost;
    if (battle.chargeDamage >= battle.staggerNeed && !enemy.staggered) {
      enemy.staggered = true;
      addLog(battle,'大技を中断した');
    }
  }
  return lost;
}

function play(state, index) {
  if (state.screen !== 'battle') return false;
  const battle = state.battle;
  const item = battle.hand[index];
  if (!item) return false;
  const card = CARDS[item.id];
  const enemy = selectedEnemy(battle);
  const result = projection(state,item,enemy);
  if (battle.energy < card.cost || state.hp <= result.price || !enemy) return false;
  battle.hand.splice(index,1);
  battle.energy -= card.cost;
  state.hp -= result.price;
  battle.price = Math.min(6,battle.price+result.price);
  if (result.spend) battle.price -= card.spend;
  const living = battle.enemies.filter(e=>e.hp>0);
  const targets = card.aoe ? living : [enemy];
  let dealt = 0;
  for (const target of targets) {
    const perHit = result.damageFor(target);
    for (let hit=0; hit<result.hits && target.hp>0; hit++) dealt += damageEnemy(target,perHit,battle);
  }
  enemy.weak += card.weak || 0;
  enemy.vuln += card.vuln || 0;
  enemy.poison += card.poison || 0;
  for (const target of living) {
    target.weak += result.allWeak;
    target.vuln += result.allVuln;
  }
  const healed = heal(state,result.recovery);
  battle.block += result.block;
  battle.poison = Math.max(0,battle.poison-(card.cleanse||0));
  battle.str += (card.str||0) + (card.str && item.upgraded ? 1 : 0);
  battle.dex += (card.dex||0) + (card.dex && item.upgraded ? 1 : 0);
  battle.passiveHeal += (card.passiveHeal||0) + (card.passiveHeal && item.upgraded ? 1 : 0);
  battle.passiveBlock += (card.passiveBlock||0) + (card.passiveBlock && item.upgraded ? 2 : 0);
  battle.energy += result.energy;
  addLog(battle,[card.name,dealt?dealt+'ダメージ':'',result.block?'防御+'+result.block:'',
    healed?'HP+'+healed:'',result.price?'HP−'+result.price:'',result.spend?'代償−'+card.spend:''].filter(Boolean).join(' · '));
  draw(battle,result.draw);
  if (result.spend && card.spend===6 && !battle.spentDraw && relicValue(state,'spendDraw')) {
    draw(battle,1); battle.spentDraw=true;
  }
  (card.exhaust || card.power ? battle.exhaust : battle.discard).push(item);
  checkWin(state);
  return true;
}

function enemyTurn(state) {
  if (state.screen !== 'battle') return;
  const battle = state.battle;
  for (const enemy of battle.enemies) enemy.block = 0;
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.poison) damageEnemy(enemy,enemy.poison--,battle,true);
    if (!enemy.hp) continue;
    const {kind,value,strong} = intent(enemy,battle);
    const living = battle.enemies.filter(e=>e.hp>0);
    if (kind === 'attack') {
      const block = Math.min(battle.block,value);
      battle.block -= block;
      state.hp = Math.max(0,state.hp-(value-block));
      addLog(battle,enemy.name+' · '+(value-block)+'ダメージ'+(block?'（防御 '+block+'）':''));
    }
    if (kind === 'poison') {
      if (battle.prep==='herbalist') battle.prep=null;
      else battle.poison += value;
    }
    if (kind === 'defend') enemy.block += value;
    if (kind === 'buff') enemy.str += value;
    if (kind === 'heal') {
      const target = [...living].sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
      target.hp = Math.min(target.maxHp,target.hp+value);
    }
    if (kind === 'protect' || kind === 'part') {
      const target = living.find(e=>e.boss || e.combatRole==='striker' && e!==enemy) ?? enemy;
      target.block += value;
    }
    if (kind==='stagger' || strong) enemy.staggered = false;
    enemy.step++;
    enemy.weak = Math.max(0,enemy.weak-1);
    enemy.vuln = Math.max(0,enemy.vuln-1);
    if (state.hp === 0) break;
  }
  if (state.hp>0 && battle.poison) {
    state.hp = Math.max(0,state.hp-battle.poison);
    addLog(battle,'毒 · '+battle.poison+'ダメージ');
    battle.poison--;
  }
  if (!state.hp) { state.screen='lost'; return; }
  if (checkWin(state)) return;
  battle.discard.push(...battle.hand);
  battle.hand = [];
  battle.weak = Math.max(0,battle.weak-1);
  startTurn(state);
}

function checkWin(state) {
  const battle = state.battle;
  const boss = battle.enemies.find(enemy => enemy.boss);
  if (boss ? boss.hp>0 : battle.enemies.some(enemy => enemy.hp>0)) return false;
  state.wins++;
  const elite = battle.type === 'elite', bossFight = battle.type === 'boss';
  const gold = (bossFight?95:elite?52:28)+relicValue(state,'gold');
  state.gold += gold;
  const recovered = heal(state,(bossFight?18:elite?14:10)+relicValue(state,'winHeal')+(elite||bossFight?relicValue(state,'eliteHeal'):0));
  const remaining = DATA.relics.filter(relic=>!state.relics.includes(relic.id));
  const relic = (elite||bossFight) && remaining.length ? pick(remaining) : null;
  if (relic) earnRelic(state,relic.id);
  state.reward = {gold,recovered,relic:relic?.id??null,cards:whichCards(battle.type,3)};
  state.battle = null;
  state.screen = 'reward';
  return true;
}
