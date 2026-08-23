import React, { useState, useMemo } from "react";
import { Container, Paper, Box, Typography, TextField, Chip, InputAdornment, Button, Divider } from "@mui/material";
import { Search as SearchIcon, Info, AlertTriangle } from "lucide-react";
import { drugCategories, availableLabels } from "../data/drugCategories";
import { ministryMedicines } from "../data/ministryMedicines";

// خريطة سريعة: اسم التصنيف -> لونه وأيقونته (بالضبط نفس availableLabels عشان التوحيد)
const labelMap = Object.fromEntries(availableLabels.map((l) => [l.name, l]));

// كل تصنيف يرجع لأي ملف سياسة رسمي (نفس التقسيم الموجود فعليًا بالمستشفى)
const POLICY_SOURCE = {
  "Look Alike": "APP 20(02) — Look/Sound-Alike Medications (LASA)",
  "Sound Alike": "APP 20(02) — Look/Sound-Alike Medications (LASA)",
  "Hazardous": "MM-IPP-01(01) — Hazardous Medications & Pharmaceutical Chemicals",
  "High Alert": "APP 18(02) — High-Alert Medications (HAM)",
};

// الأقسام الثلاثة اللي تُعرض بوضع "استعراض الملفات" — بالضبط بنفس تقسيم السياسات الأصلية
const FILE_SECTIONS = [
  { key: "LASA", title: "APP 20(02) — Look/Sound-Alike Medications", cats: ["Look Alike", "Sound Alike"] },
  { key: "HAZ", title: "MM-IPP-01(01) — Hazardous Medications & Pharmaceutical Chemicals", cats: ["Hazardous"] },
  { key: "HAM", title: "APP 18(02) — High-Alert Medications", cats: ["High Alert"] },
];

// قواعد عامة لأدوية لها "فئة كاملة" مذكورة بالسياسة كوصف عام بدل اسم منتج محدد
// (مثال: البوليسي يكتب "All type of insulin" بدل ما يسرد كل ماركة). تُطبَّق على
// الاسم العلمي المعتمد وزاريًا (ministryMedicines.description) عشان تشتغل صح
// مع أي صنف فعلي بالمخزون تلقائيًا، بدون ما نسرد كل نوع يدويًا.
const GENERIC_CLASS_RULES = [
  { pattern: /insulin/i, category: "High Alert", note: 'يندرج ضمن الفئة العامة "All type of insulin (subcutaneous, IV)" — APP 18(02)' },
  { pattern: /contrast/i, category: "High Alert", note: 'يندرج ضمن "Radio Contrast Agent (IV)" — APP 18(02)' },
  { pattern: /\btpn\b|total parenteral nutrition|parenteral nutrition/i, category: "High Alert", note: 'يندرج ضمن "Total Parenteral Nutrition (TPN) Preparation" — APP 18(02)' },
];

function applyGenericRules(name, existingCats) {
  const extra = [];
  for (const rule of GENERIC_CLASS_RULES) {
    if (rule.pattern.test(name) && !existingCats.includes(rule.category)) {
      extra.push(rule);
    }
  }
  return extra;
}

