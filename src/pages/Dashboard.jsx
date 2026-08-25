import {
  Box,
  Typography,
  TextField,
  Popover,
  Select,
  MenuItem,
  Link,
} from "@mui/material";

import React, { useMemo, useState, useEffect, useRef } from "react";

import Inventory2Icon from "@mui/icons-material/Inventory2";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningIcon from "@mui/icons-material/Warning";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import EventIcon from "@mui/icons-material/Event";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import NotificationBell from "../components/NotificationBell";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import banner1 from "../assets/banner1.png";
import banner2 from "../assets/banner2.png";

import "swiper/css";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { getLowStockThreshold, saveLowStockThreshold } from "../utils/lowStockSettings";

// كاش بمستوى الملف، نفس فكرة الكاش الموجودة بصفحة Inventory: يمنع ظهور
// شاشة تحميل فاضية كل مرة ندخل فيها الداش بورد، ونحدّث البيانات بالخلفية
let dashboardMedicinesCache = null;

// كمية الدواء أحيانًا تُخزّن كنص فيه وحدة القياس ملتصقة به (مثل "150 tab" أو
// "6 injections" — زي ما توصل من ملفات إكسل NUPCO)، فـ Number(...) عليها
// مباشرة يرجع NaN وأي مقارنة رقمية (Low Stock، الترتيب...) تفشل بصمت. هذي
// الدالة تسحب أول رقم موجود بالنص وتتجاهل الوحدة، بدل ما تعتمد على القيمة
// تكون رقم صافي دايمًا. تطبّع الأرقام العربية/الفارسية أول شي كمان (نفس
// normalizeDigits المستخدمة بصفحة الانفنتوري)، لأن استيراد الإكسل ما يمر
// عليها أصلًا
const parseQuantityNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const normalized = String(value).replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabicIdx = arabicIndic.indexOf(ch);
    if (arabicIdx !== -1) return String(arabicIdx);
    const persianIdx = persian.indexOf(ch);
    if (persianIdx !== -1) return String(persianIdx);
    return ch;
  });
  const match = normalized.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

// صفحات/تبويبات الموقع اللي البحث العام لازم يقدر يوصلها، مو بس الأدوية —
// كل عنصر فيه كلمات مفتاحية (إنجليزي وعربي) عشان المطابقة تشتغل بأي لغة يكتب
// فيها المستخدم، بس النتيجة نفسها تنعرض بالإنجليزي زي باقي واجهة الموقع
const SITE_SECTIONS = [
  { label: "Dashboard", path: "/dashboard", keywords: ["dashboard", "home", "الرئيسية", "لوحة"] },
  { label: "Inventory", path: "/inventory", keywords: ["inventory", "medicines", "stock", "المخزون", "الأدوية"] },
  { label: "Mawsool Orders", path: "/mawsool-orders", keywords: ["mawsool", "orders", "موصول", "طلبات"] },
  { label: "Support", path: "/support", keywords: ["support", "contact", "help", "الدعم", "مساعدة"] },
];

// تلوّن الجزء المطابق من النص بنفس مصطلح البحث (Highlight)، عشان يبان
// بالضبط وين صار التطابق داخل اسم الدواء أو اسم القسم
const highlightMatch = (text, term) => {
  if (!term || !text) return text;
  const lowerText = String(text).toLowerCase();
  const lowerTerm = term.toLowerCase();
  const idx = lowerText.indexOf(lowerTerm);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          backgroundColor: "#FEF08A",
          color: "inherit",
          borderRadius: "3px",
          padding: "0 1px",
        }}
      >
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
};


