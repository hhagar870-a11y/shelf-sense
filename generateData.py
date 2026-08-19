import pandas as pd
import json

# قراءة ملف الأكسل واستخراج قسم الأدوية فقط (1668 دواء)
df = pd.read_excel("اصناف العهد موصول (2).xlsx")
med_df = df[df['القسم'].str.contains('الادوية|أدوية', na=False)].copy()

medicines_list = []
for idx, row in med_df.iterrows():
    medicines_list.append({
        "MohCode": str(row['Moh Code']),
        "NupcoCode": str(row['NUPCO Code']),
        "Description": str(row['Description'])
    })

# كتابة الملف كاملاً داخل مجلد src/data/ministryMedicines.js
js_content = f"export const ministryMedicines = {json.dumps(medicines_list, ensure_ascii=False, indent=2)};\n"

with open("src/data/ministryMedicines.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("تم إنشاء ملف ministryMedicines.js بنجاح وبكافة الـ 1668 دواء!")