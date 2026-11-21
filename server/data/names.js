// مولّد أسماء مستخدمين واقعية ومتنوعة جداً
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;

const EN_WORDS = ['ghost','shadow','luna','nova','pixel','toxic','sleepy','night','wolf','raven','neon','void','echo','storm','frost','blaze','cyber','lazy','salty','crispy','potato','noodle','mango','panda','cookie','vibe','chaos','zero','glitch','nobody','random','silent','dark','lost','moon','sun','sky','ocean','candy','cherry','honey','berry','tiger','fox','bunny','kitty','dragon','ninja','sniper','gamer','legend','king','queen','prince','boss','bro','dude','dad','mom','sis'];
const EN_FIRST_M = ['adam','omar','ali','zak','sam','leo','max','noah','yusuf','kareem','jad','rami','fadi','hadi','sami','tariq','faris','ziad','ahmed','mo','hamza','bilal','jake','ryan','alex','liam','ethan','josh','mike','dan'];
const EN_FIRST_F = ['mia','lina','sara','noor','dana','rose','luna','lara','yara','maya','jana','reem','hala','lily','emma','sophie','zoe','ella','nour','layla','tala','rana','dima','hiba','sally','jojo','mimi','lulu'];
const AR_FIRST_M = ['محمد','عبدالله','فهد','سعود','تركي','بندر','نايف','مشاري','ياسر','عمر','أحمد','مصطفى','كريم','حسن','حسين','علي','عباس','حيدر','زياد','رامي','جاد','شادي','وليد','بدر','ناصر','خالد','سلطان','مازن','هاني','طارق'];
const AR_FIRST_F = ['نورة','سارة','ريم','لمى','جود','شهد','غلا','دانة','مها','هيا','منى','رنا','هبة','آية','ملك','زينب','فاطمة','رهف','لين','تالا','جنى','سلمى','ياسمين','دعاء','شيماء','نوف','العنود','وعد','رزان','ميار'];
const AR_NICK = ['مزاجي','الزعيم','حبة كرز','قهوة مرة','الهادي','عابر سبيل','مجهول','مالي خلق','فاضي','نعسان','جوعان','سادة','بلا اسم','واحد من الناس','بطاطس'];
const AR_NICK_REGION = { SA: ['أبو فهد','أبو عزوز','ولد الديرة','بنت الرياض','كبسة','خبل','طفشان'], KW: ['ولد الفريج','مچبوس','يبا'], EG: ['ابن البطة السودا','ملوخية','مش فاهم','زهقانة','ابن النيل'], LB: ['بنت الشام','منقوشة','ولك'], SY: ['بنت الشام','ابن الشام','شب حلبي'], IQ: ['ابن بغداد','بنت الرافدين','دولمة','ابو گلبين'], JO: ['منسف','نشمي','نشمية'], PS: ['ابن القدس','مسخن'] };
const SURNAMES = { SA: ['العتيبي','الشمري','القحطاني','الدوسري','الحربي','الغامدي','الزهراني'], EG: ['المصري','السيد','عبدالرحمن','حسن','منصور'], LB: ['خليل','حداد','نصرالله','الحاج'], SY: ['الحلبي','الشامي','الخطيب'], IQ: ['البغدادي','الجبوري','العبيدي','الموصلي'], KW: ['الكويتي','العنزي','المطيري','الرشيدي'], JO: ['العبادي','الزعبي','المجالي'], PS: ['الخطيب','عودة','جابر'] };
const AR_ABBR = ['سـ','ن','ع','م','ر','ف','ح','ك','ج','ش','ل','د'];
const SYMBOLS = ['♡','✿','☾','★','✦','⚡','♛','☁','❀','✧','⛧','∞','♪','☯','✖','…','...','.','?','!!','—','~','°','•'];
const EMOJI = ['☕','🌹','🐱','👀','💀','🔥','🌙','🍕','🎮','🦋','🖤','🐸','🍓','🥀','😶','🤡','🐼','🌸','👻','🍩','🦊','🍉','🌚','🫠'];
const WEIRD = ['xqzw','aaaaa','zzz','hmm','ok','idk','lol','brb','afk','asdfgh','qwerty','bruh','meh','uwu','owo','null','undefined','NaN','root','admin','test123','new_user','deleted','[removed]','who','?','N','X','K','J','Unknown','NoName','whoami','404','000','1','7','69420'];
const FUNNY = ['just_a_guy','coffee addict','notyourboy','not_a_bot','your_moms_wifi','i_lost_again','sleep_is_for_weak','ex_gamer','professional_lurker','bad_at_games','mr_noob','tea_over_coffee','chicken_nugget','sad_potato','wifi_thief','error_404_skill','mom_said_ok','kebab_lover','pls_carry_me','camping_noob','bored_af','still_loading','no_skill_issue','mr_lag'];
const PLAIN = ['user','guest','viewer','player','member','account','person','acc'];
const ARABIZI = ['m7md','3bdullah','7amoodi','5alid','3mr','7sn','3li','m3ath','3zooz','6arq','fahad_7','sa3ood','no0ora','sh7ad','3nood','j0od','7oor'];