// =========================================================
// SEARCH BAR (كومبوننت مستقل بحاله)
// =========================================================
// السبب الرئيسي لبطء الكتابة بالبحث كان إن حالة البحث (search) كانت
// عايشة داخل Dashboard نفسه، فأي حرف يتكتب يعيد رسم الصفحة كاملة —
// الرسم البياني (recharts)، جدول Low Stock، جدول Latest Medicines...
// كل هذا يعيد الرسم من جديد كل ضغطة زر. بعزل البحث بكومبوننت مستقل
// (وبـ React.memo)، إعادة الرسم تصير محصورة بهذا الكومبوننت الصغير بس،
// وسرعة الكتابة ترجع طبيعية حتى مع مئات الأدوية.
const SearchBar = React.memo(function SearchBar({ medicines }) {

  const navigate = useNavigate();

  const searchContainerRef = useRef(null);
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSearchDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMedicines = useMemo(() => {

    const term = search.trim().toLowerCase();
    if (!term) return [];

    return medicines.filter((medicine) =>
      medicine.name?.toLowerCase().includes(term)
    );

  }, [medicines, search]);

  const matchedSections = useMemo(() => {

    const term = search.trim().toLowerCase();
    if (!term) return [];

    return SITE_SECTIONS.filter(
      (section) =>
        section.label.toLowerCase().includes(term) ||
        section.keywords.some((k) => k.toLowerCase().includes(term))
    );

  }, [search]);

  return (

    <Box
      ref={searchContainerRef}
      sx={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        width: {
          xs: "42%",
          sm: "420px",
          md: "500px",
          lg: "560px",
        },
        maxWidth: "560px",
      }}
    >

      <TextField
        fullWidth
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSearchDropdownOpen(true);
        }}
        onFocus={() => {
          if (search.trim()) {
            setSearchDropdownOpen(true);
          }
        }}
        placeholder="Search medicines, sections..."
        size="small"
        InputProps={{
          startAdornment: (
            <SearchIcon
              sx={{
                fontSize: 20,
                color: "#98A2B3",
                mr: 1,
              }}
            />
          ),
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            height: "44px",
            background: "#F8FAFC",
            borderRadius: "10px",
            fontSize: "13px",
            "& fieldset": {
              borderColor: "#E4E7EC",
            },
            "&:hover fieldset": {
              borderColor: "#D0D5DD",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#1976D2",
              borderWidth: "1px",
            },
          },
          "& input::placeholder": {
            color: "#98A2B3",
            opacity: 1,
          },
        }}
      />

      {searchDropdownOpen && search && (

        <Box
          sx={{
            position: "absolute",
            top: "52px",
            left: 0,
            width: "100%",
            background: "#FFFFFF",
            border: "1px solid #EAECF0",
            borderRadius: "10px",
            overflow: "hidden",
            zIndex: 1000,
            boxShadow: "0 12px 30px rgba(16,24,40,0.10)",
          }}
        >

          {matchedSections.length > 0 && (

            <Box>

              {matchedSections.map((section) => (

                <Box
                  key={`section-${section.path}`}
                  onClick={() => {
                    navigate(section.path);
                    setSearch("");
                    setSearchDropdownOpen(false);
                  }}
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    borderBottom: "1px solid #F2F4F7",
                    cursor: "pointer",
                    "&:hover": {
                      background: "#F8FAFC",
                    },
                  }}
                >

                  <Typography
                    sx={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#7C3AED",
                      background: "#F3E8FF",
                      px: "6px",
                      py: "2px",
                      borderRadius: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                      flexShrink: 0,
                    }}
                  >
                    Section
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#344054",
                    }}
                  >
                    {highlightMatch(section.label, search.trim())}
                  </Typography>

                </Box>

              ))}

            </Box>

          )}

          {filteredMedicines.length > 0 ? (

            <Box
              sx={{
                maxHeight: "280px",
                overflowY: "auto",
              }}
            >

              {filteredMedicines.slice(0, 6).map((medicine, index) => (

                <Box
                  key={medicine.id ?? index}
                  onClick={() => {
                    navigate(
                      `/inventory?highlight=${encodeURIComponent(medicine.id)}`
                    );
                    setSearch("");
                    setSearchDropdownOpen(false);
                  }}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom:
                      index !== Math.min(filteredMedicines.length, 6) - 1
                        ? "1px solid #F2F4F7"
                        : "none",
                    cursor: "pointer",
                    "&:hover": {
                      background: "#F8FAFC",
                    },
                  }}
                >

                  <Typography
                    sx={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#344054",
                    }}
                  >
                    {highlightMatch(medicine.name, search.trim())}
                  </Typography>

                </Box>

              ))}

            </Box>

          ) : (

            matchedSections.length === 0 && (

              <Box sx={{ p: 2 }}>
                <Typography sx={{ fontSize: "13px", color: "#98A2B3" }}>
                  No results found
                </Typography>
              </Box>

            )

          )}

        </Box>

      )}

    </Box>

  );
});


