// فلتر السلامة: لا إهانات تمييزية، لا تهديدات، لا محتوى جنسي
const BLOCK = [
  /عبد\s*اسود|زنجي|عنصري|يهودي\s*(قذر|حقير)|كافر|رافضي|ناصبي|مجوسي|صفوي|بدون\s*جنسية|nigg|fag|retard|tranny|spic|kike/i,
  /اقتلك|بذبحك|راح\s*اقتل|اذبحك|بقتلك|انتحر|kill\s*(you|ur|yourself)|kys|i\s*will\s*hurt/i,
  /سكس|نيك|زب|كس\s|شرموط|منيوك|قحب|عاهر|متناك|fuck|pussy|dick|cock|porn|sex|horny|nude/i,
];
const isSafe = (t) => !BLOCK.some((re) => re.test(String(t || '')));
module.exports = { isSafe };
