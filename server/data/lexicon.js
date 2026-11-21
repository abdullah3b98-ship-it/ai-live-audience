// قاموس مرجعي للمصطلحات العامية — يُستخدم كـ"مصدر موثوق" محلي عند محاولة فهم كلمة.
// family: المجموعة اللهجية التي تعرفها تلقائياً. cat: insult | praise | joke | neutral
const L = (word, family, meaning, cat = 'neutral', variants = []) => ({ word, family, meaning, cat, variants });
const LEXICON = [
  // خليجي/سعودي
  L('طقطقة', 'gulf', 'السخرية والمزح الثقيل على شخص', 'joke', ['طقطق', 'يطقطق', 'نطقطق']),
  L('هياط', 'gulf', 'المبالغة والتفاخر الكاذب', 'insult', ['يهايط', 'مهايطي']),
  L('دلخ', 'gulf', 'غبي أو أهبل', 'insult', ['دلوخ']),
  L('خبل', 'gulf', 'مجنون أو أحمق (مزح خفيف)', 'insult', ['خبله', 'مخبول']),
  L('كشخة', 'gulf', 'أنيق ومرتب', 'praise', ['كشخه', 'متكشخ']),
  L('فله', 'gulf', 'وناسة ومتعة', 'praise', ['فلة']),
  L('طفشان', 'gulf', 'زهقان ومللان', 'neutral', ['طفش', 'طفشت']),
  L('بزر', 'gulf', 'طفل صغير، وتقال للي يتصرف بطفولية', 'insult', ['بزران', 'مبزرة']),
  L('يونس', 'gulf', 'ممتع ويسلي', 'praise', ['وناسة', 'ونيس']),
  L('مرجوج', 'gulf', 'مرتبك ومتلخبط', 'neutral', []),
  L('ذيب', 'gulf', 'شجاع وقوي ومحترف', 'praise', ['ذيييب']),
  L('كفو', 'gulf', 'أحسنت، مدح', 'praise', ['كفوو', 'كفووو']),
  L('دحين', 'gulf', 'الآن (حجازي)', 'neutral', ['دحينه']),
  L('سامج', 'gulf', 'ثقيل دم وغير مضحك', 'insult', ['سماجة']),
  L('وايد', 'gulf', 'كثير', 'neutral', []),
  L('ماصخ', 'gulf', 'بايخ بلا طعم', 'insult', ['ماصخة']),
  L('شسالفة', 'gulf', 'ما القصة؟', 'neutral', []),
  L('طنازة', 'gulf', 'سخرية', 'joke', ['يتطنز']),
  // مصري
  L('جامد', 'egyptian', 'رائع وقوي', 'praise', ['جامدة']),
  L('عبيط', 'egyptian', 'غبي وساذج', 'insult', ['عبط']),
  L('اشطة', 'egyptian', 'تمام، موافق', 'neutral', ['اشطا']),
  L('بيئة', 'egyptian', 'عديم الذوق وسلوكه شعبي سيئ', 'insult', []),
  L('نفسنة', 'egyptian', 'غيرة وحسد', 'neutral', ['متنفسن']),
  L('هبل', 'egyptian', 'سخافة أو تصرف أحمق', 'insult', ['اهبل']),
  L('روش', 'egyptian', 'ستايل حلو ومواكب', 'praise', ['روشنة']),
  L('فكك', 'egyptian', 'اتركه ولا تهتم', 'neutral', ['فكك منه']),
  L('يسطا', 'egyptian', 'يا صاحبي (نداء)', 'neutral', ['يا اسطى']),
  L('حلنجي', 'egyptian', 'محتال وشاطر في التحايل', 'insult', []),
  L('تحفة', 'egyptian', 'رائع جداً', 'praise', []),
  L('خلبوص', 'egyptian', 'شقي ومحتال بخفة دم', 'joke', []),
  // شامي
  L('مهضوم', 'levant', 'لطيف وخفيف دم', 'praise', ['مهضومة']),
  L('عنجد', 'levant', 'بجد، حقاً', 'neutral', ['عن جد']),
  L('هلق', 'levant', 'الآن', 'neutral', ['هلأ']),
  L('زنخ', 'levant', 'ثقيل وبايخ ومزعج', 'insult', ['زنخة']),
  L('تقبرني', 'levant', 'تعبير محبة شديدة', 'praise', ['يقبرني', 'تئبرني']),
  L('نق', 'levant', 'التذمر والشكوى المستمرة', 'neutral', ['نقاق']),
  L('حبّوب', 'levant', 'لطيف ومحبوب', 'praise', ['حبوب']),
  L('سحيج', 'levant', 'متملق يطبل لأي أحد', 'insult', ['تسحيج']),
  L('نشمي', 'levant', 'شهم وشجاع (أردني)', 'praise', ['نشامى']),
  L('كزدورة', 'levant', 'نزهة ومشوار', 'neutral', []),
  // عراقي
  L('خوش', 'iraqi', 'جيد، حلو', 'praise', []),
  L('هواية', 'iraqi', 'كثير', 'neutral', []),
  L('سرسري', 'iraqi', 'صايع وقليل أدب', 'insult', []),
  L('خطية', 'iraqi', 'مسكين يستحق الشفقة', 'neutral', ['خطيه']),
  L('لوتي', 'iraqi', 'محتال ذكي', 'insult', []),
  L('زمال', 'iraqi', 'حمار، غبي', 'insult', []),
  L('اغاتي', 'iraqi', 'يا سيدي (احترام)', 'praise', []),
  L('كلش', 'iraqi', 'جداً', 'neutral', []),
  L('طركاعة', 'iraqi', 'مصيبة وورطة', 'neutral', []),
  L('شكو ماكو', 'iraqi', 'ما الأخبار؟', 'neutral', ['شكو']),
  // إنجليزي إنترنت
  L('cringe', 'english', 'شيء محرج ومخجل', 'insult', []),
  L('based', 'english', 'رأي جريء ومحترم', 'praise', []),
  L('mid', 'english', 'عادي ومتوسط', 'insult', []),
  L('sus', 'english', 'مشبوه', 'neutral', []),
  L('goat', 'english', 'الأفضل على الإطلاق', 'praise', []),
  L('skill issue', 'english', 'المشكلة في مهارتك', 'joke', []),
  L('copium', 'english', 'إنكار الواقع لتهوين الخسارة', 'joke', []),
];

