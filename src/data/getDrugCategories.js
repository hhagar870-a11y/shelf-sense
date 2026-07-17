import { drugCategories } from "./drugCategories.js";
export function getDrugCategories(drugName) {
  if (!drugName) return [];

  const name = drugName.toLowerCase();

 const found = drugCategories
  .filter((drug) => {
    const keyword = drug.keyword.toLowerCase();

    return (
      name.includes(keyword) ||
      keyword.includes(name)
    );
  })
  .flatMap((drug) => drug.categories);

  return found;
}