// =========================================================
// SUPERVISOR INFO (كومبوننت مستقل بحاله)
// =========================================================
// نفس مبدأ SearchBar بالضبط: حالة الهوفر (anchor) كانت جوّه Dashboard
// نفسه، فكل هوفر/مغادرة على أيقونة المستخدم كان يعيد رسم الصفحة كاملة.
// عزلها هنا يخلي الاستجابة فورية، وقللت مدة انتقال الـ Popover عشان
// يبان ويختفي بسرعة بدل التأخير الافتراضي.
const SupervisorInfo = React.memo(function SupervisorInfo() {

  const navigate = useNavigate();

  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);

  const handleOpen = (event) => setAnchor(event.currentTarget);
  const handleClose = () => setAnchor(null);

  return (

    <Box
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        ml: { xs: 1, sm: 2, md: 3 }, // الإزاحة لليمين قليلاً
        cursor: "pointer",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        p: 0,
      }}
    >
      <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#EAF4FF",
            border: "1px solid #D2E7FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1976D2",
            flexShrink: 0,
          }}
        >
          {/* استخدام PersonIcon الموجودة مسبقاً في ملفك */}
          <PersonIcon sx={{ fontSize: 24 }} />
        </Box>

        <Box
          sx={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 15,
            height: 15,
            borderRadius: "50%",
            background: "#1976D2",
            border: "2px solid #FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VerifiedUserIcon sx={{ fontSize: 9, color: "#FFFFFF" }} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Typography
          sx={{
            fontSize: "13.5px",
            color: "#172B4D",
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          Welcome, Dr. Abdullah Alateeq
        </Typography>

        <Typography
          sx={{
            fontSize: "11px",
            color: "#667085",
            fontWeight: 500,
            lineHeight: 1.3,
            mt: 0.3,
          }}
        >
          Pharmacy Supervisor
        </Typography>
      </Box>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableRestoreFocus
        transitionDuration={{ enter: 100, exit: 80 }}
        slotProps={{
          paper: {
            onMouseEnter: () => setAnchor((prev) => prev ?? anchor),
            onMouseLeave: handleClose,
            sx: {
              mt: 1.5,
              ml: 1,
              borderRadius: "20px",
              boxShadow: "0 20px 40px -15px rgba(16,24,40,0.1)",
              border: "1px solid #F1F5F9",
              p: 2.5,
              width: "270px",
              background: "#FFFFFF",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                background: "#EFF6FF",
                color: "#1976D2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <VerifiedUserIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Pharmacy Supervisor
              </Typography>
              <Typography sx={{ fontSize: "11px", color: "#64748B", fontWeight: 500, mt: 0.3 }}>
                Inpatient Operations
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              background: "#F8FAFC",
              borderRadius: "12px",
              p: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>System Access</Typography>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#0F172A" }}>Full Control</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Account Status</Typography>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#16A34A", display: "flex", alignItems: "center", gap: 0.5 }}>
                ● Active
              </Typography>
            </Box>
          </Box>

          <Box
            onClick={() => navigate("/")}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 1.2,
              borderRadius: "10px",
              background: "#FEF2F2",
              color: "#DC2626",
              cursor: "pointer",
              transition: "all 0.2s ease",
              "&:hover": {
                background: "#FEE2E2",
              },
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: "12px", fontWeight: 700 }}>
              Log Out
            </Typography>
          </Box>

        </Box>
      </Popover>
    </Box>

  );
});

function Dashboard() {

  const navigate = useNavigate();


  // =========================================================
  // BANNERS
  // =========================================================

  const banners = [
    banner1,
    banner2,
  ];


  // =========================================================
  // MEDICINES (من Firestore، نفس المجموعة اللي صفحة Inventory تحفظ فيها)
  // =========================================================

  const [medicines, setMedicines] = useState(
    dashboardMedicinesCache || []
  );

  const [medicinesLoading, setMedicinesLoading] = useState(
    !dashboardMedicinesCache
  );

  // العدد الافتراضي اللي يُعتبر "لو ستوك" لو الدواء نفسه ما محدد له
  // reorderLevel خاص - المستخدم يقدر يغيّره من قسم Low Stock Medicines
  const [lowStockThreshold, setLowStockThreshold] = useState(
    () => getLowStockThreshold()
  );


  useEffect(() => {

    let isMounted = true;

    async function loadMedicines() {

      try {

        const snapshot = await getDocs(
          collection(db, "medicines")
        );

        const list = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() })
        );

        list.sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );

        if (isMounted) {
          dashboardMedicinesCache = list;
          setMedicines(list);
        }

      } catch (err) {

        console.error(
          "فشل تحميل الأدوية من Firestore بالداش بورد:",
          err
        );

      } finally {

        if (isMounted) {
          setMedicinesLoading(false);
        }

      }

    }

    loadMedicines();

    return () => {
      isMounted = false;
    };

  }, []);


  // الأقسام (isSection) عناصر تنظيمية بس، ما تدخل بأي إحصائية فعلية
  const realMedicines = useMemo(
    () => medicines.filter((m) => !m.isSection),
    [medicines]
  );


  const totalMedicines = realMedicines.length;


  // =========================================================
  // MEDICINE STATUS
  // =========================================================

  const {
    safeMedicines,
    nearExpiry,
    expired,
  } = useMemo(() => {

    const today = new Date();

    let safe = 0;
    let near = 0;
    let exp = 0;


    realMedicines.forEach((medicine) => {

      if (!medicine.expiry) return;

      const expiryDate = new Date(
        medicine.expiry
      );

      const days =
        (expiryDate - today) /
        (1000 * 60 * 60 * 24);


      if (days < 0) {

        exp++;

      } else if (days <= 90) {

        near++;

      } else {

        safe++;

      }

    });


    return {
      safeMedicines: safe,
      nearExpiry: near,
      expired: exp,
    };

  }, [realMedicines]);


  // =========================================================
  // MONTHLY EXPIRY ANALYSIS (بسنة قابلة للاختيار + أسماء الأدوية لكل شهر)
  // =========================================================

  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // نجمع كل السنوات الموجودة فعليًا بتواريخ الانتهاء عشان نعبّي بيها قائمة
  // الاختيار، ونضيف السنة الحالية احتياطًا لو ما فيه ولا دواء بعد
  const availableYears = useMemo(() => {

    const years = new Set([
      new Date().getFullYear(),
    ]);

    realMedicines.forEach((medicine) => {

      const dates = medicine.expiryDates?.length
        ? medicine.expiryDates
        : [medicine.expiry];

      dates.forEach((expiry) => {

        if (!expiry) return;

        const date = new Date(expiry);

        if (!Number.isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }

      });

    });

    return Array.from(years).sort(
      (a, b) => a - b
    );

  }, [realMedicines]);


  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );


  const stockData = useMemo(() => {

    return MONTH_LABELS.map((month, index) => {

      const matches = realMedicines.filter(
        (medicine) => {

          if (!medicine.expiry) {
            return false;
          }

          const date = new Date(
            medicine.expiry
          );

          return (
            date.getMonth() === index &&
            date.getFullYear() === selectedYear
          );

        }
      );


      return {
        month,
        medicines: matches.length,
        names: matches.map(
          (medicine) => medicine.name || "Unknown"
        ),
      };

    });

  }, [realMedicines, selectedYear]);


  // تولتيب مخصص للرسم البياني: يعرض عدد الأدوية المنتهية بالشهر وأسماءها
  const ExpiryChartTooltip = ({ active, payload, label }) => {

    if (!active || !payload || !payload.length) {
      return null;
    }

    const { medicines: count, names } = payload[0].payload;

    const shownNames = names.slice(0, 6);
    const remaining = names.length - shownNames.length;

    return (

      <Box
        sx={{
          background: "#FFFFFF",
          border: "1px solid #E4E7EC",
          borderRadius: "10px",
          boxShadow: "0 12px 30px rgba(16,24,40,0.12)",
          p: 1.5,
          maxWidth: "220px",
        }}
      >

        <Typography
          sx={{ fontSize: "12px", fontWeight: 700, color: "#172B4D" }}
        >
          {label} {selectedYear} — {count} {count === 1 ? "medicine" : "medicines"}
        </Typography>

        {shownNames.length > 0 && (

          <Box sx={{ mt: 0.5 }}>

            {shownNames.map((name, idx) => (

              <Typography
                key={idx}
                sx={{ fontSize: "11px", color: "#667085" }}
              >
                • {name}
              </Typography>

            ))}

            {remaining > 0 && (

              <Typography
                sx={{ fontSize: "11px", color: "#98A2B3", mt: 0.3 }}
              >
                +{remaining} more
              </Typography>

            )}

          </Box>

        )}

      </Box>

    );

  };


  // =========================================================
  // SEARCH
  // =========================================================

  // =========================================================
  // CARD NAVIGATION
  // =========================================================

  const handleCardClick = (filterKey) => {

    navigate(
      `/inventory?filter=${filterKey}`
    );

  };


  // =========================================================
  // DASHBOARD CARDS
  // =========================================================

  const cards = [

    {
      title: "Total Medicines",
      value: totalMedicines,
      desc: "All medicines in inventory",
      color: "#1976D2",
      bg: "#EAF4FF",
      icon: <Inventory2Icon />,
      filterKey: "all",
    },

    {
      title: "Safe Medicines",
      value: safeMedicines,
      desc: "Safe expiry period",
      color: "#00A86B",
      bg: "#EAF9F2",
      icon: <CheckCircleIcon />,
      filterKey: "safe",
    },

    {
      title: "Near Expiry",
      value: nearExpiry,
      desc: "Expiry within 90 days",
      color: "#F59E0B",
      bg: "#FFF7E6",
      icon: <AccessTimeIcon />,
      filterKey: "near",
    },

    {
      title: "Expired",
      value: expired,
      desc: "Expired medicines",
      color: "#E63946",
      bg: "#FFF0F1",
      icon: <WarningIcon />,
      filterKey: "expired",
    },

  ];


  // =========================================================
  // EXPIRING WITHIN 30 DAYS
  // =========================================================

  // القائمة الكاملة (بدون قص) — تُستخدم لعرض العدد الصحيح بجانب عنوان
  // الكرت. قبل كذا كان العدد المعروض يطلع من نفس القائمة المقصوصة على 4
  // عناصر بس، فكان يوقف عند 4 حتى لو الأدوية الفعلية اللي بتنتهي خلال
  // 30 يوم أكثر من كذا (نفس مشكلة عدم التطابق بين الداشبورد والانفنتوري)
  const expiringWithin30DaysFull = useMemo(() => {

    const today = new Date();

    return realMedicines
      .filter((medicine) => {

        if (!medicine.expiry) {
          return false;
        }

        const expiryDate =
          new Date(medicine.expiry);

        const days =
          (expiryDate - today) /
          (1000 * 60 * 60 * 24);

        return days >= 0 && days <= 30;

      })
      .sort(
        (a, b) =>
          new Date(a.expiry) -
          new Date(b.expiry)
      );

  }, [realMedicines]);

  // البوكس صار يعرض القائمة الكاملة بسكرول داخلي بدل ما يوقف عند 4 بس
  const expiringWithin30Days = expiringWithin30DaysFull;


  // =========================================================
  // LOW STOCK (القائمة الكاملة تُستخدم بالجدول الأسفل، وأول 4 بالكرت الجانبي)
  // =========================================================

  const lowStockMedicinesFull = useMemo(() => {

    return realMedicines
      .filter((medicine) => {

        const quantity = parseQuantityNumber(
          medicine.quantity ??
          medicine.qty ??
          medicine.stock ??
          0
        );

        // نستخدم دايمًا القيمة اللي محددها المستخدم بصندوق "Consider low
        // stock at or below" — هذا هو المعنى الحرفي للنص، وهذا اللي يتوقعه
        // المستخدم لما يغيّر الرقم. قبل كذا كنا نعطي الأولوية لـ reorderLevel
        // الخاص بكل دواء (اللي القيمة الافتراضية له 20 لأي دواء يضاف من نموذج
        // الإضافة)، فكان يتجاهل عمليًا أي رقم يحطه المستخدم هنا لمعظم الأدوية
        const reorderLevel = Number(lowStockThreshold);

        return (
          quantity <= reorderLevel &&
          quantity >= 0
        );

      })
      .sort((a, b) => {

        const qtyA = parseQuantityNumber(
          a.quantity ?? a.qty ?? a.stock ?? 0
        );

        const qtyB = parseQuantityNumber(
          b.quantity ?? b.qty ?? b.stock ?? 0
        );

        return qtyA - qtyB;

      });

  }, [realMedicines, lowStockThreshold]);


  // القائمة كانت تُقص لأول 4 عناصر بس هنا، فالبوكس ما كان يقدر يعرض الباقي
  // أبدًا مهما كبّرنا صندوقه. الحين نعرض القائمة كاملة جوا صندوق بسكرول
  // داخلي (overflowY) بدل ما يطول الكرت بلا حدود
  const lowStockMedicines = lowStockMedicinesFull;


  // =========================================================
  // LATEST INVENTORY ACTIVITY
  // =========================================================

  const latestMedicines = useMemo(() => {

    return [...realMedicines]
      .sort((a, b) => {

        const dateA = new Date(
          a.dateAdded ??
          a.createdAt ??
          a.addedDate ??
          0
        );

        const dateB = new Date(
          b.dateAdded ??
          b.createdAt ??
          b.addedDate ??
          0
        );

        return dateB - dateA;

      });
      // ما نقص القائمة بعد — البوكس صار يعرضها كاملة بسكرول داخلي

  }, [realMedicines]);


  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {

    if (!date) {
      return "Recently added";
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "Recently added";
    }

    return parsedDate.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );

  };


  // =========================================================
  // EMPTY STATE
  // =========================================================

  const EmptyState = ({
    icon,
    title,
    description,
  }) => (

    <Box
      sx={{
        minHeight: "150px",

        display: "flex",
        flexDirection: "column",

        alignItems: "center",
        justifyContent: "center",

        textAlign: "center",

        px: 2,
      }}
    >

      <Box
        sx={{
          width: 42,
          height: 42,

          borderRadius: "10px",

          background: "#F5F7FA",

          color: "#98A2B3",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          mb: 1.5,
        }}
      >
        {icon}
      </Box>


      <Typography
        sx={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#344054",
        }}
      >
        {title}
      </Typography>


      <Typography
        sx={{
          fontSize: "12px",
          color: "#98A2B3",
          mt: 0.5,
        }}
      >
        {description}
      </Typography>

    </Box>

  );


  return (

    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",

        background: "#FFFFFF",

        overflowX: "hidden",
      }}
    >


      {/* =====================================================
          HEADER
      ===================================================== */}

      <Box
        sx={{
          height: "80px",
          width: "100%",
          background: "#FFFFFF",
          borderBottom: "1px solid #EAECF0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 2, sm: 3, md: 5, lg: 6 },
          position: "relative",
          zIndex: 30,
        }}
      >


        {/* =================================================
            USER
        ================================================= */}

        {/* USER SECTION */}
        <SupervisorInfo />


        {/* =================================================
            SEARCH
        ================================================= */}

        <SearchBar medicines={realMedicines} />


        {/* =================================================
            HOSPITAL LOGO
        ================================================= */}

        <Box
          sx={{
            marginLeft: "auto",
            mt: "-12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: {
              xs: "130px",
              md: "400px",
            },
            overflow: "visible",
          }}
        >

          <img
            src="/logo.png"
            alt="Hail Health Cluster"
            style={{
              width: "230px",
              height: "68px",
              objectFit: "contain",
              transform: "scale(1.25)",
              transformOrigin: "center right",
            }}
          />

        </Box>

      </Box>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      {/* =================================================
            BANNER
        ================================================= */}

        <Box
          sx={{
            width: "100%",
            height: {
              xs: "180px",
              sm: "230px",
              md: "290px",
            },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: {
              xs: 4,
              md: 5,
            },
            borderRadius: "16px",
            overflow: "hidden",
            background: "#FFFFFF",
            border: "1px solid #EAECF0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          }}
        >
          <Swiper
            modules={[Autoplay]}
            autoplay={{
              delay: 4000,
            }}
            loop={true}
            speed={800}
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            {banners.map(
              (image, index) => (
                <SwiperSlide
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <img
                    src={image}
                    alt="Smart Pharmacy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "8px",
                    }}
                  />
                </SwiperSlide>
              )
            )}
          </Swiper>
        </Box>


        {/* =================================================
            STATISTICS
        ================================================= */}

        <Box
          sx={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "stretch",
            gap: {
              xs: 2,
              md: 3,
            },
            flexWrap: {
              xs: "wrap",
              md: "nowrap",
            },
            mb: 6,
          }}
        >

          {cards.map(
            (card, index) => (

              <Box
                key={index}

                onClick={() =>
                  handleCardClick(
                    card.filterKey
                  )
                }

                sx={{
                  width: {
                    xs: "100%",
                    sm: "calc(50% - 8px)",
                    md: "270px",
                    lg: "280px",
                  },

                  height: "158px",

                  background:
                    "#FFFFFF",

                  border:
                    "1px solid #E4E7EC",

                  borderRadius:
                    "12px",

                  p: 2.5,

                  boxSizing:
                    "border-box",

                  position:
                    "relative",

                  cursor:
                    "pointer",

                  transition:
                    "all 0.2s ease",

                  "&:hover": {

                    transform:
                      "translateY(-3px)",

                    borderColor:
                      card.color,

                    boxShadow:
                      "0 8px 24px rgba(16,24,40,0.07)",
                  },
                }}
              >

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.6,
                  }}
                >

                  <Box
                    sx={{
                      width: 50,
                      height: 50,

                      borderRadius:
                        "11px",

                      background:
                        card.bg,

                      color:
                        card.color,

                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "center",

                      flexShrink: 0,
                    }}
                  >

                    {React.cloneElement(
                      card.icon,
                      {
                        sx: {
                          fontSize: 24,
                        },
                      }
                    )}

                  </Box>


                  <Box>

                    <Typography
                      sx={{
                        fontSize:
                          "13px",

                        color:
                          "#667085",

                        fontWeight:
                          600,

                        mb: 0.5,

                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {card.title}
                    </Typography>


                    <Typography
                      sx={{
                        fontSize:
                          "31px",

                        lineHeight:
                          1,

                        color:
                          "#172B4D",

                        fontWeight:
                          800,
                      }}
                    >
                      {card.value}
                    </Typography>

                  </Box>

                </Box>


                <Typography
                  sx={{
                    position:
                      "absolute",

                    left: 20,

                    bottom: 19,

                    fontSize:
                      "12px",

                    color:
                      "#98A2B3",
                  }}
                >
                  {card.desc}
                </Typography>


                <Box
                  sx={{
                    position:
                      "absolute",

                    left: 0,

                    bottom: 0,

                    width: "34%",

                    height: "3px",

                    background:
                      card.color,
                  }}
                />

              </Box>

            )
          )}

        </Box>


        {/* =================================================
            INVENTORY INSIGHTS
        ================================================= */}

        <Box
          sx={{
            maxWidth:
              "1200px",

            margin:
              "0 auto",

            mb: 7,
          }}
        >

          <Box
            sx={{
              display: "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              mb: 2.5,
            }}
          >

            <Box>

              <Typography
                sx={{
                  fontSize:
                    "23px",

                  fontWeight:
                    700,

                  color:
                    "#172B4D",
                }}
              >
                Inventory Insights
              </Typography>


              <Typography
                sx={{
                  fontSize:
                    "13px",

                  color:
                    "#98A2B3",

                  mt: 0.5,
                }}
              >
                Important information that
                needs your attention
              </Typography>

            </Box>

          </Box>


          {/* =================================================
              INSIGHT CARDS
          ================================================= */}

          <Box
            sx={{
              display: "grid",

              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, 1fr)",
              },

              gap: 3,
            }}
          >


            {/* =================================================
                EXPIRING WITHIN 30 DAYS
            ================================================= */}

            <Box
              sx={{
                background:
                  "#FFFFFF",

                border:
                  "1px solid #E4E7EC",

                borderRadius:
                  "12px",

                overflow:
                  "hidden",
              }}
            >

              <Box
                sx={{
                  px: 2.5,
                  py: 2,

                  borderBottom:
                    "1px solid #F2F4F7",

                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                }}
              >

                <Box
                  sx={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap: 1.2,
                  }}
                >

                  <Box
                    sx={{
                      width: 36,
                      height: 36,

                      borderRadius:
                        "9px",

                      background:
                        "#FFF7E6",

                      color:
                        "#F59E0B",

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",
                    }}
                  >

                    <EventIcon
                      sx={{
                        fontSize: 20,
                      }}
                    />

                  </Box>


                  <Typography
                    sx={{
                      fontSize:
                        "15px",

                      fontWeight:
                        700,

                      color:
                        "#344054",
                    }}
                  >
                    Expiring Within 30 Days
                  </Typography>

                </Box>


                <Typography
                  sx={{
                    fontSize:
                      "12px",

                    color:
                      "#98A2B3",
                  }}
                >
                  {expiringWithin30DaysFull.length}
                </Typography>

              </Box>


              <Box sx={{ px: 2.5, maxHeight: "320px", overflowY: "auto" }}>

                {expiringWithin30Days.length >
                0 ? (

                  expiringWithin30Days.map(
                    (medicine, index) => (

                      <Box
                        key={index}

                        sx={{
                          py: 1.5,

                          display:
                            "flex",

                          alignItems:
                            "center",

                          justifyContent:
                            "space-between",

                          borderBottom:
                            index !==
                            expiringWithin30Days.length -
                              1
                              ? "1px solid #F5F5F5"
                              : "none",
                        }}
                      >

                        <Box>

                          <Typography
                            sx={{
                              fontSize:
                                "13px",

                              fontWeight:
                                600,

                              color:
                                "#344054",
                            }}
                          >
                            {medicine.name}
                          </Typography>


                          <Typography
                            sx={{
                              fontSize:
                                "11px",

                              color:
                                "#98A2B3",

                              mt: 0.3,
                            }}
                          >
                            Batch:{" "}
                            {medicine.batch ||
                              medicine.batchNumber ||
                              "—"}
                          </Typography>

                        </Box>


                        <Box
                          sx={{
                            textAlign:
                              "right",
                          }}
                        >

                          <Typography
                            sx={{
                              fontSize:
                                "12px",

                              fontWeight:
                                600,

                              color:
                                "#E63946",
                            }}
                          >
                            {formatDate(
                              medicine.expiry
                            )}
                          </Typography>


                          <Typography
                            sx={{
                              fontSize:
                                "11px",

                              color:
                                "#98A2B3",

                              mt: 0.3,
                            }}
                          >
                            Qty:{" "}
                            {medicine.quantity ??
                              medicine.qty ??
                              medicine.stock ??
                              "—"}
                          </Typography>

                        </Box>

                      </Box>

                    )
                  )

                ) : (

                  <EmptyState
                    icon={
                      <CheckCircleIcon />
                    }
                    title="No medicines expiring soon"
                    description="Everything looks good for the next 30 days."
                  />

                )}

              </Box>


              {expiringWithin30Days.length >
                0 && (

                <Box
                  onClick={() =>
                    navigate(
                      "/inventory?filter=near"
                    )
                  }

                  sx={{
                    px: 2.5,
                    py: 1.5,

                    borderTop:
                      "1px solid #F2F4F7",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "flex-end",

                    gap: 0.5,

                    cursor:
                      "pointer",

                    color:
                      "#1976D2",

                    "&:hover": {
                      background:
                        "#F8FAFC",
                    },
                  }}
                >

                  <Typography
                    sx={{
                      fontSize:
                        "12px",

                      fontWeight:
                        600,
                    }}
                  >
                    View All
                  </Typography>

                  <ArrowForwardIcon
                    sx={{
                      fontSize: 16,
                    }}
                  />

                </Box>

              )}

            </Box>


            {/* =================================================
                LATEST INVENTORY ACTIVITY
            ================================================= */}

            <Box
              sx={{
                background:
                  "#FFFFFF",

                border:
                  "1px solid #E4E7EC",

                borderRadius:
                  "12px",

                overflow:
                  "hidden",
              }}
            >

              <Box
                sx={{
                  px: 2.5,
                  py: 2,

                  borderBottom:
                    "1px solid #F2F4F7",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap: 1.2,
                }}
              >

                <Box
                  sx={{
                    width: 36,
                    height: 36,

                    borderRadius:
                      "9px",

                    background:
                      "#EAF4FF",

                    color:
                      "#1976D2",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",
                  }}
                >

                  <LocalShippingIcon
                    sx={{
                      fontSize: 20,
                    }}
                  />

                </Box>


                <Typography
                  sx={{
                    fontSize:
                      "15px",

                    fontWeight:
                      700,

                    color:
                      "#344054",
                  }}
                >
                  Latest Inventory Activity
                </Typography>

              </Box>


              <Box sx={{ px: 2.5, maxHeight: "320px", overflowY: "auto" }}>

                {latestMedicines.length >
                0 ? (

                  latestMedicines.map(
                    (medicine, index) => (

                      <Box
                        key={index}

                        sx={{
                          py: 1.5,

                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap: 1.5,

                          borderBottom:
                            index !==
                            latestMedicines.length -
                              1
                              ? "1px solid #F5F5F5"
                              : "none",
                        }}
                      >

                        <Box
                          sx={{
                            width: 34,
                            height: 34,

                            borderRadius:
                              "8px",

                            background:
                              "#F5F9FD",

                            color:
                              "#1976D2",

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "center",

                            flexShrink: 0,
                          }}
                        >

                          <InventoryIcon
                            sx={{
                              fontSize: 18,
                            }}
                          />

                        </Box>


                        <Box
                          sx={{
                            minWidth: 0,
                          }}
                        >

                          <Typography
                            sx={{
                              fontSize:
                                "13px",

                              fontWeight:
                                600,

                              color:
                                "#344054",

                              whiteSpace:
                                "nowrap",

                              overflow:
                                "hidden",

                              textOverflow:
                                "ellipsis",
                            }}
                          >
                            {medicine.name ||
                              "Medicine added"}
                          </Typography>


                          <Typography
                            sx={{
                              fontSize:
                                "11px",

                              color:
                                "#98A2B3",

                              mt: 0.3,
                            }}
                          >
                            Batch:{" "}
                            {medicine.batch ||
                              medicine.batchNumber ||
                              "—"}
                            {" • "}
                            {formatDate(
                              medicine.dateAdded ||
                              medicine.createdAt ||
                              medicine.addedDate
                            )}
                          </Typography>

                        </Box>

                      </Box>

                    )
                  )

                ) : (

                  <EmptyState
                    icon={
                      <InventoryIcon />
                    }
                    title="No recent activity"
                    description="New inventory activity will appear here."
                  />

                )}

              </Box>


              <Box
                onClick={() =>
                  navigate(
                    "/inventory"
                  )
                }

                sx={{
                  px: 2.5,
                  py: 1.5,

                  borderTop:
                    "1px solid #F2F4F7",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "flex-end",

                  gap: 0.5,

                  cursor:
                    "pointer",

                  color:
                    "#1976D2",

                  "&:hover": {
                    background:
                      "#F8FAFC",
                  },
                }}
              >

                <Typography
                  sx={{
                    fontSize:
                      "12px",

                    fontWeight:
                      600,
                  }}
                >
                  View Inventory
                </Typography>

                <ArrowForwardIcon
                  sx={{
                    fontSize: 16,
                  }}
                />

              </Box>

            </Box>


            {/* =================================================
                LOW STOCK
            ================================================= */}

            <Box
              sx={{
                background:
                  "#FFFFFF",

                border:
                  "1px solid #E4E7EC",

                borderRadius:
                  "12px",

                overflow:
                  "hidden",
              }}
            >

              <Box
                sx={{
                  px: 2.5,
                  py: 2,

                  borderBottom:
                    "1px solid #F2F4F7",

                  display:
                    "flex",

                  flexDirection:
                    "column",

                  gap: 1.2,
                }}
              >

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                  }}
                >

                  <Box
                    sx={{
                      width: 36,
                      height: 36,

                      borderRadius:
                        "9px",

                      background:
                        "#FFF0F1",

                      color:
                        "#E63946",

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",
                    }}
                  >

                    <TrendingDownIcon
                      sx={{
                        fontSize: 20,
                      }}
                    />

                  </Box>


                  <Typography
                    sx={{
                      fontSize:
                        "15px",

                      fontWeight:
                        700,

                      color:
                        "#344054",
                    }}
                  >
                    Low Stock
                  </Typography>

                </Box>

                {/* CONSIDER LOW STOCK THRESHOLD (انتقل من جدول Low Stock
                    Medicines المكرر اللي تم حذفه، صار هنا بدل ذاك) */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    background: "#F8FAFC",
                    border: "1px solid #EAECF0",
                    borderRadius: "8px",
                    px: 1.2,
                    py: 0.6,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "11px",
                      color: "#667085",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Consider low stock at or below
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={lowStockThreshold}
                    onChange={(e) =>
                      setLowStockThreshold(e.target.value)
                    }
                    onBlur={(e) =>
                      setLowStockThreshold(
                        saveLowStockThreshold(e.target.value)
                      )
                    }
                    inputProps={{
                      min: 1,
                      style: {
                        width: "44px",
                        padding: "3px 5px",
                        fontSize: "12px",
                      },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        background: "#FFFFFF",
                        borderRadius: "6px",
                      },
                    }}
                  />
                  <Typography
                    sx={{ fontSize: "11px", color: "#667085" }}
                  >
                    units
                  </Typography>
                </Box>

              </Box>


              <Box sx={{ px: 2.5, maxHeight: "320px", overflowY: "auto" }}>

                {lowStockMedicines.length >
                0 ? (

                  lowStockMedicines.map(
                    (medicine, index) => {

                      const quantity =
                        parseQuantityNumber(
                          medicine.quantity ??
                          medicine.qty ??
                          medicine.stock ??
                          0
                        );

                      const reorderLevel =
                        Number(lowStockThreshold);


                      return (

                        <Box
                          key={index}

                          sx={{
                            py: 1.5,

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "space-between",

                            borderBottom:
                              index !==
                              lowStockMedicines.length -
                                1
                                ? "1px solid #F5F5F5"
                                : "none",
                          }}
                        >

                          <Box>

                            <Typography
                              sx={{
                                fontSize:
                                  "13px",

                                fontWeight:
                                  600,

                                color:
                                  "#344054",
                              }}
                            >
                              {medicine.name ||
                                "Unknown Medicine"}
                            </Typography>


                            <Typography
                              sx={{
                                fontSize:
                                  "11px",

                                color:
                                  "#98A2B3",

                                mt: 0.3,
                              }}
                            >
                              Reorder level:{" "}
                              {reorderLevel}
                            </Typography>

                          </Box>


                          <Typography
                            sx={{
                              fontSize:
                                "13px",

                              fontWeight:
                                700,

                              color:
                                "#E63946",
                            }}
                          >
                            {quantity} units
                          </Typography>

                        </Box>

                      );

                    }
                  )

                ) : (

                  <EmptyState
                    icon={
                      <CheckCircleIcon />
                    }
                    title="Stock levels look good"
                    description="No medicines are currently below the reorder level."
                  />

                )}

              </Box>


              {lowStockMedicines.length >
                0 && (

                <Box
                  onClick={() =>
                    navigate(
                      "/inventory?filter=low-stock"
                    )
                  }

                  sx={{
                    px: 2.5,
                    py: 1.5,

                    borderTop:
                      "1px solid #F2F4F7",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "flex-end",

                    gap: 0.5,

                    cursor:
                      "pointer",

                    color:
                      "#1976D2",

                    "&:hover": {
                      background:
                        "#F8FAFC",
                    },
                  }}
                >

                  <Typography
                    sx={{
                      fontSize:
                        "12px",

                      fontWeight:
                        600,
                    }}
                  >
                    View Low Stock
                  </Typography>

                  <ArrowForwardIcon
                    sx={{
                      fontSize: 16,
                    }}
                  />

                </Box>

              )}

            </Box>

          </Box>

        </Box>


        {/* =================================================
            MEDICINE EXPIRY ANALYSIS
        ================================================= */}

        <Box
          sx={{
            maxWidth:
              "1200px",

            margin:
              "0 auto",

            mb: 7,
          }}
        >

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1.5,

              mb: 2.5,
            }}
          >

            <Typography
              sx={{
                fontSize:
                  "23px",

                fontWeight:
                  700,

                color:
                  "#172B4D",
              }}
            >
              Medicine Expiry Analysis
            </Typography>


            <Select
              value={selectedYear}

              onChange={(e) =>
                setSelectedYear(e.target.value)
              }

              size="small"

              sx={{
                minWidth: "110px",

                borderRadius: "10px",

                fontSize: "13px",

                fontWeight: 600,

                background: "#F8FAFC",

                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#E4E7EC",
                },
              }}
            >

              {availableYears.map((year) => (

                <MenuItem
                  key={year}
                  value={year}
                >
                  {year}
                </MenuItem>

              ))}

            </Select>

          </Box>


          <Box
            sx={{
              width:
                "100%",

              height:
                "280px",
            }}
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={stockData}

                margin={{
                  top: 10,
                  right: 20,
                  left: 0,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                />

                <XAxis
                  dataKey="month"

                  tick={{
                    fill:
                      "#697586",

                    fontSize: 13,
                  }}
                />

                <YAxis
                  allowDecimals={false}

                  tick={{
                    fill:
                      "#697586",

                    fontSize: 13,
                  }}
                />

                <Tooltip content={<ExpiryChartTooltip />} />

                <Line
                  type="monotone"

                  dataKey="medicines"

                  stroke="#1976D2"

                  strokeWidth={3}

                  dot={{
                    r: 4,
                  }}

                  activeDot={{
                    r: 6,
                  }}
                />

              </LineChart>

            </ResponsiveContainer>

          </Box>

        </Box>


      {/* GLOBAL FOOTER */}
<Box
  component="footer"
  sx={{
    maxWidth: "1200px",
    margin: "40px auto 0 auto",
    pt: 3,
    pb: 4,
    borderTop: "1px solid #EAECF0",
    display: "flex",
    flexDirection: { xs: "column", sm: "row" },
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
  }}
>
  <Typography
    sx={{
      fontSize: "13px",
      color: "#667085",
    }}
  >
    Notice an issue or have a suggestion?{" "}
    <Link
      component="button"
      onClick={() => navigate("/support")}
      sx={{
        color: "#1976D2",
        fontWeight: 600,
        textDecoration: "none",
        cursor: "pointer",
        "&:hover": {
          textDecoration: "underline",
        },
      }}
    >
      Contact Support
    </Link>
    .
  </Typography>

  <Typography
    sx={{
      fontSize: "12px",
      color: "#98A2B3",
    }}
  >
    Version 1.0.0
  </Typography>
</Box>
<NotificationBell />
    </Box>

  );
}


export default Dashboard;