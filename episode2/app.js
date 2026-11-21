'use strict';

const root = document.querySelector('#game');
const types = {attack:'攻撃',defense:'防御',heal:'回復',utility:'術式'};
const rarityNames = {common:'コモン',uncommon:'アンコモン',rare:'レア'};
const nodes = {
  battle:['⚔️','通常戦闘','通常の敵と戦闘。勝利で金貨・カードと戦闘後回復。'],
  elite:['💀','精鋭','強敵に挑戦。勝利でレリックを獲得。'],
  event:['❔','事件','何が起きるかは選択次第。'],
  camp:['🔥','休息','回復・カード強化・1枚無料削除から選ぶ。'],
  treasure:['🎁','宝箱','金貨かカードを選ぶ。'],
  trail:['♧','旅路','旅人と出会い、取引や次の戦闘の準備ができる。'],
  shop:['⚖️','旅商人','カードの購入とデッキ整理。'],
  boss:['👑','階層ボス','この地域のボスに挑む。']
};
const endingIntro = {
  dawn:'最後の楔が砕かれ、誰も鍵にならない朝が来た。その朝、王墓を閉ざす古い鎖も切れた。',
  watch:'境界に帰路を照らす灯がともった。その光が王墓に届くと、扉を閉ざす鎖がほどけていった。',
  unknown:'放浪の騎士が妹と帰還し、封印は人を鍵にし続ける役目を失った。その変化は、王墓にも届いていた。'
};
const eventOptions = [
  {title:'消えかけた名札',text:'名をなぞると温かな灯がともった。火を旅に持ち出すこともできる。',options:['灯のそばに留まる · HP+12','灯を手放す · 35G']},
  {title:'封じられた供物',text:'古い器の封印がほころび、内側に金貨が見える。',options:['血で封を解く · HP−5、55G','封印を閉じ直す · HP+6']},
  {title:'旅人の置き土産',text:'誰かの荷物に、遠くへ行く者へと書いた札がかかっている。',options:['術式を書き取る · カード1枚','硬貨を受け取る · 25G']}
];
const caches = new Map();
const storage = {getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
let {state,corrupt,migrated} = readRun(storage);
let active = false, busy = false, overlay = '', index = -1, handPage = 0, listPage = 0, treeSelection = null, shopPage = 0;
let notice = '', difficulty = state?.difficulty ?? 'standard';
const esc = value => String(value).replace(/[&<>"']/g,x=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[x]));
const act = (label,action,value='',opts='') =>
  `<button type="button" data-action="${action}" data-value="${value}" ${opts}>${label}</button>`;
const primary = 'class="primary"';
const chapter = () => DATA.chapters[state.chapter];
const sceneArt = (ch,scene) => `assets/scene-${ch+1}-${scene}.webp`;
const bg = (ch,scene,css='illustration') =>
  `<div class="${css}" style="--scene:url('${sceneArt(ch,scene)}')" aria-hidden="true"></div>`;

async function loadBalance() {
  const key = state.difficulty+'-'+(state.chapter+1);
  if (caches.has(key)) return caches.get(key);
  const response = await fetch('balance-'+key+'.json?v=070');
  if (!response.ok) throw new Error('enemy data');
  const data = await response.json();
  caches.set(key,data);
  return data;
}

function persist() {
  if (!state) return;
  try { storage.setItem(SAVE,JSON.stringify(state)); }
  catch { notice = '自動保存できません。ブラウザの設定と空き容量を確認してください。'; }
}

function bars() {
  return `<div class="stat"><span>✚ HP</span><strong>${state.hp} / ${state.maxHp}</strong>
    <meter aria-label="HP" min="0" max="${state.maxHp}" value="${state.hp}"></meter></div>
    <div class="stat"><span>所持金</span><strong>${state.gold} G</strong></div>`;
}

function home() {
  const subtitle = state?.screen==='ending' ? '全8章クリア' : state ? `第${state.chapter+1}章 · ${esc(chapter().name)} · ${state.difficulty==='standard'?'標準':'熟練'}` : '深淵の呪術師';
  return `<section class="home">
    ${bg(0,0,'hero-art')}
    <div class="home-body">
      <div class="kicker">第2話</div>
      <h1>最初の王の遺言</h1>
      <p>${subtitle}</p>
      ${state?act('続きから','continue','',primary):''}
      <div class="two">${['standard','veteran'].map((key,i)=>act(i?'熟練':'標準','difficulty',key,
        `aria-pressed="${difficulty===key}"`)).join('')}</div>
      ${act(state?'最初から始める':'旅を始める','new','',state?'':primary)}
      ${corrupt?'<p role="alert">保存データを読み込めませんでした。</p>':''}
      <a href="../">話数選択へ</a>
    </div>
  </section>`;
}

function story() {
  const scene = chapter().scenes[state.scene];
  const branch = state.chapter===0 && state.scene===0 && state.page===0;
  const body = branch ? endingIntro[state.priorEnding]+' '+scene.pages[0] : scene.pages[state.page];
  const next = state.page===0?'次へ':state.scene===2?'戦闘へ':state.scene===3
    ? state.chapter===7?'結末へ':'次の章へ'
    : '旅路へ';
  return `<section class="story board">
    ${bg(state.chapter,state.scene)}
    <div class="story-text"><div class="kicker">${['到着','発見','決戦前','攻略後'][state.scene]} · ${state.page+1}/2</div>
      <h2>${scene.title}</h2><p>${body}</p>
    </div>
    ${act(next,'story-next','',primary)}
  </section>`;
}

function routeTop() {
  return `<div class="ep2-route-top">
    <div class="ep2-wordmark">ABYSS CHRONICLE<small>深淵の記録 · 第2話 · VER 0.74</small></div>
    <div class="ep2-hud">
      <span>♥ ${state.hp}/${state.maxHp}</span><span>◇ ${state.gold}G</span>
      ${act('デッキ '+state.deck.length,'deck')}${act('レリック '+state.relics.length,'relics')}
      ${act('物語','journey')}${act('⚙','menu','','aria-label="設定"')}
    </div>
    <a href="../">話数選択</a><div class="ep2-rule" aria-hidden="true">❖</div>
  </div>`;
}

function routeNode(row,lane) {
  const kind = state.expedition.rows[row][lane];
  const [icon,label,desc] = nodes[kind];
  return kind==='shop' ? [icon,SHOP_NAMES[state.expedition.shops[row][lane]],desc] : [icon,label,desc];
}

function mapScreen() {
  const options = availableLanes(state).slice().sort((a,b)=>a-b).map(lane=>{
    const kind = state.expedition.rows[state.row][lane];
    const [icon,label,desc] = routeNode(state.row,lane);
    return act(`<span class="route-icon">${icon}</span><span><b>${label}</b><small>${desc}</small></span><span aria-hidden="true">→</span>`,
      'node',lane,`class="route-choice ${kind}"`);
  });
  return `<section class="ep2-route" aria-label="ルート選択">
    ${routeTop()}
    <div class="map56-heading"><div><small>第${state.chapter+1}地域 · ${state.row+1}/15段目</small>
      <h1>${esc(chapter().name)}</h1></div>${act('道の全体図','tree','','class="ep2-gold"')}</div>
    <h2>進む道を選ぶ</h2>
    <div class="ep2-route-options">${options.join('')}</div>
    <div class="ep2-route-actions">${act('目的・道中の記録','journey','','class="ep2-gold"')}${act('地域をやり直す','retreat','','class="ep2-gold"')}</div>
    <div class="ep2-pagination">${act('前へ','noop','','disabled')}<span>1 / 1</span>${act('次へ','noop','','disabled')}</div>
  </section>`;
}

const TREE_GAP = 83;
const TREE_HEIGHT = MAP_STEPS*TREE_GAP+28;
const treeY = row => 48+(MAP_STEPS-1-row)*TREE_GAP;

const treeX = (row,lane) => state.expedition.positions[row][lane]*3.6;

function treeGraphic() {
  const links = state.expedition.links.flatMap((edges,row)=>edges.map(([a,b])=>{
    const y = treeY(row), nextY = treeY(row+1), x = treeX(row,a), nextX = treeX(row+1,b);
    const taken = state.path[row]===a && state.path[row+1]===b;
    const current = row===state.row-1 && state.path[row]===a;
    return `<path d="M ${x} ${y} C ${x} ${y-36}, ${nextX} ${nextY+36}, ${nextX} ${nextY}" class="${taken?'trail-done':current?'trail-next':''}"/>`;
  }));
  const rows = state.expedition.rows.map((_,row)=>{
    const markers = routeLanes(state,row).map(lane=>{
      const kind = state.expedition.rows[row][lane];
      const [icon,label] = routeNode(row,lane);
      const visited = row===14 ? state.path.length===15 : state.path[row]===lane;
      const current = row===state.row && availableLanes(state).includes(lane);
      return act(`<span>${visited?'✓':icon}</span><b>${label}</b>`,'tree-node',row*5+lane,
        `class="route-map-node ${kind} ${visited?'taken':''} ${current?'available':''} ${row<state.row&&!visited?'missed':''}"
        style="left:${treeX(row,lane)/3.6}%" aria-label="${row+1}段目 ${label}${visited?' 通過済み':''}"`);
    }).join('');
    return `<div class="route-map-row ${row===state.row?'current-row':''}" style="top:${treeY(row)}px"><span class="route-step-label">${row+1}</span>${markers}</div>`;
  }).join('');
  return `<div class="route-map parchment45" style="height:${TREE_HEIGHT}px">
    <svg viewBox="0 0 360 ${TREE_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">${links.join('')}</svg>${rows}</div>`;
}

function treeScreen() {
  const selection = treeSelection===null ? null : {
    row:Math.floor(treeSelection/5),lane:treeSelection%5
  };
  const selected = selection && routeNode(selection.row,selection.lane);
  const isAvailable = selection?.row===state.row && availableLanes(state).includes(selection.lane);
  const leadingTo = selection && nextLanes(state,selection.row,selection.lane)
    .map(lane=>routeNode(selection.row+1,lane)[1]).join(' ／ ');
  return `<section class="ep2-tree" role="dialog" aria-modal="true" aria-label="道の全体図">
    <header><h2>道の全体図</h2>${act('戻る ×','close','','class="ep2-gold"')}</header>
    <div class="ep2-tree-current"><span>下から上へ · 点線でつながる道だけ進めます</span>
      ${act('現在地へ','tree-current','','class="ep2-gold"')}</div>
    <div class="parchment-scroll45 route56-window ep2-tree-scroll" data-swipe-y
      role="region" aria-label="全15段のルート" tabindex="0">${treeGraphic()}</div>
    <div class="ep2-tree-below">
      ${act('現在地','tree-current','','class="ep2-gold"')}
      <p class="ep2-legend">${Object.values(nodes).map(([icon,label])=>`<span>${icon} ${label}</span>`).join('')}</p>
    </div>
    <div class="ep2-pagination">${act('前へ','noop','','disabled')}<span>1 / 1</span>${act('次へ','noop','','disabled')}</div>
    ${selected?`<div class="ep2-tree-details"><section class="dialog" role="group" aria-label="地点の詳細">
      ${act('閉じる','tree-detail-close','','class="close"')}
      <h2>${selection.row+1}段目 · ${selected[1]}</h2><p>${selected[2]}</p>
      <p>${isAvailable?'現在地から進めます。':selection.row<state.row?(state.path[selection.row]===selection.lane?'通過した道です。':'通らなかった道です。'):'点線でつながる地点に進めます。'}</p>
      ${leadingTo?'<p>この先：'+leadingTo+'</p>':''}
      ${isAvailable?act('ここへ進む','node',selection.lane,primary):''}
    </section></div>`:''}
  </section>`;
}

function focusTree() {
  const scroller = root.querySelector('.ep2-tree-scroll');
  if (scroller) scroller.scrollTop = treeY(state.row)-scroller.clientHeight*.55;
}

function intentText(enemy,battle) {
  const {kind,value,strong} = intent(enemy,battle);
  return {
    attack:(strong?'強攻撃 ':'攻撃 ')+value, defend:'防御 '+value, heal:'回復 '+value,
    poison:'毒 '+value, protect:'護衛 '+value, part:'ボスに防御 '+value,
    buff:'筋力 +'+value, charge:'大技の構え', stagger:'大技中断'
  }[kind] ?? '待機';
}

function tile(item,i,sel) {
  const card = CARDS[item.id];
  const {damage,block,actualHeal,hits,price} = projection(state,item,selectedEnemy(state.battle));
  const summary = [damage?(card.aoe?'全体 ':'')+damage+(hits>1?'×'+hits:'')+'打':'',
    block?'防御 '+block:'',card.heal?'回復 '+actualHeal:'',price?'HP−'+price:'',
    card.draw?'引く '+(card.draw+(item.upgraded?1:0)):''].filter(Boolean).join(' · ');
  const art = card.category==='attack'?(card.aoe?2:0):card.category==='defense'?1:card.category==='heal'?4:5;
  const unavailable = state.battle.energy<card.cost || state.hp<=(card.hp||0);
  return `<button class="b51-card rarity-${card.rarity} ${sel?'b52-selected':''} ${unavailable?'unaffordable':''}"
    data-action="card" data-value="${i}" aria-pressed="${sel}" aria-label="${card.name}${item.upgraded?'+':''}">
    <span class="b51-cost">${card.cost}</span><strong>${card.name}${item.upgraded?'+':''}</strong>
    <span class="card-paint card-paint-${art}" aria-hidden="true"></span>
    <span class="b52-effect">${summary||types[card.category]}</span><small>${types[card.category]}</small>
  </button>`;
}

function details(item, battle = null) {
  const card = CARDS[item.id], boost = item.upgraded;
  const f = projection(battle ? state : {...state,battle:null},item,battle?selectedEnemy(battle):null);
  const lines = [];
  if (battle && f.damage) {
    const targets = card.aoe ? battle.enemies.filter(e=>e.hp>0) : [selectedEnemy(battle)];
    for (const target of targets) {
      const damage = f.damageFor(target);
      const blocked = Math.min(target.block,damage*f.hits);
      lines.push(esc(target.name)+' '+damage+'ダメージ'+(f.hits>1?' ×'+f.hits:'')
        +(blocked?'（防御後 '+(damage*f.hits-blocked)+'）':''));
    }
  } else if (f.damage) {
    lines.push((card.aoe?'全体 ':'')+f.damage+'ダメージ'+(f.hits>1?' ×'+f.hits:''));
  }
  if (f.block) lines.push('防御 '+f.block);
  if (f.recovery) lines.push('HP回復 '+(battle?f.actualHeal+' / 最大'+f.recovery:f.recovery));
  if (f.price) lines.push('HP消費 '+f.price+'、代償 +'+(battle?Math.min(6-battle.price,f.price):f.price));
  if (card.spend) {
    const changes = [[card.bonusHit,'ダメージ'],[card.bonusBlock,'防御'],[card.bonusHeal,'回復'],[card.bonusEnergy,'エナジー']]
      .filter(([value])=>value).map(([value,label])=>label+'+'+value).join('、');
    lines.push('代償'+card.spend+'以上で消費 → '+changes+(battle?(f.spend?'（発動）':'（不足）'):''));
  }
  for (const [key,label,up] of [
    ['draw','ドロー',1],['weak','弱体',0],['vuln','脆弱',0],['poison','毒',0],['cleanse','毒を軽減',0],
    ['allWeak','全体弱体',0],['allVuln','全体脆弱',0],['str','筋力+',1],['dex','防御力+',1],
    ['passiveBlock','毎ターン防御',2],['passiveHeal','毎ターン回復',1]
  ]) {
    if (card[key]) lines.push(label+' '+(card[key]+(boost?up:0)));
  }
  if (card.exhaust || card.power) lines.push(card.power?'戦闘中持続・使用後除外':'使用後除外');
  return lines;
}

const CARDS_PER_PAGE = 5;
const enemySprites = [
  [/骸骨王|黎明を阻む王|騎士|衛兵|番兵/,6],
  [/蜘蛛/,8], [/狼|豹|猟犬/,9], [/樹/,10], [/亡霊|預言者|司祭|司書/,11],
  [/蛇|獣/,12], [/狩人|徴税官/,13], [/巨人|巨像|守護者/,14], [/黒炎|魔女/,15]
];

function enemySprite(enemy) {
  return enemySprites.find(([pattern])=>pattern.test(enemy.sourceName ?? enemy.name))?.[1]
    ?? (enemy.boss?6:enemy.index%2===0?11:15);
}

function hpBar(hp,maxHp) {
  const fill = Math.max(0,Math.min(100,100*hp/maxHp));
  return `<div class="b51-hp"><i style="width:${fill}%"></i><b>${hp} / ${maxHp}</b></div>`;
}

function battleScreen() {
  const battle = state.battle;
  const count = Math.max(1,Math.ceil(battle.hand.length/CARDS_PER_PAGE));
  handPage = Math.max(0,Math.min(handPage,count-1));
  const start = handPage*CARDS_PER_PAGE;
  const item = battle.hand[index], card = item && CARDS[item.id];
  const enemy = selectedEnemy(battle);
  const alive = battle.enemies.filter(e=>e.hp>0);
  const charging = alive.find(e=>e.boss && intent(e,battle).kind==='charge');
  const lock = card && (battle.energy<card.cost?'エナジー不足':state.hp<=(card.hp||0)?'HP不足':'');
  const projectionText = card ? details(item,battle) : [];
  const gauge = Array.from({length:6},(_,i)=>`<i class="${i<battle.price?'filled':''}"></i>`).join('');
  const intents = alive.map(e=>act(
    `<small>${e.index===enemy.index?'◆ ':''}${esc(e.name)}</small><b>${intentText(e,battle)}</b>`,
    'enemy',e.index,`class="b51-intent intent59 intent59-${intent(e,battle).kind} ${e.index===enemy.index?'selected':''}"`
  )).join('');
  const figures = alive.map(e=>act(
    `${e.part?'<span class="b51-part">✦</span>':`<span class="painted-character art-${enemySprite(e)}" aria-hidden="true"></span>`}
    <span class="b51-enemy-label">${e.index===enemy.index?'◆ ':''}${esc(e.name)}<small>HP ${e.hp} / ${e.maxHp}</small></span>`,
    'enemy',e.index,`class="b51-enemy ${e.index===enemy.index?'selected':''}" aria-pressed="${e.index===enemy.index}"`
  )).join('');
  return `<section class="battle51 ep2-combat" aria-label="戦闘画面">
    <div class="b51-header">
      ${act('≡','menu','','aria-label="メニュー"')}
      <div><b>ABYSS CHRONICLE</b><small>第${state.chapter+1}地域 · TURN ${battle.turn} · Ver.0.74</small></div>
      ${act(state.gold+'G','battle-status','','aria-label="自分の状態と所持金"')}
    </div>
    <div class="b51-health">
      ${act(`<strong>深淵の呪術師</strong>${hpBar(state.hp,state.maxHp)}<small>防御 ${battle.block} · 筋力 ${battle.str}${battle.poison?' · 毒 '+battle.poison:''} · 詳細 ›</small>`,'battle-status')}
      ${act(`<strong>${esc(enemy.name)}</strong>${hpBar(enemy.hp,enemy.maxHp)}<small>敵${alive.length}体 · タップで詳細</small>`,'enemy-info')}
    </div>
    <div class="b51-scene ep2-arena">
      <div class="b51-stage-top">
        ${act(`<small>エナジー</small><b>✦ ${battle.energy} / ${maxEnergy(state)}</b>`,'battle-status','','class="b51-energy"')}
        ${intents}
      </div>
      ${act(`<span>代償 ${battle.price} / 6</span><span class="ep2-gauge-cells">${gauge}</span>`,'rules','','class="ep2-sacrifice"')}
      ${charging?act(charging.staggered?'大技阻止成功':'大技阻止 '+battle.chargeDamage+' / '+battle.staggerNeed,'enemy-details',charging.index,'class="b51-boss"'):''}
      <div class="b51-hero hero51-occult" role="img" aria-label="深淵の呪術師"></div>
      <div class="b51-enemies b51-count-${alive.length}">${figures}</div>
      <div class="b51-floor"></div>
      ${act(esc(battle.log.at(-1)||'戦闘開始')+'　▸','log','','class="b51-lastlog"')}
    </div>
    <div class="b51-hand-heading"><span>手札 ${battle.hand.length}枚 · タップで選択</span>
      <div>${act('‹','hand',-1,`aria-label="前の手札" ${handPage===0?'disabled':''}`)}<span>${handPage+1}/${count}</span>
        ${act('›','hand',1,`aria-label="次の手札" ${handPage===count-1?'disabled':''}`)}</div>
    </div>
    <div class="b51-hand">${battle.hand.slice(start,start+CARDS_PER_PAGE).map((c,i)=>tile(c,i+start,index===i+start)).join('') || '<p>手札なし</p>'}</div>
    <div class="b52-usebar">
      <div>${card?`<strong>${card.name}${item.upgraded?'+':''} · ${card.cost} EN</strong>
        <p>${projectionText.slice(0,2).join(' · ')}</p>${act('全効果','card-info','','class="b52-more"')}`
        : '<strong>カードを選択</strong><p>手札をタップ → 敵を選択 → 使用する</p>'}</div>
      ${act(lock||'使用する','play','',(!card||lock)?'disabled':'')}
    </div>
    <div class="b51-actions ep2-battle-actions">
      ${act('山札<br><b>'+battle.pile.length+'</b>','pile')}
      ${act('捨て札<br><b>'+battle.discard.length+'</b>','discard')}
      ${act('ターン終了','end-turn','','class="b51-end"')}
      ${act('除外<br><b>'+battle.exhaust.length+'</b>','exhaust')}
    </div>
  </section>`;
}

function choiceCard(id,action,value,extra='',disabled=false) {
  const card = CARDS[id];
  return act(`<strong>${card.name}${extra}</strong><small>${card.cost} EN · ${types[card.category]} · ${rarityNames[card.rarity]}</small>
    <span>${details({id,upgraded:false}).join(' · ')}</span>`,action,value,
    `class="choice ${card.rarity}" ${disabled?'disabled':''}`);
}

function nodeScreen() {
  const s = state.screen;
  if (s === 'reward') {
    const r = state.reward;
    return `<section class="board options"><h2>勝利</h2><p>+${r.gold}G · HP+${r.recovered}${r.relic===null?'':' · 遺物「'+DATA.relics[r.relic].name+'」'}</p>
      <div class="choices">${r.cards.map((id,i)=>choiceCard(id,'reward',i)).join('')}</div>${act('カードを受け取らず進む','advance')}</section>`;
  }
  if (s === 'camp') return `<section class="board options">${bg(state.chapter,0,'short-art')}<h2>休息</h2>
    ${act('休む · HPを最大'+Math.max(15,Math.round(state.maxHp*.30))+'回復','rest','',primary)}
    ${act('カードを1枚強化','upgrade','',state.deck.every(c=>c.upgraded)?'disabled':'')}
    ${act('カードを1枚無料削除','remove','',state.deck.length<=8?'disabled':'')}</section>`;
  if (s === 'shop') return shopScreen();
  if (s === 'treasure') return `<section class="board options"><h2>🎁 宝箱</h2><p>金貨かカードを1つ選びます。</p>
    <div class="choices">${state.treasure.map((id,i)=>choiceCard(id,'treasure-card',i)).join('')}</div>
    ${act('金貨 40Gを受け取る','treasure-gold','',primary)}</section>`;
  if (s === 'trail') return trailScreen();
  if (s === 'event') {
    const e = eventOptions[state.event];
    return `<section class="board options">${bg(state.chapter,1,'short-art')}<h2>${e.title}</h2><p>${e.text}</p>
      ${e.options.map((label,i)=>act(label,'event',i,state.event===1&&i===0&&state.hp<=5?'disabled':'')).join('')}</section>`;
  }
  if (s === 'lost') return `<section class="board options">${bg(state.chapter,2,'short-art')}<h2>力尽きた</h2>
    <p>章の開始地点から、開始時のデッキ・遺物・HPで再挑戦できます。</p>
    ${act('この章をやり直す','retry','',primary)}${act('第2話タイトルへ','title')}</section>`;
  return `<section class="board options">${bg(7,3,'short-art')}<div class="kicker">第2話 完</div><h2>最初の王の遺言</h2>
    <p>全8章を踏破 · ${state.wins}勝</p>${act('第2話タイトルへ','title','',primary)}<a class="button" href="../">話数選択へ</a></section>`;
}

const servicePrices = {heal:30,remove:55,upgrade:80,relic:160,trade:45,herbalist:25,scout:30};
const serviceLabels = {heal:'HPを回復',remove:'カードを削除',upgrade:'カードを強化',relic:'レリックを見る',trade:'カードを交換',
  herbalist:'毒よけの薬を買う',scout:'初手＋1の薬を買う'};

function canUseService(key) {
  if (!state.shop.services.includes(key) || state.shop.used.includes(key) || state.gold<servicePrices[key]) return false;
  if (key==='remove') return state.deck.length>8 && !state.shop.removed;
  if (key==='upgrade') return state.deck.some(item=>!item.upgraded);
  if (key==='relic') return state.shop.relics.length>0;
  if (key==='herbalist' || key==='scout') return !state.prep;
  if (key==='heal') return state.hp<state.maxHp;
  return true;
}

function shopScreen() {
  const shop = state.shop;
  const pages = Math.max(1,Math.ceil(shop.cards.length/3));
  shopPage=Math.min(shopPage,pages-1);
  const start=shopPage*3;
  return `<section class="board options"><h2>⚖️ ${SHOP_NAMES[shop.kind]}</h2>
    <div class="choices">${shop.cards.slice(start,start+3).map((id,i)=>choiceCard(id,'buy',start+i,' · '+shop.prices[start+i]+'G',state.gold<shop.prices[start+i])).join('')}</div>
    ${pages>1?`<div class="page-row">${act('前へ','shop-page',-1,shopPage===0?'disabled':'')}<span>${shopPage+1}/${pages}</span>${act('次へ','shop-page',1,shopPage===pages-1?'disabled':'')}</div>`:''}
    <div class="two">${shop.services.map(key=>act(serviceLabels[key]+' · '+servicePrices[key]+'G','service',key,canUseService(key)?'':'disabled')).join('')}</div>
    ${act('店を出る','advance','',primary)}</section>`;
}

function useService(key) {
  state.gold-=servicePrices[key];
  state.shop.used.push(key);
}

function trailScreen() {
  const traveler = TRAVELERS[state.traveler];
  return `<section class="board options"><h2>${traveler.name}</h2><p>${traveler.text}</p>
    ${act(state.traveler==='trader'?'交換するカードを選ぶ':'準備する · '+traveler.price+'G','trail-trade','',
      state.traveler!=='trader'&&(state.prep||state.gold<traveler.price)?'disabled':primary)}
    ${act('取引せず通過','advance')}</section>`;
}

function overlayBody() {
  if (overlay === 'menu') return `<h2>メニュー</h2><div class="choices">
    ${act('第2話タイトルへ','title')}<a class="button" href="../">話数選択へ</a>
    ${act('代償の遊び方','rules')}${act('デッキを見る','deck')}${act('遺物を見る','relics')}
    </div>`;
  if (overlay === 'rules') return `<h2>代償の遊び方</h2><p>HPを使うカードで、消費したHPと同じだけ代償がたまります。上限は6です。HPが0になるカードは使用できません。</p>
    <p>代償はターンをまたいで持ち越し、戦闘後は0に戻ります。回復や敵からの被害では増減しません。</p>
    <p>「代償を消費」のカードは条件を満たすと自動で追加効果が出ます。ボスが大技を構えたら、そのターン中に必要ダメージを与えると中断できます。</p>`;
  if (overlay === 'relics') {
    return `<h2>遺物 ${state.relics.length}/12</h2>`+paged(state.relics,4,id=>{
      const relic = DATA.relics[id];
      return `<div class="entry"><strong>${relic.name}</strong><small>${relic.desc}</small></div>`;
    });
  }
  if (overlay === 'journey') return `<h2>目的・道中の記録</h2>
    <p>第${state.chapter+1}地域「${esc(chapter().name)}」</p><p>目的：${esc(chapter().boss)}を倒す</p>
    <p>到達：${state.row+1} / 15段　通算勝利：${state.wins}</p>`;
  if (overlay === 'battle-status') {
    const b = state.battle;
    return `<h2>深淵の呪術師</h2><p>HP ${state.hp} / ${state.maxHp} · ${state.gold}G · 防御 ${b.block}</p>
      <p>筋力 ${b.str} · 防御力 ${b.dex} · 毒 ${b.poison} · 弱体 ${b.weak}</p>
      ${act('遺物を見る','relics')}${act('代償の遊び方','rules')}`;
  }
  if (['pile','discard','exhaust'].includes(overlay)) {
    const label = {pile:'山札',discard:'捨て札',exhaust:'除外'}[overlay];
    const cards = state.battle[overlay];
    // Show the contents of the pile without revealing the future draw order.
    const items = overlay==='pile' ? [...cards].sort((a,b)=>a.id.localeCompare(b.id)) : cards;
    return `<h2>${label} ${cards.length}枚</h2>`+paged(items,4,item=>
      `<div class="entry"><strong>${CARDS[item.id].name}${item.upgraded?'+':''}</strong><small>${details(item).join(' · ')}</small></div>`);
  }
  if (overlay === 'log') return `<h2>戦闘履歴</h2><ol class="logs">${state.battle.log.map(l=>'<li>'+esc(l)+'</li>').join('')}</ol>`;
  if (overlay === 'card-info') {
    const item = state.battle.hand[index], card = CARDS[item.id];
    return `<h2>${card.name}${item.upgraded?'+':''}</h2><p>${card.cost} EN · ${types[card.category]} · ${rarityNames[card.rarity]}</p>
      <ul class="logs">${details(item,state.battle).map(l=>'<li>'+l+'</li>').join('')}</ul>`;
  }
  if (overlay === 'enemy-info') {
    const b = state.battle, e = selectedEnemy(b);
    return `<h2>${esc(e.name)}</h2><p>HP ${e.hp} / ${e.maxHp} · 防御 ${e.block} · 筋力 ${e.str}</p>
      <p>弱体 ${e.weak} · 脆弱 ${e.vuln} · 毒 ${e.poison}</p><p>次の行動　${intentText(e,b)}</p>
      ${intent(e,b).kind==='charge'?'<p>中断まで '+Math.max(0,b.staggerNeed-b.chargeDamage)+' ダメージ</p>':''}`;
  }
  if (overlay === 'retreat') return `<h2>地域をやり直しますか？</h2>
    <p>出発前の状態に戻り、道を再抽選します。</p>${act('やり直す','restart-region','',primary)}`;
  if (overlay === 'relic-shop') return `<h2>レリックを選ぶ</h2><div class="choices">
    ${state.shop.relics.map(id=>act(`<strong>${DATA.relics[id].name} · 160G</strong><small>${DATA.relics[id].desc}</small>`,
      'buy-relic',id,'class="entry"')).join('')}</div>`;
  if (overlay === 'confirm-new') return `<h2>最初から始めますか？</h2><p>現在の第2話の進行が上書きされます。</p>${act('新しい旅を始める','reset','',primary)}`;
  const title = {deck:'デッキ',upgrade:'強化するカード',remove:'削除するカード',trade:'交換に出すカード'}[overlay];
  return `<h2>${title} · ${state.deck.length}枚</h2>`+paged(state.deck,4,(item,i)=>{
    const card = CARDS[item.id];
    const label = `<strong>${card.name}${item.upgraded?'+':''} · ${card.cost}EN</strong><small>${details(item).join(' · ')}</small>`;
    return overlay==='deck'?'<div class="entry">'+label+'</div>':act(label,overlay+'-card',i,
      `class="entry" ${overlay==='upgrade'&&item.upgraded?'disabled':''}`);
  });
}

function paged(items,per,renderItem) {
  if (!items.length) return '<p>まだありません。</p>';
  const total = Math.ceil(items.length/per);
  listPage = Math.max(0,Math.min(listPage,total-1));
  return `<div class="choices">${items.slice(listPage*per,listPage*per+per).map((value,i)=>renderItem(value,listPage*per+i)).join('')}</div>
    <div class="page-row">${act('前へ','list-page',-1,listPage===0?'disabled':'')}<span>${listPage+1} / ${total}</span>
    ${act('次へ','list-page',1,listPage>=total-1?'disabled':'')}</div>`;
}

function render() {
  const game = active && state;
  const tree = game && overlay==='tree';
  const immersive = game && (tree || state.screen==='map' || state.screen==='battle');
  const content = !game ? home() : tree ? treeScreen() : state.screen==='story' ? story()
    : state.screen==='map' ? mapScreen() : state.screen==='battle' ? battleScreen() : nodeScreen();
  const scrollTop = tree ? root.querySelector('.ep2-tree-scroll')?.scrollTop : null;
  root.dataset.view = immersive ? (tree?'tree':state.screen) : 'normal';
  const chrome = immersive ? '' : `<header><div class="brand"><span>ABYSS CHRONICLE</span>
    <small>${game?'第'+(state.chapter+1)+'章 · '+chapter().name:'深淵の記録 · Ver.0.74'}</small></div>
    ${game?act('☰','menu','','aria-label="メニュー"'):''}</header>${game?'<div class="status">'+bars()+'</div>':''}`;
  root.innerHTML = `${chrome}<main>${content}</main>${notice?'<div role="status" class="notice">'+esc(notice)+'</div>':''}
    ${overlay&&!tree?`<div class="shade"><section class="dialog" role="dialog" aria-modal="true">
      ${act('閉じる','close','','class="close"')}${overlayBody()}</section></div>`:''}`;
  if (tree && scrollTop!=null) root.querySelector('.ep2-tree-scroll').scrollTop = scrollTop;
}

function start() {
  state = createRun(difficulty,previousEnding(storage));
  corrupt = false;
  active = true;
  overlay = '';
  index = -1; handPage = 0;
}

root.addEventListener('click',async event=>{
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || busy) return;
  const action = button.dataset.action, raw = button.dataset.value, n = Number(raw);
  notice = '';
  if (action === 'difficulty') difficulty = raw;
  else if (action === 'continue') active = true;
  else if (action === 'new') { if (state) overlay='confirm-new'; else start(); }
  else if (action === 'reset') start();
  else if (action === 'title') { overlay=''; active=false; }
  else if (action === 'close') overlay='';
  else if (action === 'tree' && state?.screen==='map') { overlay='tree'; treeSelection=null; }
  else if (action === 'tree-current' && overlay==='tree') { focusTree(); return; }
  else if (action === 'tree-node' && overlay==='tree' && routeLanes(state,Math.floor(n/5)).includes(n%5)) treeSelection=n;
  else if (action === 'tree-detail-close' && overlay==='tree') treeSelection=null;
  else if (['menu','deck','relics','log','rules','card-info','upgrade','remove','journey',
    'battle-status','enemy-info','pile','discard','exhaust','retreat'].includes(action)) {
    overlay=action; listPage=0;
  } else if (action==='list-page') listPage+=n;
  else if (!active || !state) return;
  else if (action === 'node' || action === 'story-next') {
    busy=true;
    button.disabled=true;
    try {
      const nodeType = action==='node' ? state.expedition.rows[state.row][n] : '';
      const needsBalance = ['battle','elite'].includes(nodeType) || action==='story-next' && state.scene===2 && state.page===1;
      const data = needsBalance ? await loadBalance() : null;
      if (action==='node') {
        if (chooseNode(state,n,data)) { overlay=''; shopPage=0; }
      } else nextStory(state,data);
      index=-1; handPage=0;
    } catch {
      notice='戦闘データを読み込めません。接続を確認して、もう一度タップしてください。';
    } finally { busy=false; }
  } else if (action==='card') index=n;
  else if (action==='hand') { handPage+=n; index=-1; }
  else if (action==='enemy-details') { state.battle.target=n; overlay='enemy-info'; }
  else if (action==='enemy') {
    const already = selectedEnemy(state.battle)?.index===n;
    state.battle.target=n;
    if (already) overlay='enemy-info';
  } else if (action==='play') { if (play(state,index)) index=-1; }
  else if (action==='end-turn') { enemyTurn(state); index=-1; handPage=0; }
  else if (action==='reward' && state.screen==='reward' && state.reward.cards[n]) {
    state.deck.push({id:state.reward.cards[n],upgraded:false}); advanceNode(state);
  } else if (action==='advance') advanceNode(state);
  else if (action==='rest' && state.screen==='camp') { heal(state,Math.max(15,Math.round(state.maxHp*.30))); advanceNode(state); }
  else if (action==='shop-page' && state.screen==='shop') shopPage=Math.max(0,shopPage+n);
  else if (action==='service' && state.screen==='shop' && canUseService(raw)) {
    if (['remove','upgrade','trade','relic'].includes(raw)) { overlay=raw==='relic'?'relic-shop':raw;listPage=0; }
    else {
      useService(raw);
      if (raw==='heal') heal(state,24); else state.prep=raw;
    }
  } else if (action==='buy-relic' && state.screen==='shop' && canUseService('relic') && state.shop.relics.includes(n)) {
    useService('relic'); earnRelic(state,n); overlay='';
  } else if (action==='upgrade-card' && state.deck[n] && !state.deck[n].upgraded) {
    if (state.screen==='camp' || state.screen==='shop' && canUseService('upgrade')) {
      state.deck[n].upgraded=true; overlay='';
      if (state.screen==='camp') advanceNode(state); else useService('upgrade');
    }
  } else if (action==='remove-card' && state.deck[n] && state.deck.length>8) {
    if (state.screen==='camp' || state.screen==='shop' && canUseService('remove')) {
      state.deck.splice(n,1); overlay='';
      if (state.screen==='camp') advanceNode(state);
      else { useService('remove'); state.shop.removed=true; }
    }
  } else if (action==='buy' && state.screen==='shop') {
    const id = state.shop.cards[n], price = state.shop.prices[n];
    if (id && state.gold>=price) {
      state.gold-=price; state.deck.push({id,upgraded:false});
      state.shop.cards.splice(n,1); state.shop.prices.splice(n,1);
    }
  } else if (action==='treasure-card' && state.screen==='treasure' && state.treasure[n]) {
    state.deck.push({id:state.treasure[n],upgraded:false}); advanceNode(state);
  } else if (action==='treasure-gold' && state.screen==='treasure') {
    state.gold+=40; advanceNode(state);
  } else if (action==='trail-trade' && state.screen==='trail') {
    const traveler = TRAVELERS[state.traveler];
    if (state.traveler==='trader') { overlay='trade'; listPage=0; }
    else if (!state.prep && state.gold>=traveler.price) {
      state.gold-=traveler.price; state.prep=state.traveler; advanceNode(state);
    }
  } else if (action==='trade-card' && state.deck[n] &&
    (state.screen==='trail' && state.traveler==='trader' || state.screen==='shop' && canUseService('trade'))) {
    const old=CARDS[state.deck[n].id];
    const replacement=pick(DATA.cards.filter(card=>card.id!==old.id && card.rarity===old.rarity));
    state.deck[n]={id:replacement.id,upgraded:false}; overlay='';
    if (state.screen==='trail') advanceNode(state); else useService('trade');
  } else if (action==='event' && state.screen==='event') {
    if (state.event===0) { if (n===0) heal(state,12); else state.gold+=35; }
    if (state.event===1) {
      if (n===0 && state.hp>5) {state.hp-=5;state.gold+=55;}
      else if (n===1) heal(state,6);
    }
    if (state.event===2) {
      if (n===0) {state.reward={gold:0,recovered:0,relic:null,cards:whichCards('battle',3)};state.screen='reward';}
      else state.gold+=25;
    }
    if (state.screen==='event') advanceNode(state);
  } else if (action==='retry' || action==='restart-region' && state.screen==='map') { overlay='';retryChapter(state); }
  if (state) persist();
  render();
});

if (migrated) persist();
render();
