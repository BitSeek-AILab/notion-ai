// 黄毛理论 v2 · font loading (all OFL; subsets live in assets/fonts, see tools/subset_fonts.py)
export const FONT_FILES = [
  ['RHR Heavy', 'RHR-Heavy.ttf'], ['RHR Bold', 'RHR-Bold.ttf'], ['Smiley Sans', 'SmileySans.ttf'],
];
export async function loadFonts(base = 'assets/fonts/') {
  await Promise.all(FONT_FILES.map(async ([fam, file]) => {
    const f = new FontFace(fam, `url(${base}${file})`);
    await f.load(); document.fonts.add(f);
  }));
  await document.fonts.ready;
}
