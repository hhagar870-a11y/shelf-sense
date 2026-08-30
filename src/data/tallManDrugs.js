// src/data/tallManDrugs.js
//
// قائمة الأدوية المتشابهة صوتيًا (Sound-Alike) وصيغة Tall Man Lettering
// الرسمية المعتمدة بسياسة المستشفى (APP 20(02): Handling Look-Alike
// Sound-Alike Medications، وAPP 18(02): High-Alert Medications). كل
// مجموعة أسماء يسهل الخلط بينها صوتيًا، بنفس الأحرف الكبيرة المعتمدة
export const TALL_MAN_GROUPS = [
  ["AcetaZOLAMIDE", "AcetaMINOPHEN"],
  ["Acyclovir", "VALAciclovir"],
  ["Aggrastat", "argatroban"],
  ["ALPRAZolam", "LORazepam", "clonazePAM"],
  ["AMANtadine", "amiodarone", "LORAtadine"],
  ["aMILoride", "amLODIPine"],
  ["AMINOPHyllin", "AMITRIPTylline"],
  ["amphotericin B", "amphotericin B liposomal"],
  ["ARIPiprazole", "OMEprazole", "ESOMEprazole", "PANTOprazole", "proton pump inhibitors"],
  ["atomoxetine", "atorvastatin"],
  ["azithROMYCin", "azathIOPRine"],
  ["CalcitONIN", "CalcitRIOL"],
  ["captopril", "carvedilol", "caLCITRIOL"],
  ["carBAMazepine", "OXcarbazepine"],
  ["CARBOplatin", "CISplatin"],
  ["CARVedilol", "PROPRANolol", "BISOPRolol", "LABEtalol"],
  ["ceFAZolin", "cefTAZidime", "cefTRIAXone"],
  ["cefuroxime", "sulfaSALAzine"],
  ["cetirizine", "sertraline"],
  ["citalopram", "escitalopram"],
  ["CLARIthromycin", "ERYTHRomycin"],
  ["CLINDAmycin", "GENTAmycin"],
  ["clonazePAM", "cloNIDine"],
  ["cycloPHOSphamide", "cycloSERINE"],
  ["cycloSPORINE", "cyclophosphamide"],
  ["DAPTOmycin", "DACTINomycin"],
  ["desmopressin", "vasopressin"],
  ["dexAMETHasone", "dexmedeTOMIDine"],
  ["diazePAM", "dilTIAZem"],
  ["DOBUTamine", "DOPamine"],
  ["DOXOrubicin", "DAUNOrubicin"],
  ["DULoxetine", "PARoxetine", "FLUoxetine"],
  ["ePHEDrine", "EPINEPHrine"],
  ["fentaNYL", "SUFentanil"],
  ["flumazenil", "influenza virus vaccine"],
  ["glipiZIDE", "glyBURIDE"],
  ["HumaLOG", "HumuLIN"],
  ["hydrALAZINE", "hydroCHLOROthiazide", "HYDROmorphone"],
  ["hydroCHLOROthiazide", "hydroxychloroquine"],
  ["HYDROmorphone", "morphine"],
  ["hydroxyurea", "hydroxychloroquine"],
  ["inFLIXimab", "riTUXimab"],
  ["influenza virus vaccine", "tuberculin purified protein derivative (PPD)"],
  ["ISOtretinoin", "tretinoin"],
  ["Keppra", "Kaletra"],
  ["ketamine", "ketorolac"],
  ["labetalol", "LaMICtal", "lamoTRIgine"],
  ["lamoTRIgine", "levETIRAcetam"],
  ["Lanoxin", "levothyroxine", "naloxone"],
  ["levETIRAcetam", "levoFLOXacin", "levOCARNitine"],
  ["levothyroxine", "lamoTRIgine"],
  ["Lipitor", "ZyrTEC"],
  ["LISINopril", "PERINdopril"],
  ["LOPERAmide", "FUROSEmide"],
  ["Lopressor", "Lyrica"],
  ["metFORMIN", "metroNIDAZOLE"],
  ["methadone", "methylphenidate", "metOLazone"],
  ["methotrexate", "metOLazone"],
  ["methylPREDNISolone", "medroxyPROGESTERone", "methylTESTOSTERone", "HYDROXYprogesterone"],
  ["metoPROLOL", "metoCLOPRAMIDE"],
  ["metoPROLOL succinate", "metoPROLOL tartrate"],
  ["metroNIDAZOLE", "MeBENdazole"],
  ["niCARdipine", "niMODipine", "NIFEdipine"],
  ["nitroGLYcerin", "nitroPRUSside"],
  ["nystatin", "HMG-CoA reductase inhibitors (\"statins\")"],
  ["OLANZapine", "QUEtiapine"],
  ["omeprazole", "fomepizole"],
  ["oxyCODONE", "HYDROcodone"],
  ["penicillAMINE", "penicillin"],
  ["PHYSostigmine", "pyRIDostigmine", "pyridoxine"],
  ["prednisoLONE", "predniSONE"],
  ["Prograf", "Proscar"],
  ["rifAMPin", "rifAXIMin"],
  ["sitaGLIPtin", "SUMAtriptan"],
  ["Spiriva", "Apidra"],
  ["tacrolimus", "tamsulosin"],
  ["TEGretol", "TRENtal"],
  ["Tegretol", "Tegretol XR"],
  ["tetanus diptheria toxoid (Td)", "tuberculin purified protein derivative (PPD)"],
  ["Tradjenta", "Toujeo", "Trulicity"],
  ["valACYclovir", "valGANciclovir"],
  ["vinCRIStine", "vinBLAStine"],
];

