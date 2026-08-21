import { drugCategories } from "./drugCategories.js";

export function getDrugCategories(drugName) {
  if (!drugName) return [];

  const name = drugName.toLowerCase().trim();
  if (!name) return [];

  const found = drugCategories
    .filter((drug) => {
      const keyword = drug.keyword.toLowerCase().trim();
      if (!keyword) return false;

      // 1) تطابق تام بالاسم كامل — الأولوية والأدق
      if (name === keyword) return true;

      // 2) تطابق ككلمة كاملة داخل الاسم (يسمح مثلاً بـ "Augmentin 1g"
      // تطابق كيوورد "augmentin"، لكن يمنع أي substring عشوائي
    
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordBoundary = new RegExp(`\\b${escaped}\\b`);
      return wordBoundary.test(name);
    })
    .flatMap((drug) => drug.categories);

  return found;
}