function decorate(s) {
  const r = Math.random();
  if (r < 0.12) return 'xX' + s + 'Xx';
  if (r < 0.2) return 'xx.' + s + '.xx';
  if (r < 0.3) return s + '_' + rint(1, 99);
  if (r < 0.38) return s + rint(1990, 2011);
  if (r < 0.45) return s + '.exe';
  if (r < 0.5) return 'its_' + s;
  if (r < 0.55) return 'the' + s;
  if (r < 0.6) return s.toUpperCase();
  if (r < 0.66) return s + pick(SYMBOLS);
  if (r < 0.7) return pick(SYMBOLS) + s + pick(SYMBOLS);
  if (r < 0.74) return s.replace(/o/g, '0').replace(/e/g, '3').replace(/a/g, '4');
  if (r < 0.78) return s + '_' + pick(EN_WORDS);
  return s;
}

const GENERATORS = [
  // [وزن, دالة(gender, nationality)]
  [10, (g) => decorate(pick(g === 'f' ? EN_FIRST_F : EN_FIRST_M))],
  [10, () => decorate(pick(EN_WORDS))],
  [6, () => decorate(pick(EN_WORDS) + pick(['_', '', '.']) + pick(EN_WORDS))],
  [9, (g) => pick(g === 'f' ? AR_FIRST_F : AR_FIRST_M) + pick(['', '', ' ' + rint(1, 999), ' ' + pick(SYMBOLS), ' ' + pick(EMOJI), '_' + rint(10, 99)])],
  [5, (g, n) => pick(g === 'f' ? AR_FIRST_F : AR_FIRST_M) + ' ' + pick(SURNAMES[n] || ['حسن','علي','محمود','عبدالله'])],
  [6, (g, n) => pick(AR_NICK_REGION[n] && Math.random() < 0.5 ? AR_NICK_REGION[n].filter((x) => g === 'f' ? !/^(ولد|ابن|أبو|ابو|شب|نشمي$)/.test(x) : !/^(بنت|نشمية|زهقانة)/.test(x)) : AR_NICK)],
  [4, () => pick(AR_ABBR) + pick(['', '', 'ـ', '.', '..'])],
  [5, () => pick(SYMBOLS) + (chance(0.3) ? pick(SYMBOLS) : '')],
  [5, () => pick(EMOJI) + (chance(0.25) ? pick(EMOJI) : '')],
  [8, () => pick(WEIRD)],
  [7, () => pick(FUNNY)],
  [5, () => pick(PLAIN) + '_' + rint(1000, 99999)],
  [6, (g, n) => (['SA','KW','IQ','QA','AE','BH','OM'].includes(n) || chance(0.4) ? decorate(pick(ARABIZI)) : decorate(pick(EN_WORDS)))],
  [3, () => String(rint(1, 9999))],
  [3, (g) => (g === 'f' ? pick(['bint ', 'miss_', 'lady.', 'princess_']) : pick(['abu_', 'mr.', 'sir_', 'king_'])) + pick(g === 'f' ? EN_FIRST_F : EN_FIRST_M)],
  [3, (g) => pick(g === 'f' ? AR_FIRST_F : AR_FIRST_M).slice(0, 2) + pick(['ـ', '..', ' ' + pick(EMOJI)])],
];
const TOTAL = GENERATORS.reduce((s, [w]) => s + w, 0);

const FOREIGN = new Set(['US', 'GB', 'DE', 'BR', 'PH']);
function generateUsername(gender, nationality, taken = new Set()) {
  for (let i = 0; i < 50; i++) {
    let r = Math.random() * TOTAL, fn;
    for (const [w, f] of GENERATORS) { if ((r -= w) <= 0) { fn = f; break; } }
    let name = String((fn || GENERATORS[0][1])(gender, nationality)).trim();
    if (!name) continue;
    if (FOREIGN.has(nationality) && (/[\u0600-\u06FF]/.test(name) || /^(abu_|3|7|5|m7|sa3|sh7|j0|no0)/i.test(name) || /\d/.test(name.replace(/_\d+$/, '')) && /[375]/.test(name))) continue;
    if (taken.has(name.toLowerCase())) { if (i > 30) name += '_' + rint(2, 999); else continue; }
    taken.add(name.toLowerCase());
    return name;
  }
  return 'user_' + rint(10000, 99999);
}

module.exports = { generateUsername, AR_FIRST_M, AR_FIRST_F, EN_FIRST_M, EN_FIRST_F };