// يبني خارطة بحث سريعة: اسم الدواء (بحروف صغيرة) → صيغته الرسمية بـ Tall
// Man + بقية الأدوية اللي يشتبه فيها معه صوتيًا.
//
// بعض الأدوية تتكرر بأكثر من مجموعة بالأعلى (نفس الدواء ممكن يشتبه فيه مع
// أكثر من دواء مختلف بسياقات مختلفة — مثل omeprazole اللي موجود بمجموعة
// ARIPiprazole/OMEprazole/... وكمان بمجموعة omeprazole/fomepizole). لو
// استخدمنا map.set() عادي، آخر مجموعة يوصلها بالترتيب تكتب فوق الأولى
// بالكامل — يعني تضيع باقي الأدوية المشتبهة، وممكن كمان توحّد الصيغة
// الصحيحة بـ Tall Man casing (زي "OMEprazole") بنسخة بأحرف صغيرة كلها لو
// المجموعة الثانية ماكانت مكتوبة بنفس الصيغة الرسمية. فبدل الاستبدال،
// ندمج: نجمع كل الأدوية المشتبهة من كل المجموعات اللي فيها نفس الاسم،
// ونفضّل الصيغة اللي فعلاً فيها أحرف كبيرة وصغيرة مختلطة (Tall Man) على أي
// نسخة بأحرف صغيرة كلها أو كبيرة كلها.
const hasTallManCasing = (s) => /[a-z]/.test(s) && /[A-Z]/.test(s);

function buildLookup() {
  const map = new Map();
  TALL_MAN_GROUPS.forEach((group) => {
    group.forEach((tallManName) => {
      const key = tallManName.toLowerCase().trim();
      const others = group.filter((n) => n !== tallManName);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { tallManName, confusedWith: [...others] });
        return;
      }

      // لو الاسم الحالي مو مكتوب بصيغة Tall Man وعندنا صيغة صحيحة محفوظة
      // فعلاً، نحتفظ بالصحيحة. غير كذا (الجديد هو الصيغة الصحيحة، أو
      // الاثنين بدون صيغة واضحة) ناخذ الجديد.
      const keepExistingCasing = hasTallManCasing(existing.tallManName) && !hasTallManCasing(tallManName);
      const mergedTallManName = keepExistingCasing ? existing.tallManName : tallManName;
      const mergedConfusedWith = Array.from(new Set([...existing.confusedWith, ...others]))
        .filter((n) => n.toLowerCase().trim() !== key);

      map.set(key, { tallManName: mergedTallManName, confusedWith: mergedConfusedWith });
    });
  });
  return map;
}

const LOOKUP = buildLookup();

// يبحث عن اسم دواء مكتوب بنص عادي (ممكن يكون فيه تركيز/شكل صيدلاني بعد
// الاسم، زي "Warfarin 2 mg Tablet")، ويرجع صيغة Tall Man المعتمدة + الأدوية
// المشابهة له صوتيًا لو موجود بالقائمة، أو null لو مو موجود بالقائمة
export function findTallManSuggestion(rawName) {
  const key = String(rawName || "").trim().toLowerCase();
  if (!key || key.length < 3) return null;

  const exact = LOOKUP.get(key);
  if (exact) return exact;

  // مطابقة الاسم لو كان بداية النص (زي "Warfarin" جوه "Warfarin 2 mg Tablet")
  for (const [drugKey, entry] of LOOKUP.entries()) {
    if (key.startsWith(`${drugKey} `)) return entry;
  }
  return null;
}