const norm = (s) => String(s || '').toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة\b/g, 'ه').replace(/ى\b/g, 'ي').replace(/(.)\1{2,}/g, '$1$1').trim();

function findInLexicon(text) {
  const t = ' ' + norm(text).replace(/[^\p{L}\p{N}\s]/gu, ' ') + ' ';
  const found = [];
  for (const e of LEXICON) {
    for (const v of [e.word, ...e.variants]) {
      if (t.includes(' ' + norm(v) + ' ')) { found.push({ ...e, matched: v }); break; }
    }
  }
  return found;
}

// أسماء أشياء COCO-SSD بالعربي
const OBJECT_AR = {
  person: 'شخص', 'cell phone': 'جوال', remote: 'ريموت', cup: 'كوب', bottle: 'قارورة', laptop: 'لابتوب', keyboard: 'كيبورد',
  mouse: 'ماوس', book: 'كتاب', scissors: 'مقص', 'teddy bear': 'دبدوب', cat: 'قطة', dog: 'كلب', chair: 'كرسي', tv: 'شاشة',
  clock: 'ساعة', backpack: 'شنطة', banana: 'موزة', apple: 'تفاحة', orange: 'برتقالة', donut: 'دونات', pizza: 'بيتزا',
  'wine glass': 'كاس', fork: 'شوكة', knife: 'سكين', spoon: 'ملعقة', bowl: 'صحن', toothbrush: 'فرشاة أسنان', handbag: 'شنطة يد',
  umbrella: 'مظلة', tie: 'كرفتة', 'sports ball': 'كورة', vase: 'مزهرية', 'potted plant': 'نبتة', bed: 'سرير', couch: 'كنبة',
  bird: 'طير', sandwich: 'ساندويتش', cake: 'كيكة', 'hair drier': 'سشوار', car: 'سيارة',
};
// أشياء غامضة غالباً (قد تكون شيئاً آخر) — تدفع الشخصيات للسؤال
const AMBIGUOUS = new Set(['remote', 'cell phone', 'mouse', 'scissors', 'toothbrush', 'hair drier', 'handbag', 'book', 'bottle', 'cup']);

module.exports = { LEXICON, findInLexicon, norm, OBJECT_AR, AMBIGUOUS };