// نطابق كل صنف رسمي (ministryMedicines) مع الكلمات المفتاحية (drugCategories) + القواعد
// العامة، عشان نطلع تصنيف نهائي شامل لكل NUPCO Code موجود فعليًا بالمخزون.
function buildMinistryClassification() {
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[il1]/g, "i")
      .replace(/[o0]/g, "o")
      .replace(/[-–—/\\%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return ministryMedicines.map((med) => {
    const nDesc = normalize(med.description);
    const fromKeywords = drugCategories.filter((d) => nDesc.includes(normalize(d.keyword)));
    const categories = Array.from(new Set(fromKeywords.flatMap((d) => d.categories)));
    const genericHits = applyGenericRules(med.description, categories);
    return {
      nupcoCode: med.nupcoCode,
      description: med.description,
      categories,
      genericRuleHits: genericHits,
    };
  });
}

export default function ClassificationSearch() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("search"); // "search" | "browse" | "inventory"

  const ministryClassified = useMemo(() => buildMinistryClassification(), []);

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[il1]/g, "i")
      .replace(/[o0]/g, "o")
      .replace(/[-–—/\\%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isAlphaToken = (rawWord) => {
    const letters = (rawWord.match(/[a-zA-Z]/g) || []).length;
    const digits = (rawWord.match(/[0-9]/g) || []).length;
    return letters > digits;
  };

  const tokensFromQuery = (qRaw) => {
    const rawWords = qRaw.split(/\s+/).filter(Boolean);
    const requiredTokens = rawWords.filter(isAlphaToken).map(normalize).filter(Boolean);
    return requiredTokens.length ? requiredTokens : rawWords.map(normalize).filter(Boolean);
  };

  const searchResults = useMemo(() => {
    const qRaw = query.trim();
    if (!qRaw) return [];
    const tokens = tokensFromQuery(qRaw);

    const matched = drugCategories
      .filter((d) => {
        const n = normalize(d.keyword);
        return tokens.every((t) => n.includes(t));
      })
      .map((d) => ({ ...d, genericRuleHits: applyGenericRules(d.keyword, d.categories) }));

    if (matched.length === 0) {
      const ruleHits = applyGenericRules(qRaw, []);
      if (ruleHits.length > 0) {
        return [{ keyword: qRaw, categories: [], genericRuleHits: ruleHits, isRuleOnly: true }];
      }
    }
    return matched.sort((a, b) => b.categories.length - a.categories.length || a.keyword.localeCompare(b.keyword));
  }, [query]);

  const inventoryResults = useMemo(() => {
    const qRaw = query.trim();
    if (!qRaw) return [];
    const tokens = tokensFromQuery(qRaw);
    return ministryClassified
      .filter((m) => {
        const n = normalize(m.description);
        return tokens.every((t) => n.includes(t));
      })
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [query, ministryClassified]);

  const browseData = useMemo(() => {
    return FILE_SECTIONS.map((section) => ({
      ...section,
      items: drugCategories
        .filter((d) => d.categories.some((c) => section.cats.includes(c)))
        .sort((a, b) => a.keyword.localeCompare(b.keyword)),
    }));
  }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2.5 }}>
        <Box
          sx={{
            p: 2,
            bgcolor: "#9333ea",
            color: "#ffffff",
            borderRadius: 3.5,
            display: "flex",
            boxShadow: "0 10px 15px -3px rgba(147, 51, 234, 0.25)",
          }}
        >
          <SearchIcon size={28} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Quick Classification Search
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500, mt: 0.5 }}>
            Reads live from the same 3 official policy files used for automatic classification.
          </Typography>
        </Box>
      </Box>

      {/* Disclaimer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: "#faf5ff",
          border: "1px solid #e9d5ff",
          borderRadius: 2,
          mb: 3,
        }}
      >
        <Info size={16} color="#9333ea" style={{ flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: "#7e22ce", fontWeight: 600 }}>
          This tool reads live from the same database used for automatic classification in the system —
          for quick reference only, always confirm against the official policy for critical decisions.
        </Typography>
      </Box>

      {/* Mode Switch */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Button
          onClick={() => setViewMode("search")}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: 13, borderRadius: 5, px: 2.2, flex: 1,
            border: "1.5px solid #9333ea",
            color: viewMode === "search" ? "#ffffff" : "#9333ea",
            bgcolor: viewMode === "search" ? "#9333ea" : "transparent",
            "&:hover": { bgcolor: "#9333ea", color: "#ffffff" },
          }}
        >
          🔍 Search Keywords
        </Button>
        <Button
          onClick={() => setViewMode("inventory")}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: 13, borderRadius: 5, px: 2.2, flex: 1,
            border: "1.5px solid #9333ea",
            color: viewMode === "inventory" ? "#ffffff" : "#9333ea",
            bgcolor: viewMode === "inventory" ? "#9333ea" : "transparent",
            "&:hover": { bgcolor: "#9333ea", color: "#ffffff" },
          }}
        >
          💊 Search Ministry Items
        </Button>
        <Button
          onClick={() => setViewMode("browse")}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: 13, borderRadius: 5, px: 2.2, flex: 1,
            border: "1.5px solid #9333ea",
            color: viewMode === "browse" ? "#ffffff" : "#9333ea",
            bgcolor: viewMode === "browse" ? "#9333ea" : "transparent",
            "&:hover": { bgcolor: "#9333ea", color: "#ffffff" },
          }}
        >
          📄 Browse the 3 Policy Files
        </Button>
      </Box>

      {(viewMode === "search" || viewMode === "inventory") && (
        <TextField
          fullWidth
          autoFocus
          placeholder={
            viewMode === "inventory"
              ? "Type a ministry-approved medication name or NUPCO code... e.g. Insulin Glargine"
              : "Type a medication name... e.g. Warfarin"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "#ffffff", fontSize: 17 },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon size={18} color="#64748b" />
              </InputAdornment>
            ),
          }}
        />
      )}

      {viewMode === "search" && (
        <>
          <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 2 }}>
            {query ? `${searchResults.length} result(s)` : ""}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3, justifyContent: "center" }}>
            {availableLabels.map((l) => (
              <Chip key={l.name} label={`${l.icon} ${l.name}`} size="small"
                sx={{ bgcolor: `${l.color}22`, color: l.color, fontWeight: 700, fontSize: 11 }} />
            ))}
          </Box>

          {!query && (
            <Typography variant="body2" sx={{ textAlign: "center", color: "#94a3b8", py: 6 }}>
              Start typing a medication name above ⬆️
            </Typography>
          )}

          {query && searchResults.length === 0 && (
            <Box sx={{ textAlign: "center", color: "#94a3b8", py: 6 }}>
              <Typography sx={{ fontSize: 34, mb: 1 }}>🤷‍♀️</Typography>
              <Typography variant="body2">
                This medication is not found in any of the classification lists.
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {searchResults.map((item, idx) => (
              <Paper key={item.keyword + idx} elevation={0}
                sx={{ p: 2.2, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, direction: "ltr", textAlign: "left" }}>
                    {item.keyword}
                  </Typography>
                  {!item.isRuleOnly && (
                    <Chip
                      label={item.categories.length > 1 ? `${item.categories.length} classifications` : "1 classification"}
                      size="small"
                      sx={{
                        bgcolor: item.categories.length > 1 ? "#fff1e0" : "#e6f2ef",
                        color: item.categories.length > 1 ? "#b25b00" : "#0f5c52",
                        fontWeight: 700, fontSize: 10.5,
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mb: item.genericRuleHits.length ? 1 : 0 }}>
                  {item.categories.map((cat) => {
                    const meta = labelMap[cat] || { color: "#666", icon: "" };
                    return (
                      <Chip key={cat} label={`${meta.icon} ${cat}`} size="small"
                        sx={{ bgcolor: `${meta.color}22`, color: meta.color, fontWeight: 600, fontSize: 11.5 }} />
                    );
                  })}
                </Box>
                {item.genericRuleHits.map((rule, i) => (
                  <Box key={i} sx={{
                    mt: 1, p: 1.2, borderRadius: 2, bgcolor: "#fff8e1", border: "1px dashed #f0b429",
                    display: "flex", alignItems: "flex-start", gap: 1,
                  }}>
                    <AlertTriangle size={14} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>
                      {rule.note}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            ))}
          </Box>
        </>
      )}

      {viewMode === "inventory" && (
        <>
          <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 2 }}>
            {query ? `${inventoryResults.length} result(s) from ministry-approved list (${ministryMedicines.length} total items)` : ""}
          </Typography>

          {!query && (
            <Typography variant="body2" sx={{ textAlign: "center", color: "#94a3b8", py: 6 }}>
              Search by scientific/generic name or NUPCO code ⬆️
              <br />
              <span style={{ fontSize: 12 }}>Automatically classified using both keyword matching and general-class rules (e.g. any item containing "Insulin")</span>
            </Typography>
          )}

          {query && inventoryResults.length === 0 && (
            <Box sx={{ textAlign: "center", color: "#94a3b8", py: 6 }}>
              <Typography sx={{ fontSize: 34, mb: 1 }}>🤷‍♀️</Typography>
              <Typography variant="body2">No matching ministry-approved item found.</Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {inventoryResults.map((item) => (
              <Paper key={item.nupcoCode} elevation={0}
                sx={{ p: 2.2, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, direction: "ltr", textAlign: "left" }}>
                      {item.description}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", direction: "ltr", display: "block" }}>
                      NUPCO: {item.nupcoCode}
                    </Typography>
                  </Box>
                </Box>
                {item.categories.length > 0 && (
                  <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mb: item.genericRuleHits.length ? 1 : 0 }}>
                    {item.categories.map((cat) => {
                      const meta = labelMap[cat] || { color: "#666", icon: "" };
                      return (
                        <Chip key={cat} label={`${meta.icon} ${cat}`} size="small"
                          sx={{ bgcolor: `${meta.color}22`, color: meta.color, fontWeight: 600, fontSize: 11.5 }} />
                      );
                    })}
                  </Box>
                )}
                {item.genericRuleHits.map((rule, i) => (
                  <Box key={i} sx={{
                    mt: 1, p: 1.2, borderRadius: 2, bgcolor: "#fff8e1", border: "1px dashed #f0b429",
                    display: "flex", alignItems: "flex-start", gap: 1,
                  }}>
                    <AlertTriangle size={14} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>
                      {rule.note}
                    </Typography>
                  </Box>
                ))}
                {item.categories.length === 0 && item.genericRuleHits.length === 0 && (
                  <Typography variant="caption" sx={{ color: "#94a3b8" }}>No classification found</Typography>
                )}
              </Paper>
            ))}
          </Box>
        </>
      )}

      {viewMode === "browse" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {browseData.map((section) => (
            <Box key={section.key}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", mb: 0.3 }}>
                {section.title}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1.5 }}>
                {section.items.length} medications in this file
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {section.items.map((item, idx) => (
                  <Paper key={item.keyword} elevation={0}
                    sx={{
                      p: 1.5, borderRadius: 2.5, bgcolor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 1,
                    }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, direction: "ltr", textAlign: "left" }}>
                      {item.keyword}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {item.categories.map((cat) => {
                        const meta = labelMap[cat] || { color: "#666", icon: "" };
                        return (
                          <Chip key={cat} label={meta.icon} size="small"
                            sx={{ bgcolor: `${meta.color}22`, color: meta.color, minWidth: 26, fontSize: 12 }} />
                        );
                      })}
                    </Box>
                  </Paper>
                ))}
              </Box>
              <Divider sx={{ mt: 3, borderColor: "#e2e8f0" }} />
            </Box>
          ))}
        </Box>
      )}
    </Container>
  );
}

