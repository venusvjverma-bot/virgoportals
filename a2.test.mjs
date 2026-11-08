import React, { useEffect, useRef, useState, useMemo } from "react";
import { renderToString } from "react-dom/server";
import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { Mail, CheckCircle2, KeyRound, Building2, LayoutDashboard, Store, CalendarDays, Coins, Layers3, EyeOff, Camera, ScanSearch, UserCheck, QrCode, ShoppingBasket, Languages, BadgeCheck, BellRing, BarChart3, Printer, ShieldCheck, Sparkles, Smartphone, ChefHat, ArrowRight, LogIn, ArrowLeft } from "lucide-react";
import { useReducedMotion, motion, useScroll, AnimatePresence, useTransform } from "motion/react";
function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}
function LogoMark({ className }) {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 40 40", className: cn("h-10 w-10", className), "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("rect", { width: "40", height: "40", rx: "12", fill: "currentColor" }),
    /* @__PURE__ */ jsx("circle", { cx: "20", cy: "20", r: "9.5", fill: "none", stroke: "#F6F1EA", strokeWidth: "1.6", opacity: "0.85" }),
    /* @__PURE__ */ jsx("circle", { cx: "20", cy: "20", r: "3.4", fill: "#F6F1EA" }),
    /* @__PURE__ */ jsx("circle", { cx: "27.4", cy: "12.6", r: "1.5", fill: "#F6F1EA", opacity: "0.9" })
  ] });
}
function Logo({ className, tone = "dark" }) {
  return /* @__PURE__ */ jsxs("div", { className: cn("flex items-center gap-3", className), children: [
    /* @__PURE__ */ jsx(LogoMark, { className: tone === "light" ? "text-cream-100" : "text-olive-700" }),
    /* @__PURE__ */ jsx(
      "span",
      {
        className: cn(
          "font-display text-lg font-semibold tracking-tight",
          tone === "light" ? "text-cream-100" : "text-ink"
        ),
        children: "Virgo Portals"
      }
    )
  ] });
}
function ChapterNavigation({ chapters, activeIndex, progress, onSelect }) {
  useEffect(() => {
  }, [progress]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none fixed inset-x-0 top-0 z-40 h-1 bg-cream-200", children: /* @__PURE__ */ jsx(
      "div",
      {
        className: "h-full bg-olive-600 transition-[width] duration-150 ease-out",
        style: { width: `${Math.round(progress * 100)}%` }
      }
    ) }),
    /* @__PURE__ */ jsx(
      "nav",
      {
        "aria-label": "Chapters",
        className: "fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex",
        children: chapters.map((chapter, index) => /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => onSelect(chapter.id),
            className: "group flex items-center gap-2",
            "aria-current": index === activeIndex ? "true" : void 0,
            children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: `text-xs font-medium transition-opacity ${index === activeIndex ? "text-olive-700 opacity-100" : "text-ink-muted opacity-0 group-hover:opacity-100"}`,
                  children: chapter.short
                }
              ),
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: `h-2.5 w-2.5 rounded-full ring-1 transition ${index === activeIndex ? "scale-125 bg-olive-600 ring-olive-600" : "bg-white ring-cream-300 group-hover:bg-cream-200"}`
                }
              )
            ]
          },
          chapter.id
        ))
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center md:hidden", children: /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 shadow-soft ring-1 ring-cream-200", children: chapters.map((chapter, index) => /* @__PURE__ */ jsx(
      "span",
      {
        className: `h-1.5 rounded-full transition-all ${index === activeIndex ? "w-5 bg-olive-600" : "w-1.5 bg-cream-300"}`
      },
      chapter.id
    )) }) })
  ] });
}
function ChapterShell({ id, chapterNumber, kicker, title, children, flip = false }) {
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion ? {} : {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  };
  return /* @__PURE__ */ jsxs("section", { id, className: "relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-20 sm:px-8", children: [
    /* @__PURE__ */ jsxs(motion.div, { ...reveal, children: [
      /* @__PURE__ */ jsxs("p", { className: "font-display text-sm uppercase tracking-[0.25em] text-olive-600", children: [
        String(chapterNumber).padStart(2, "0"),
        " — ",
        kicker
      ] }),
      /* @__PURE__ */ jsx("h2", { className: "mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl", children: title })
    ] }),
    /* @__PURE__ */ jsx("div", { className: `mt-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`, children })
  ] });
}
function ChapterText({ children }) {
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: "-60px" },
      transition: { duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] },
      className: "space-y-4 text-base leading-relaxed text-ink-soft sm:text-lg",
      children
    }
  );
}
const EASE = [0.22, 1, 0.36, 1];
function Floating({
  children,
  delay = 0,
  distance = 8,
  rotate = 2,
  className
}) {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      className,
      initial: reduce ? false : { opacity: 0, scale: 0.92 },
      whileInView: { opacity: 1, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { duration: 0.6, delay, ease: EASE },
      children: /* @__PURE__ */ jsx(
        motion.div,
        {
          animate: reduce ? void 0 : { y: [0, -distance, 0], rotate: [-rotate, rotate, -rotate] },
          transition: { duration: 5 + delay, repeat: Infinity, ease: "easeInOut" },
          children
        }
      )
    }
  );
}
function useSectionProgress() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return [ref, scrollYProgress];
}
function PhoneMock({ children }) {
  return /* @__PURE__ */ jsx("div", { className: "h-64 w-32 rounded-[1.6rem] bg-ink p-1.5 shadow-lift sm:h-72 sm:w-36", children: /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full flex-col overflow-hidden rounded-[1.2rem] bg-cream-50", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center pt-1.5", children: /* @__PURE__ */ jsx("div", { className: "h-1 w-8 rounded-full bg-ink/20" }) }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-hidden p-2", children })
  ] }) });
}
function MenuLines() {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: { opacity: 0, y: 6 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { delay: 1, duration: 0.4 },
        className: "h-8 rounded-lg bg-olive-200"
      }
    ),
    [1.1, 1.2, 1.3].map((d, i) => /* @__PURE__ */ jsxs(
      motion.div,
      {
        initial: { opacity: 0, x: -8 },
        whileInView: { opacity: 1, x: 0 },
        viewport: { once: true },
        transition: { delay: d, duration: 0.4 },
        className: "flex items-center gap-1.5",
        children: [
          /* @__PURE__ */ jsx("div", { className: `h-7 w-7 rounded-md ${["bg-cream-200", "bg-olive-100", "bg-warning-100"][i]}` }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-1", children: [
            /* @__PURE__ */ jsx("div", { className: "h-1.5 w-full rounded bg-cream-300" }),
            /* @__PURE__ */ jsx("div", { className: "h-1.5 w-2/3 rounded bg-cream-200" })
          ] })
        ]
      },
      d
    ))
  ] });
}
const TABS = [
  {
    id: "setup",
    tab: "01 — Set up",
    title: "Set up your restaurant",
    description: "Create your Host account and configure your restaurant environment, including restaurant details, currency, welcome message and service type.",
    image: "/welcome-setup.webp",
    alt: "Laptop showing the Virgo Portals Host Dashboard restaurant settings on a restaurant host stand"
  },
  {
    id: "menu",
    tab: "02 — Build your menu",
    title: "Build your digital menu",
    description: "Add dishes, images, prices, serving sizes, variants and add-ons. You can also extract dishes from a PDF menu using AI assistance, then review and correct the results before publishing.",
    image: "/welcome-menu.webp",
    alt: "Plated dishes beside a tablet displaying the Virgo Portals digital menu and a PDF menu being reviewed"
  },
  {
    id: "guests",
    tab: "03 — Welcome guests",
    title: "Welcome your guests",
    description: "Guests scan your restaurant's QR code, select their language, explore your digital menu and use the visitor chat to discover suitable dishes.",
    image: "/welcome-guests.webp",
    alt: "Restaurant table with a QR code stand and a smartphone showing the Virgo Portals visitor menu"
  },
  {
    id: "orders",
    tab: "04 — Manage orders",
    title: "Receive and manage orders",
    description: "Orders arrive in your Host Dashboard, where your team can manage order statuses and prepare orders for collection.",
    image: "/welcome-orders.webp",
    alt: "Restaurant counter with a tablet showing the Virgo Portals Orders interface and a receipt printer"
  }
];
function WelcomeChapter() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  return /* @__PURE__ */ jsx(
    ChapterShell,
    {
      id: "chapter-welcome",
      chapterNumber: 1,
      kicker: "Welcome",
      title: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Your restaurant. ",
        /* @__PURE__ */ jsx("span", { className: "text-olive-700", children: "One connected digital platform." })
      ] }),
      children: /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
        /* @__PURE__ */ jsx("p", { className: "max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg", children: "Manage your restaurant, publish your digital menu, welcome guests and receive orders — all through Virgo Portals." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-10", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl", children: "How your restaurant works with Virgo Portals" }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base", children: "Four connected steps take your restaurant from setup to incoming orders." }),
          /* @__PURE__ */ jsx(
            "div",
            {
              role: "tablist",
              "aria-label": "Workflow steps",
              className: "mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4",
              children: TABS.map((t, i) => {
                const selected = i === active;
                return /* @__PURE__ */ jsxs(
                  "button",
                  {
                    role: "tab",
                    "aria-selected": selected,
                    onClick: () => setActive(i),
                    className: `w-full rounded-2xl px-3 py-3 text-left text-sm font-semibold leading-snug ring-1 transition-all duration-300 sm:px-4 ${selected ? "bg-olive-700 text-white shadow-lift ring-olive-700" : "bg-white text-ink-soft ring-cream-200 hover:bg-olive-50 hover:text-ink"}`,
                    children: [
                      /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `block text-[11px] font-medium uppercase tracking-wider ${selected ? "text-olive-100" : "text-olive-600"}`,
                          children: t.tab
                        }
                      ),
                      /* @__PURE__ */ jsx("span", { className: "mt-0.5 block", children: t.title })
                    ]
                  },
                  t.id
                );
              })
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "mt-5 overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-cream-200/80", children: /* @__PURE__ */ jsx(AnimatePresence, { mode: "wait", initial: false, children: /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 14 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -10 },
              transition: { duration: 0.35, ease: EASE },
              className: "grid gap-0 md:grid-cols-5",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-center gap-3 p-6 sm:p-8 md:col-span-2", children: [
                  /* @__PURE__ */ jsx("h4", { className: "font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl", children: tab.title }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed text-ink-soft sm:text-base", children: tab.description })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "relative min-h-[220px] md:col-span-3 md:min-h-[320px]", children: /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: tab.image,
                    alt: tab.alt,
                    loading: "lazy",
                    className: "absolute inset-0 h-full w-full object-cover"
                  }
                ) })
              ]
            },
            tab.id
          ) }) })
        ] })
      ] })
    }
  );
}
const STEPS = [
  { icon: KeyRound, title: "Create your Host account", text: 'Sign up with your email and a password — the "Become a Host" button on the login page starts it.' },
  { icon: Mail, title: "Confirm your email", text: "A verification email makes sure the account is yours before anything goes live." },
  { icon: Building2, title: "Your restaurant is created", text: "Registration sets up your restaurant environment on the platform in the same step." },
  { icon: LayoutDashboard, title: "Sign in to your Host Dashboard", text: "Your dashboard is the control room for menus, departments, orders and settings." }
];
function HostChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-host",
      chapterNumber: 2,
      kicker: "Become a Host",
      title: "From sign-up to a running restaurant in four steps.",
      flip: true,
      children: [
        /* @__PURE__ */ jsx(ChapterText, { children: /* @__PURE__ */ jsx("ol", { className: "mt-2 space-y-4", children: STEPS.map(({ icon: Icon, title, text }, index) => /* @__PURE__ */ jsxs(
          motion.li,
          {
            initial: reduce ? false : { opacity: 0, x: -24 },
            whileInView: { opacity: 1, x: 0 },
            viewport: { once: true, margin: "-40px" },
            transition: { delay: index * 0.12, duration: 0.55, ease: EASE },
            className: "flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80",
            children: [
              /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("p", { className: "text-sm font-semibold text-ink", children: [
                  /* @__PURE__ */ jsxs("span", { className: "mr-2 text-olive-600", children: [
                    index + 1,
                    "."
                  ] }),
                  title
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-relaxed text-ink-muted", children: text })
              ] })
            ]
          },
          title
        )) }) }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[420px] items-center justify-center sm:h-[480px]", children: [
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: -40, rotate: -4 },
              whileInView: { opacity: 1, y: 0, rotate: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.7, ease: EASE },
              className: "absolute top-6 w-56 rounded-2xl bg-white p-5 shadow-lift ring-1 ring-cream-200",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Mail, { className: "h-4 w-4" }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-1.5", children: [
                    /* @__PURE__ */ jsx("div", { className: "h-2 w-full rounded bg-cream-200" }),
                    /* @__PURE__ */ jsx("div", { className: "h-2 w-2/3 rounded bg-cream-100" })
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  motion.div,
                  {
                    initial: reduce ? false : { scale: 0 },
                    whileInView: { scale: 1 },
                    viewport: { once: true },
                    transition: { delay: 0.9, duration: 0.4, ease: EASE },
                    className: "absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-success-500 text-white shadow-lift",
                    children: /* @__PURE__ */ jsx(CheckCircle2, { className: "h-4 w-4" })
                  }
                )
              ]
            }
          ),
          [
            { w: "w-40", b: "bottom-24", d: 0.4 },
            { w: "w-32", b: "bottom-36", d: 0.6 },
            { w: "w-24", b: "bottom-48", d: 0.8 }
          ].map(({ w, b, d }, i) => /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 60, scale: 0.8 },
              whileInView: { opacity: 1, y: 0, scale: 1 },
              viewport: { once: true },
              transition: { delay: d, duration: 0.6, ease: EASE },
              className: `absolute ${b} ${w} rounded-xl bg-olive-${(i + 3) * 100} shadow-soft`,
              style: { height: 28, backgroundColor: ["#ACB99E", "#87976F", "#657554"][i] }
            },
            d
          )),
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, scaleY: 0 },
              whileInView: { opacity: 1, scaleY: 1 },
              viewport: { once: true },
              transition: { delay: 1, duration: 0.4, ease: EASE },
              className: "absolute bottom-24 left-1/2 h-9 w-8 origin-bottom -translate-x-1/2 rounded-t-lg bg-ink/70"
            }
          ),
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, scaleX: 0 },
              whileInView: { opacity: 1, scaleX: 1 },
              viewport: { once: true },
              transition: { delay: 1.15, duration: 0.5, ease: EASE },
              className: "absolute bottom-[132px] left-1/2 flex h-4 w-36 -translate-x-1/2 origin-left justify-between rounded-t-full bg-warning-300 px-2",
              children: [0, 1, 2, 3, 4].map((i) => /* @__PURE__ */ jsx("div", { className: "h-full w-1.5 bg-white/70" }, i))
            }
          ),
          /* @__PURE__ */ jsx(
            motion.svg,
            {
              viewBox: "0 0 100 100",
              preserveAspectRatio: "none",
              className: "pointer-events-none absolute inset-0 h-full w-full",
              children: /* @__PURE__ */ jsx(
                motion.path,
                {
                  d: "M50 30 C 50 45, 50 55, 50 66",
                  stroke: "#657554",
                  strokeWidth: "0.7",
                  fill: "none",
                  strokeDasharray: "2 2",
                  initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
                  whileInView: { pathLength: 1 },
                  viewport: { once: true },
                  transition: { delay: 1.2, duration: 0.8, ease: EASE }
                }
              )
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "absolute bottom-2 w-full text-center text-xs font-medium text-ink-muted", children: "Your account and your restaurant — created together." })
        ] })
      ]
    }
  );
}
function MiniRestaurant({ hue, name, delay }) {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      initial: reduce ? false : { opacity: 0, y: 50, scale: 0.85 },
      whileInView: { opacity: 1, y: 0, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.7, ease: EASE },
      className: "flex flex-col items-center gap-2",
      children: /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-16 w-16 flex-col items-center justify-center rounded-xl", style: { backgroundColor: hue }, children: /* @__PURE__ */ jsx(Building2, { className: "h-6 w-6 text-white" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-center text-xs font-semibold text-ink", children: name }),
        /* @__PURE__ */ jsx("div", { className: "mt-1 flex justify-center gap-1", children: [0, 1, 2].map((i) => /* @__PURE__ */ jsx("div", { className: "h-1.5 w-3 rounded-full bg-cream-200" }, i)) })
      ] })
    }
  );
}
function EnvironmentChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-environment",
      chapterNumber: 3,
      kicker: "Your Restaurant Environment",
      title: "Every restaurant gets its own sealed environment.",
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("p", { children: "When you become a Host, Virgo Portals creates a restaurant environment that belongs entirely to you — with your restaurant's name, city and currency, your welcome message, and how you charge for table or room service." }),
          /* @__PURE__ */ jsx("p", { children: "Your environment is yours alone. Menus, orders and settings from other restaurants on the platform never mix with yours — the platform is built so every Host only ever sees their own restaurant." }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-ink-muted", children: "One Host, one restaurant: the platform enforces that link, so your digital presence is always exactly your business." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[420px] flex-col items-center justify-center sm:h-[480px]", children: [
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 60, scaleY: 0.4 },
              whileInView: { opacity: 1, y: 0, scaleY: 1 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.8, ease: EASE },
              className: "absolute bottom-6 h-24 w-full max-w-[272px] rounded-[2rem] bg-white shadow-lift ring-1 ring-cream-200 sm:w-96"
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "absolute bottom-10 text-xs font-medium uppercase tracking-widest text-ink-faint", children: "Shared platform infrastructure" }),
          /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex items-end gap-6 sm:gap-10", children: [
            /* @__PURE__ */ jsx(MiniRestaurant, { hue: "#ACB99E", name: "Trattoria", delay: 0.4 }),
            /* @__PURE__ */ jsx(MiniRestaurant, { hue: "#657554", name: "Bistro Nord", delay: 0.6 }),
            /* @__PURE__ */ jsx(MiniRestaurant, { hue: "#DDA53C", name: "Café Lumen", delay: 0.8 })
          ] }),
          [16, 50, 84].map((left, i) => /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, scale: 0.9 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true },
              transition: { delay: 1 + i * 0.15, duration: 0.5, ease: EASE },
              style: { left: `${left}%` },
              className: "absolute top-[26%] h-32 w-24 -translate-x-1/2 rounded-3xl border-2 border-dashed border-olive-300"
            },
            left
          )),
          /* @__PURE__ */ jsx(Floating, { delay: 1.2, className: "absolute right-[4%] top-[4%]", children: /* @__PURE__ */ jsxs("div", { className: "w-44 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-cream-200", children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-ink", children: "Your environment" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-2 space-y-1.5", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] text-ink-muted", children: "Name" }),
                /* @__PURE__ */ jsx("div", { className: "h-1.5 w-14 rounded bg-olive-200" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] text-ink-muted", children: "City" }),
                /* @__PURE__ */ jsx("div", { className: "h-1.5 w-10 rounded bg-cream-200" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] text-ink-muted", children: "Currency" }),
                /* @__PURE__ */ jsx("div", { className: "h-1.5 w-8 rounded bg-warning-200" })
              ] })
            ] })
          ] }) })
        ] })
      ]
    }
  );
}
const SKIN = "#4E5B41";
const SKIN_DARK = "#3F4F3A";
const FACE = "#F6F1EA";
const INK = "#1C1917";
const BOW = "#FCFAF7";
const CHEEK = "#E39B95";
function Mascot({ pose = "idle", say, className, bubbleSide = "right" }) {
  const reduceMotion = useReducedMotion();
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    function loop() {
      const delay = 2200 + Math.random() * 2600;
      window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          loop();
        }, 140);
      }, delay);
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);
  const waving = pose === "waving" || pose === "celebrating";
  const armUp = waving || pose === "pointing" || pose === "presenting";
  const entering = pose === "enter";
  const celebrate = pose === "celebrating";
  const bob = { duration: 2.4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" };
  const bodyVariants = {
    hidden: { opacity: 0, x: reduceMotion ? 0 : -70, y: reduceMotion ? 0 : 6, rotate: reduceMotion ? 0 : -5 },
    visible: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }
  };
  return /* @__PURE__ */ jsxs("div", { className: `relative inline-flex items-start gap-3 ${className ?? ""}`, children: [
    say && bubbleSide === "left" ? /* @__PURE__ */ jsx(SpeechBubble, { text: say }) : null,
    /* @__PURE__ */ jsxs(
      motion.div,
      {
        variants: bodyVariants,
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, margin: "-40px" },
        animate: reduceMotion ? void 0 : { y: [0, -6, 0] },
        transition: bob,
        className: "relative",
        children: [
          /* @__PURE__ */ jsxs("svg", { width: "150", height: "170", viewBox: "0 0 150 170", fill: "none", "aria-hidden": "true", children: [
            /* @__PURE__ */ jsx("ellipse", { cx: "75", cy: "152", rx: "46", ry: "9", fill: SKIN, opacity: "0.12" }),
            /* @__PURE__ */ jsx(
              "path",
              {
                d: "M75 34c22 0 36 17 38 40l6 52c1 9-5 16-14 16H45c-9 0-15-7-14-16l6-52c2-23 16-40 38-40Z",
                fill: SKIN
              }
            ),
            /* @__PURE__ */ jsx(
              "path",
              {
                d: "M75 34c22 0 36 17 38 40l6 52c1 9-5 16-14 16h-8c9 0 15-7 14-16l-6-52c-2-23-16-40-38-40h8Z",
                fill: SKIN_DARK,
                opacity: "0.55"
              }
            ),
            /* @__PURE__ */ jsx("ellipse", { cx: "75", cy: "92", rx: "34", ry: "36", fill: FACE }),
            blink || reduceMotion === true ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("rect", { x: "56", y: "82", width: "10", height: "2.6", rx: "1.3", fill: INK }),
              /* @__PURE__ */ jsx("rect", { x: "84", y: "82", width: "10", height: "2.6", rx: "1.3", fill: INK })
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("circle", { cx: "61", cy: "84", r: "5", fill: INK }),
              /* @__PURE__ */ jsx("circle", { cx: "89", cy: "84", r: "5", fill: INK }),
              /* @__PURE__ */ jsx("circle", { cx: "63", cy: "82", r: "1.6", fill: "#FFFFFF" }),
              /* @__PURE__ */ jsx("circle", { cx: "91", cy: "82", r: "1.6", fill: "#FFFFFF" })
            ] }),
            /* @__PURE__ */ jsx("ellipse", { cx: "53", cy: "98", rx: "5", ry: "3", fill: CHEEK, opacity: "0.55" }),
            /* @__PURE__ */ jsx("ellipse", { cx: "97", cy: "98", rx: "5", ry: "3", fill: CHEEK, opacity: "0.55" }),
            celebrate ? /* @__PURE__ */ jsx("path", { d: "M66 102q9 10 18 0", stroke: INK, strokeWidth: "3", strokeLinecap: "round", fill: "none" }) : pose === "pointing" ? /* @__PURE__ */ jsx("circle", { cx: "80", cy: "104", r: "3", fill: INK }) : /* @__PURE__ */ jsx("path", { d: "M67 101q8 7 16 0", stroke: INK, strokeWidth: "3", strokeLinecap: "round", fill: "none" }),
            /* @__PURE__ */ jsx("path", { d: "M66 118l-8-5v10l8-5Zm18 0 8-5v10l-8-5Z", fill: BOW }),
            /* @__PURE__ */ jsx("circle", { cx: "75", cy: "118", r: "3", fill: FACE }),
            /* @__PURE__ */ jsx("circle", { cx: "75", cy: "28", r: "7", stroke: SKIN_DARK, strokeWidth: "4", fill: "none" })
          ] }),
          !(waving || celebrate) && /* @__PURE__ */ jsx(
            motion.svg,
            {
              width: "34",
              height: "60",
              viewBox: "0 0 34 60",
              className: "absolute -left-6 top-[74px]",
              animate: reduceMotion ? void 0 : { rotate: [-4, 4, -4] },
              transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              "aria-hidden": "true",
              children: /* @__PURE__ */ jsx("path", { d: "M30 6C14 14 6 30 8 52", stroke: SKIN, strokeWidth: "11", strokeLinecap: "round", fill: "none" })
            }
          ),
          armUp && /* @__PURE__ */ jsxs(
            motion.svg,
            {
              width: "52",
              height: "86",
              viewBox: "0 0 52 86",
              className: "absolute -right-7 top-[52px]",
              initial: reduceMotion ? false : { rotate: -14, originX: "8px", originY: "80px" },
              animate: {
                rotate: waving ? [0, 22, -8, 22, -4] : pose === "pointing" ? [10, 4, 10] : pose === "presenting" ? [8, 2, 8] : [0, 16, 0, 16]
              },
              transition: waving ? { duration: 0.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" } : { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
              style: { originX: "8px", originY: "80px" },
              "aria-hidden": "true",
              children: [
                /* @__PURE__ */ jsx("path", { d: "M8 80C10 54 22 34 44 20", stroke: SKIN, strokeWidth: "11", strokeLinecap: "round", fill: "none" }),
                /* @__PURE__ */ jsx("circle", { cx: "45", cy: "17", r: "7", fill: SKIN })
              ]
            },
            `arm-${pose}`
          ),
          celebrate && /* @__PURE__ */ jsxs(
            motion.svg,
            {
              width: "34",
              height: "60",
              viewBox: "0 0 34 60",
              className: "absolute -left-6 top-[74px]",
              initial: reduceMotion ? false : { rotate: 0, originX: "26px", originY: "54px" },
              animate: { rotate: reduceMotion ? 0 : [-16, -30, -16] },
              transition: { duration: 0.7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              style: { originX: "26px", originY: "54px" },
              "aria-hidden": "true",
              children: [
                /* @__PURE__ */ jsx("path", { d: "M4 54C20 46 28 30 26 8", stroke: SKIN, strokeWidth: "11", strokeLinecap: "round", fill: "none" }),
                /* @__PURE__ */ jsx("circle", { cx: "26", cy: "8", r: "7", fill: SKIN })
              ]
            }
          ),
          celebrate && !reduceMotion && [
            { x: -34, c: "#DDA53C", d: 0 },
            { x: 34, c: "#87976F", d: 0.25 },
            { x: 0, c: "#D06C63", d: 0.5 }
          ].map(({ x, c, d }) => /* @__PURE__ */ jsx(
            motion.span,
            {
              className: "absolute top-2 h-2 w-2 rounded-full",
              style: { left: `calc(50% + ${x}px)`, backgroundColor: c },
              animate: { y: [-4, -34], opacity: [1, 0] },
              transition: { duration: 1.4, repeat: Infinity, delay: d, ease: "easeOut" }
            },
            x
          )),
          entering && !reduceMotion && /* @__PURE__ */ jsx(
            motion.div,
            {
              className: "absolute bottom-1 left-2 h-2 w-10 rounded-full bg-cream-300",
              animate: { opacity: [0.8, 0], x: [-8, -24] },
              transition: { duration: 1.1, repeat: 2, ease: "easeOut" }
            }
          )
        ]
      }
    ),
    say && bubbleSide === "right" ? /* @__PURE__ */ jsx(SpeechBubble, { text: say }) : null
  ] });
}
function SpeechBubble({ text }) {
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      initial: { opacity: 0, scale: 0.9, y: 8 },
      whileInView: { opacity: 1, scale: 1, y: 0 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      className: "relative max-w-[240px] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm font-medium leading-relaxed text-ink shadow-lift ring-1 ring-cream-200",
      children: text
    }
  );
}
const FOOD_CATS = ["Starters", "Mains", "Desserts"];
const DRINK_CATS = ["Beers", "Wines", "Coffee"];
function CategoryChip({ label, delay, tone }) {
  return /* @__PURE__ */ jsx(
    motion.span,
    {
      initial: { opacity: 0, scale: 0.6, y: 14 },
      whileInView: { opacity: 1, scale: 1, y: 0 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.45, ease: EASE },
      className: `rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft ${tone}`,
      children: label
    }
  );
}
function OrganiseChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-organise",
      chapterNumber: 4,
      kicker: "Organise Your Restaurant",
      title: "Departments, events, sections and categories — your restaurant, organised.",
      flip: true,
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: [
            {
              icon: Store,
              title: "Departments",
              text: "Your day-to-day service areas — like the restaurant, the bar or room service — each with their own opening hours and their own QR menu."
            },
            {
              icon: CalendarDays,
              title: "Events",
              text: "Time-limited occasions — a festival, a wedding, a pop-up — with their own menus that run between start and end dates."
            }
          ].map(({ icon: Icon, title, text }) => /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80", children: [
            /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm font-semibold text-ink", children: title }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-relaxed text-ink-muted", children: text })
          ] }, title)) }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Sections split your menu into ",
            /* @__PURE__ */ jsx("strong", { className: "font-semibold text-ink", children: "food" }),
            " and",
            " ",
            /* @__PURE__ */ jsx("strong", { className: "font-semibold text-ink", children: "drinks" }),
            ", and categories sit inside them. Every dish you create is placed in a section and category, and belongs to the department or event it should appear in."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[440px] flex-col items-center justify-center sm:h-[500px]", children: [
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, scale: 0.7 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.6, ease: EASE },
              className: "z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-olive-700 text-cream-50 shadow-lift",
              children: /* @__PURE__ */ jsx(Store, { className: "h-8 w-8" })
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "z-10 mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-soft ring-1 ring-cream-200", children: "Your restaurant" }),
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 300 90", className: "h-20 w-full max-w-md", children: [
            /* @__PURE__ */ jsx(
              motion.path,
              {
                d: "M150 4 C 90 20, 60 45, 45 86",
                stroke: "#657554",
                strokeWidth: "2",
                fill: "none",
                strokeDasharray: "4 4",
                initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
                whileInView: { pathLength: 1 },
                viewport: { once: true },
                transition: { delay: 0.4, duration: 0.8, ease: EASE }
              }
            ),
            /* @__PURE__ */ jsx(
              motion.path,
              {
                d: "M150 4 C 210 20, 240 45, 255 86",
                stroke: "#DDA53C",
                strokeWidth: "2",
                fill: "none",
                strokeDasharray: "4 4",
                initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
                whileInView: { pathLength: 1 },
                viewport: { once: true },
                transition: { delay: 0.55, duration: 0.8, ease: EASE }
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid w-full max-w-md grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxs(
              motion.div,
              {
                initial: reduce ? false : { opacity: 0, y: 30 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true },
                transition: { delay: 0.7, duration: 0.6, ease: EASE },
                className: "rounded-2xl bg-white p-4 shadow-soft ring-1 ring-olive-200",
                children: [
                  /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-olive-700", children: [
                    /* @__PURE__ */ jsx(Store, { className: "h-3.5 w-3.5" }),
                    " Departments"
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-1.5", children: ["Restaurant", "Bar", "Room service"].map((d, i) => /* @__PURE__ */ jsx(
                    motion.div,
                    {
                      initial: { opacity: 0, x: -12 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true },
                      transition: { delay: 0.9 + i * 0.12, duration: 0.4, ease: EASE },
                      className: "rounded-lg bg-olive-50 px-2.5 py-1.5 text-xs font-medium text-olive-800",
                      children: d
                    },
                    d
                  )) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              motion.div,
              {
                initial: reduce ? false : { opacity: 0, y: 30 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true },
                transition: { delay: 0.8, duration: 0.6, ease: EASE },
                className: "rounded-2xl bg-white p-4 shadow-soft ring-1 ring-warning-200",
                children: [
                  /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warning-600", children: [
                    /* @__PURE__ */ jsx(CalendarDays, { className: "h-3.5 w-3.5" }),
                    " Events"
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-1.5", children: ["Wine festival", "Summer pop-up"].map((e, i) => /* @__PURE__ */ jsx(
                    motion.div,
                    {
                      initial: { opacity: 0, x: -12 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true },
                      transition: { delay: 1 + i * 0.12, duration: 0.4, ease: EASE },
                      className: "rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs font-medium text-warning-700",
                      children: e
                    },
                    e
                  )) })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex w-full max-w-md flex-col items-center gap-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsx(CategoryChip, { label: "Food", delay: 1.2, tone: "bg-olive-600 text-white" }),
              /* @__PURE__ */ jsx(CategoryChip, { label: "Drinks", delay: 1.3, tone: "bg-ink text-cream-50" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap justify-center gap-1.5", children: [
              FOOD_CATS.map((c, i) => /* @__PURE__ */ jsx(CategoryChip, { label: c, delay: 1.4 + i * 0.1, tone: "bg-olive-100 text-olive-800" }, c)),
              DRINK_CATS.map((c, i) => /* @__PURE__ */ jsx(CategoryChip, { label: c, delay: 1.7 + i * 0.1, tone: "bg-cream-200 text-ink-soft" }, c))
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 right-0 hidden scale-75 sm:block", children: /* @__PURE__ */ jsx(Mascot, { pose: "pointing", say: "Everything in its right place." }) })
        ] })
      ]
    }
  );
}
function DishMiniCard({
  name,
  price,
  tag,
  tone,
  delay
}) {
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 40, rotate: -4 },
      whileInView: { opacity: 1, y: 0, rotate: 0 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.6, ease: EASE },
      className: "w-36 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200",
      children: [
        /* @__PURE__ */ jsx("div", { className: `h-14 rounded-xl ${tone}` }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs font-semibold text-ink", children: name }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("span", { className: "rounded-full bg-olive-50 px-2 py-0.5 text-[10px] font-medium text-olive-700", children: tag }),
          /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-ink", children: price })
        ] })
      ]
    }
  );
}
function MenuChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-menu",
      chapterNumber: 5,
      kicker: "Build Your Digital Menu",
      title: "Dishes that look as good as they taste.",
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("p", { children: "Build your menu dish by dish: names, descriptions, prices and beautiful images — generated for you from the dish itself if you don't have photography." }),
          /* @__PURE__ */ jsx("div", { className: "grid gap-3", children: [
            { icon: Coins, title: "Measured serving sizes", text: 'Drinks can carry structured sizes like "25 cl", "330 ml" or "12 oz", each with its own price.' },
            { icon: Layers3, title: "Named serving sizes", text: "Or names your guests recognise — Small, Large, Single, Double, Family Size, or anything you like." },
            { icon: EyeOff, title: "Removable ingredients", text: "Guests can ask to leave out ingredients you mark as removable — no special requests needed." },
            { icon: CheckCircle2, title: "Availability", text: "Sold out a dish? One switch takes it off the guest menu until it is back." }
          ].map(({ icon: Icon, title, text }, i) => /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, x: -20 },
              whileInView: { opacity: 1, x: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { delay: i * 0.1, duration: 0.5, ease: EASE },
              className: "flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80",
              children: [
                /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-ink", children: title }),
                  /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-sm leading-relaxed text-ink-muted", children: text })
                ] })
              ]
            },
            title
          )) }),
          /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-sm text-ink-muted", children: [
            /* @__PURE__ */ jsx(Camera, { className: "mt-0.5 h-4 w-4 shrink-0 text-olive-600" }),
            "Every dish card is edited in one place, and your guest menu updates instantly."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[460px] items-center justify-center sm:h-[520px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsx(DishMiniCard, { name: "Tagliatelle", price: "14.50", tag: "25 cl pairing", tone: "bg-warning-200", delay: 0.2 }),
            /* @__PURE__ */ jsx(DishMiniCard, { name: "Ribeye", price: "26.00", tag: "Large / Small", tone: "bg-olive-200", delay: 0.4 }),
            /* @__PURE__ */ jsx(DishMiniCard, { name: "House Red", price: "6.50", tag: "25 cl · 12 oz", tone: "bg-olive-300", delay: 0.6 }),
            /* @__PURE__ */ jsx(DishMiniCard, { name: "Lemonade", price: "4.00", tag: "33 cl", tone: "bg-cream-300", delay: 0.8 })
          ] }),
          /* @__PURE__ */ jsx(Floating, { delay: 1, className: "absolute left-[4%] top-[14%]", children: /* @__PURE__ */ jsx("div", { className: "rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200", children: "Medium rare" }) }),
          /* @__PURE__ */ jsx(Floating, { delay: 1.2, className: "absolute left-[2%] bottom-[24%]", children: /* @__PURE__ */ jsx("div", { className: "rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200", children: "+ Side of fries" }) }),
          /* @__PURE__ */ jsx(Floating, { delay: 1.35, className: "absolute right-[2%] top-[30%]", children: /* @__PURE__ */ jsx("div", { className: "rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200", children: "No onions" }) })
        ] })
      ]
    }
  );
}
function PdfRow({ delay, wide = false }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 px-1 py-1.5", children: [
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: { opacity: 0.25 },
        whileInView: { opacity: [0.25, 1, 0.25] },
        viewport: { once: true },
        transition: { delay, duration: 1.4 },
        className: `h-2 rounded bg-ink/30 ${wide ? "w-24" : "w-16"}`
      }
    ),
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: { opacity: 0.25 },
        whileInView: { opacity: [0.25, 1, 0.25] },
        viewport: { once: true },
        transition: { delay: delay + 0.15, duration: 1.4 },
        className: "h-2 w-8 rounded bg-ink/30"
      }
    )
  ] });
}
function ExtractedDish({ name, price, delay }) {
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0, x: -60, scale: 0.9 },
      whileInView: { opacity: 1, x: 0, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.65, ease: EASE },
      className: "flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-lift ring-1 ring-cream-200",
      children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-ink", children: name }),
          /* @__PURE__ */ jsx("div", { className: "mt-1 h-1.5 w-16 rounded bg-cream-200" })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-olive-700", children: price })
      ]
    }
  );
}
function ExtractionChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-extraction",
      chapterNumber: 6,
      kicker: "AI Menu Extraction",
      title: "Your paper menu, typed into your digital menu. Reviewed by you.",
      flip: true,
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("ol", { className: "space-y-3", children: [
            "Upload your existing PDF menu.",
            'The platform identifies dish names, prices, descriptions and serving sizes — measured like "25 cl" and named like "Large".',
            "Extracted dishes are grouped and placed into your menu, ready to check.",
            "You confirm every dish before it goes live — the AI assists, you stay in control."
          ].map((text, i) => /* @__PURE__ */ jsxs(
            motion.li,
            {
              initial: reduce ? false : { opacity: 0, x: -20 },
              whileInView: { opacity: 1, x: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { delay: i * 0.12, duration: 0.5, ease: EASE },
              className: "flex gap-3 text-sm leading-relaxed text-ink-soft",
              children: [
                /* @__PURE__ */ jsx("span", { className: "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-600 text-[11px] font-bold text-white", children: i + 1 }),
                text
              ]
            },
            text
          )) }),
          /* @__PURE__ */ jsx("div", { className: "rounded-2xl bg-cream-100 p-4 ring-1 ring-cream-200", children: /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed text-ink-soft", children: "Extraction is AI-assisted, not magic: unusual menus, unclear scans or unfamiliar formats can need correcting — that is why every extracted dish goes through your review before it reaches your guests." }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[440px] flex-col items-center justify-center gap-6 px-2 sm:h-[500px] sm:flex-row sm:gap-8 sm:px-0", children: [
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: -50, rotate: -6 },
              whileInView: { opacity: 1, y: 0, rotate: -3 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.7, ease: EASE },
              className: "relative w-40 max-w-[45%] rounded-xl bg-white p-3 shadow-lift ring-1 ring-cream-200 sm:w-48",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-2 w-10 rounded bg-error-300" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[9px] font-bold uppercase tracking-widest text-ink-faint", children: "PDF" })
                ] }),
                /* @__PURE__ */ jsx(PdfRow, { delay: 0.6, wide: true }),
                /* @__PURE__ */ jsx(PdfRow, { delay: 0.9 }),
                /* @__PURE__ */ jsx(PdfRow, { delay: 1.2, wide: true }),
                /* @__PURE__ */ jsx(PdfRow, { delay: 1.5 }),
                /* @__PURE__ */ jsx(
                  motion.div,
                  {
                    className: "absolute inset-x-2 h-0.5 rounded bg-olive-500",
                    animate: reduce ? { top: "90%" } : { top: ["12%", "90%", "12%"] },
                    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  }
                ),
                /* @__PURE__ */ jsx(
                  motion.div,
                  {
                    initial: { scale: 0 },
                    whileInView: { scale: 1 },
                    viewport: { once: true },
                    transition: { delay: 1.8, duration: 0.4, ease: EASE },
                    className: "absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-olive-600 text-white shadow-lift",
                    children: /* @__PURE__ */ jsx(ScanSearch, { className: "h-4 w-4" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "svg",
            {
              viewBox: "0 0 60 100",
              preserveAspectRatio: "none",
              className: "h-12 w-40 -rotate-90 sm:h-80 sm:w-12 sm:rotate-0",
              children: /* @__PURE__ */ jsx(
                motion.path,
                {
                  d: "M8 20 C 26 40, 34 60, 52 80",
                  stroke: "#657554",
                  strokeWidth: "2.5",
                  fill: "none",
                  strokeDasharray: "5 5",
                  initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
                  whileInView: { pathLength: 1 },
                  viewport: { once: true },
                  transition: { delay: 1.6, duration: 1, ease: EASE }
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex w-44 max-w-[45%] flex-col gap-2.5 sm:w-52", children: [
            /* @__PURE__ */ jsx(ExtractedDish, { name: "Tagliatelle", price: "14.50", delay: 1.8 }),
            /* @__PURE__ */ jsx(ExtractedDish, { name: "Ribeye — Large", price: "26.00", delay: 2 }),
            /* @__PURE__ */ jsx(ExtractedDish, { name: "House Red 25cl", price: "6.50", delay: 2.2 }),
            /* @__PURE__ */ jsxs(
              motion.div,
              {
                initial: { opacity: 0, scale: 0.5, rotate: -8 },
                whileInView: { opacity: 1, scale: 1, rotate: -4 },
                viewport: { once: true },
                transition: { delay: 2.6, duration: 0.5, ease: EASE },
                className: "mx-auto mt-1 flex items-center gap-2 rounded-full bg-success-500 px-4 py-2 text-xs font-bold text-white shadow-lift",
                children: [
                  /* @__PURE__ */ jsx(UserCheck, { className: "h-4 w-4" }),
                  "Reviewed by you"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 hidden scale-75 sm:block", children: /* @__PURE__ */ jsx(Mascot, { pose: "presenting", say: "Watch your menu come to life." }) })
        ] })
      ]
    }
  );
}
const JOURNEY = [
  { icon: Languages, text: "Picks their language" },
  { icon: ShoppingBasket, text: "Adds dishes to the basket" },
  { icon: BadgeCheck, text: "Receives the order confirmation" }
];
function CustomerChapter() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-customer",
      chapterNumber: 7,
      kicker: "Your Customer's Experience",
      title: "From a scan on the table to a confirmed order.",
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("p", { children: "Your guests don't download anything. They scan the QR code at their table, and your menu opens in their own language, right in the browser." }),
          /* @__PURE__ */ jsx(
            motion.ol,
            {
              initial: reduce ? false : "hidden",
              whileInView: "visible",
              viewport: { once: true, margin: "-60px" },
              variants: reduce ? void 0 : { visible: { transition: { staggerChildren: 0.12 } } },
              className: "space-y-3",
              children: JOURNEY.map(({ icon: Icon, text }) => /* @__PURE__ */ jsxs(
                motion.li,
                {
                  variants: reduce ? void 0 : { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } },
                  className: "flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-cream-200/80",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
                    /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-ink", children: text })
                  ]
                },
                text
              ))
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-ink-muted", children: "Serving options, variants and add-ons are all chosen on the same screen — the order that reaches you is complete and clear." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[480px] items-center justify-center sm:h-[540px]", children: [
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, scale: 0.6, rotate: 8 },
              whileInView: { opacity: 1, scale: 1, rotate: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.6, ease: EASE },
              className: "absolute left-[6%] top-[10%] flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200",
              children: [
                /* @__PURE__ */ jsx(QrCode, { className: "h-14 w-14 text-ink" }),
                /* @__PURE__ */ jsx("span", { className: "text-[10px] font-medium text-ink-muted", children: "Scan me" })
              ]
            }
          ),
          [0, 1].map((i) => /* @__PURE__ */ jsx(
            motion.span,
            {
              className: "absolute left-[13%] top-[18%] h-28 w-28 rounded-full border-2 border-olive-400",
              animate: reduce ? void 0 : { scale: [1, 1.7], opacity: [0.7, 0] },
              transition: { duration: 1.8, repeat: Infinity, delay: i * 0.9, ease: "easeOut" }
            },
            i
          )),
          /* @__PURE__ */ jsx("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", className: "pointer-events-none absolute inset-0 h-full w-full", children: /* @__PURE__ */ jsx(
            motion.path,
            {
              d: "M22 24 C 34 30, 40 40, 46 52",
              stroke: "#657554",
              strokeWidth: "0.8",
              fill: "none",
              strokeDasharray: "2 2",
              initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
              whileInView: { pathLength: 1 },
              viewport: { once: true },
              transition: { delay: 0.6, duration: 0.8, ease: EASE }
            }
          ) }),
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 70, rotate: 6 },
              whileInView: { opacity: 1, y: 0, rotate: 0 },
              viewport: { once: true },
              transition: { delay: 0.5, duration: 0.9, ease: EASE },
              className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              children: /* @__PURE__ */ jsx(PhoneMock, { children: /* @__PURE__ */ jsx(MenuLines, {}) })
            }
          ),
          [
            { label: "Pasta", tone: "bg-warning-200", pos: "right-[10%] top-[8%]", d: 1 },
            { label: "Steak", tone: "bg-olive-200", pos: "right-[4%] top-[38%]", d: 1.2 },
            { label: "Salad", tone: "bg-olive-100", pos: "right-[14%] top-[66%]", d: 1.4 }
          ].map(({ label, tone, pos, d }) => /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, x: 70, y: 20 },
              whileInView: { opacity: 1, x: 0, y: 0 },
              viewport: { once: true },
              transition: { delay: d, duration: 0.7, ease: EASE },
              className: `absolute ${pos}`,
              children: /* @__PURE__ */ jsxs("div", { className: "w-24 rounded-xl bg-white p-2 shadow-lift ring-1 ring-cream-200", children: [
                /* @__PURE__ */ jsx("div", { className: `h-12 rounded-lg ${tone}` }),
                /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-semibold text-ink", children: label })
              ] })
            },
            label
          )),
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 50, scale: 0.7 },
              whileInView: { opacity: 1, y: 0, scale: 1 },
              viewport: { once: true },
              transition: { delay: 1.7, duration: 0.6, ease: EASE },
              className: "absolute bottom-[6%] left-[16%] flex items-center gap-2 rounded-2xl bg-olive-700 px-4 py-3 text-white shadow-lift",
              children: [
                /* @__PURE__ */ jsx(ShoppingBasket, { className: "h-4 w-4" }),
                /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold", children: "Basket · 3 items" })
              ]
            }
          )
        ] })
      ]
    }
  );
}
function ChatBubble({
  from = "assistant",
  children,
  delay
}) {
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      initial: { opacity: 0, y: 14, scale: 0.92 },
      whileInView: { opacity: 1, y: 0, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.5, ease: EASE },
      className: `max-w-[75%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow-soft ${from === "assistant" ? "self-start rounded-bl-sm bg-white text-ink ring-1 ring-cream-200" : "self-end rounded-br-sm bg-olive-700 text-white"}`,
      children
    }
  );
}
function FoodChip({ label, tone, delay }) {
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0, scale: 0.6 },
      whileInView: { opacity: 1, scale: 1 },
      viewport: { once: true },
      transition: { delay, duration: 0.45, ease: EASE },
      className: "flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-soft ring-1 ring-cream-200",
      children: [
        /* @__PURE__ */ jsx("span", { className: `h-8 w-8 rounded-lg ${tone}` }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold text-ink", children: label }),
          /* @__PURE__ */ jsx("div", { className: "mt-0.5 h-1 w-10 rounded bg-cream-200" })
        ] })
      ]
    }
  );
}
function ChatChapter() {
  const reduceMotion = useReducedMotion();
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-chat",
      chapterNumber: 8,
      kicker: "AI-Powered Visitor Chat",
      title: "A helpful assistant, sat at every table.",
      flip: true,
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("p", { children: "Alongside your menu, every guest has access to an AI assistant that knows your restaurant's menu and helps them make choices." }),
          /* @__PURE__ */ jsx("div", { className: "space-y-3", children: [
            "Guests ask questions about dishes and the menu in their own words.",
            "It helps with discovery — finding dishes that match what they feel like.",
            "Suggestions respond to the guest's basket, so recommendations fit what they have already chosen.",
            "The assistant only works from your actual menu — guests can't order things you don't serve."
          ].map((text, i) => /* @__PURE__ */ jsxs(
            motion.p,
            {
              initial: { opacity: 0, x: -18 },
              whileInView: { opacity: 1, x: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { delay: i * 0.1, duration: 0.5, ease: EASE },
              className: "flex items-start gap-2 text-sm leading-relaxed text-ink-soft",
              children: [
                /* @__PURE__ */ jsx("span", { className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" }),
                text
              ]
            },
            text
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[480px] items-center justify-center sm:h-[540px]", children: [
          /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: { opacity: 0, y: 60 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { duration: 0.8, ease: EASE },
              children: /* @__PURE__ */ jsx(PhoneMock, { children: /* @__PURE__ */ jsxs("div", { className: "flex h-full flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx(ChatBubble, { from: "guest", delay: 0.7, children: "Something light with herbs?" }),
                /* @__PURE__ */ jsx(ChatBubble, { delay: 1.2, children: "Our grilled sea bass with lemon thyme is a favourite." }),
                /* @__PURE__ */ jsx(ChatBubble, { from: "guest", delay: 1.7, children: "And to drink?" }),
                /* @__PURE__ */ jsx(ChatBubble, { delay: 2.2, children: "A crisp 25 cl house white pairs beautifully." })
              ] }) })
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "absolute right-[4%] top-[16%] flex flex-col gap-3", children: [
            /* @__PURE__ */ jsx(FoodChip, { label: "Sea bass", tone: "bg-olive-200", delay: 2.6 }),
            /* @__PURE__ */ jsx(FoodChip, { label: "House white 25cl", tone: "bg-warning-200", delay: 2.8 })
          ] }),
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", className: "pointer-events-none absolute inset-0 h-full w-full", children: [
            /* @__PURE__ */ jsx(
              motion.path,
              {
                d: "M58 40 C 72 32, 78 28, 86 24",
                stroke: "#657554",
                strokeWidth: "0.8",
                fill: "none",
                strokeDasharray: "2 2",
                initial: reduceMotion ? { pathLength: 1 } : { pathLength: 0 },
                whileInView: { pathLength: 1 },
                viewport: { once: true },
                transition: { delay: 2.4, duration: 0.7, ease: EASE }
              }
            ),
            /* @__PURE__ */ jsx(
              motion.path,
              {
                d: "M58 52 C 72 58, 78 62, 86 66",
                stroke: "#DDA53C",
                strokeWidth: "0.8",
                fill: "none",
                strokeDasharray: "2 2",
                initial: reduceMotion ? { pathLength: 1 } : { pathLength: 0 },
                whileInView: { pathLength: 1 },
                viewport: { once: true },
                transition: { delay: 2.6, duration: 0.7, ease: EASE }
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 hidden scale-75 sm:block", children: /* @__PURE__ */ jsx(Mascot, { pose: "pointing", say: "Ask it anything about the menu." }) })
        ] })
      ]
    }
  );
}
function OrderTraveller() {
  const reduce = useReducedMotion();
  return /* @__PURE__ */ jsxs("div", { className: "relative h-24 w-full max-w-md", children: [
    /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 400 100", className: "h-full w-full", children: [
      /* @__PURE__ */ jsx(
        motion.path,
        {
          d: "M30 80 C 140 0, 260 0, 370 80",
          stroke: "#657554",
          strokeWidth: "2.5",
          fill: "none",
          strokeDasharray: "6 5",
          initial: reduce ? { pathLength: 1 } : { pathLength: 0 },
          whileInView: { pathLength: 1 },
          viewport: { once: true },
          transition: { duration: 1.2, ease: EASE }
        }
      ),
      !reduce && /* @__PURE__ */ jsx(
        motion.circle,
        {
          r: "7",
          fill: "#4E5B41",
          stroke: "#F6F1EA",
          strokeWidth: "2.5",
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true },
          transition: { delay: 1.2 },
          children: /* @__PURE__ */ jsx("animateMotion", { dur: "2.4s", repeatCount: "indefinite", path: "M30 80 C 140 0, 260 0, 370 80" })
        }
      )
    ] }),
    /* @__PURE__ */ jsx(Smartphone, { className: "absolute -left-1 bottom-0 h-6 w-6 text-ink-soft" }),
    /* @__PURE__ */ jsx(ChefHat, { className: "absolute -right-1 bottom-0 h-6 w-6 text-olive-700" })
  ] });
}
function StatusPill({ label, tone, delay }) {
  return /* @__PURE__ */ jsx(
    motion.span,
    {
      initial: { opacity: 0, scale: 0.6 },
      whileInView: { opacity: 1, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { delay, duration: 0.45, ease: EASE },
      className: `rounded-full px-3.5 py-1.5 text-xs font-bold shadow-soft ${tone}`,
      children: label
    }
  );
}
function OperationsChapter() {
  const [ref, progress] = useSectionProgress();
  const reduce = useReducedMotion();
  const creditFill = useTransform(progress, [0.3, 0.8], reduce ? ["70%", "70%"] : ["0%", "70%"]);
  return /* @__PURE__ */ jsxs(
    ChapterShell,
    {
      id: "chapter-operations",
      chapterNumber: 9,
      kicker: "Orders & One Connected Platform",
      title: "Orders land with your staff. The platform keeps it all running.",
      children: [
        /* @__PURE__ */ jsxs(ChapterText, { children: [
          /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: [
            { icon: BellRing, title: "Live orders", text: "Orders arrive in your dashboard in real time, with a clear flow from new to accepted to completed — and your staff see them the moment guests confirm." },
            { icon: BarChart3, title: "Sessions & reports", text: "Service sessions per department can be closed with a full report — and printed receipts are available for restaurants that run a printer (optional; most don't need one)." },
            { icon: Printer, title: "Payment, the simple way", text: "Guests choose to pay your staff directly at the table or counter — no payment hardware required to get started." },
            { icon: ShieldCheck, title: "One shared platform", text: "Every restaurant runs on the same dependable infrastructure — while every Host's data stays fully separate." }
          ].map(({ icon: Icon, title, text }, i) => /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: reduce ? false : { opacity: 0, y: 26 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { delay: i * 0.1, duration: 0.55, ease: EASE },
              className: "rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80",
              children: [
                /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm font-semibold text-ink", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-relaxed text-ink-muted", children: text })
              ]
            },
            title
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 rounded-2xl bg-cream-100 p-4 ring-1 ring-cream-200", children: [
            /* @__PURE__ */ jsx(Coins, { className: "mt-0.5 h-4 w-4 shrink-0 text-olive-600" }),
            /* @__PURE__ */ jsxs("p", { className: "text-sm leading-relaxed text-ink-soft", children: [
              /* @__PURE__ */ jsx(Sparkles, { className: "mr-1 inline h-3.5 w-3.5 text-olive-600" }),
              "AI features run on simple credits: each Host has a credit balance, and AI usage — chat, menu extraction, dish images — is metered transparently against it."
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { ref, className: "relative flex h-[460px] flex-col items-center justify-center gap-8 sm:h-[500px]", children: [
          /* @__PURE__ */ jsx(StatusPill, { label: "Guest confirms", tone: "bg-olive-700 text-white", delay: 0.2 }),
          /* @__PURE__ */ jsx(OrderTraveller, {}),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(StatusPill, { label: "New", tone: "bg-warning-200 text-warning-700", delay: 0.8 }),
            /* @__PURE__ */ jsx(motion.span, { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { delay: 1 }, children: "→" }),
            /* @__PURE__ */ jsx(StatusPill, { label: "Accepted", tone: "bg-olive-200 text-olive-800", delay: 1.1 }),
            /* @__PURE__ */ jsx(motion.span, { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { delay: 1.3 }, children: "→" }),
            /* @__PURE__ */ jsx(StatusPill, { label: "Completed", tone: "bg-success-200 text-success-700", delay: 1.4 })
          ] }),
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: { opacity: 0, y: 24 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: "-40px" },
              transition: { delay: 0.5, duration: 0.6, ease: EASE },
              className: "w-full max-w-xs rounded-2xl bg-white p-4 shadow-lift ring-1 ring-cream-200",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-xs font-semibold text-ink", children: [
                  /* @__PURE__ */ jsx("span", { children: "AI credits" }),
                  /* @__PURE__ */ jsx("span", { children: "7.0 / 10" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "mt-2 h-3 overflow-hidden rounded-full bg-cream-100", children: /* @__PURE__ */ jsx(motion.div, { className: "h-full rounded-full bg-olive-500", style: { width: creditFill } }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] text-ink-muted", children: "Tokens used by chat, extraction and dish images." })
              ]
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            ["#ACB99E", "#657554", "#DDA53C"].map((c, i) => /* @__PURE__ */ jsx(
              motion.span,
              {
                initial: { opacity: 0, scale: 0.6 },
                whileInView: { opacity: 1, scale: 1 },
                viewport: { once: true },
                transition: { delay: 0.8 + i * 0.15, duration: 0.5, ease: EASE },
                className: "h-3 w-3 rounded-full",
                style: { backgroundColor: c }
              },
              c
            )),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-medium text-ink-muted", children: "independent restaurants, one platform" })
          ] })
        ] })
      ]
    }
  );
}
function ClosingChapter({ onBecomeHost, onBackToLogin }) {
  const reduceMotion = useReducedMotion();
  return /* @__PURE__ */ jsxs("section", { className: "relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-24 text-center", children: [
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: reduceMotion ? false : { opacity: 0, scale: 0.9 },
        whileInView: { opacity: 1, scale: 1 },
        viewport: { once: true },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        className: "max-w-full sm:scale-125",
        children: /* @__PURE__ */ jsx(Mascot, { pose: "celebrating", say: "Your table is ready!", bubbleSide: "left" })
      }
    ),
    /* @__PURE__ */ jsxs(
      motion.h2,
      {
        initial: reduceMotion ? false : { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] },
        className: "mt-8 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl",
        children: [
          "Your restaurant. Your menu. ",
          /* @__PURE__ */ jsx("span", { className: "text-olive-700", children: "A connected digital experience." })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      motion.p,
      {
        initial: reduceMotion ? false : { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] },
        className: "mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg",
        children: "You have seen the whole journey — your environment, your menu, your guests and your orders, all in one place. The next table it sets could be your own."
      }
    ),
    /* @__PURE__ */ jsxs(
      motion.div,
      {
        initial: reduceMotion ? false : { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] },
        className: "mt-10 flex flex-col items-center gap-4 sm:flex-row",
        children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onBecomeHost,
              className: "flex items-center gap-2 rounded-full bg-olive-700 px-8 py-4 text-base font-semibold text-white shadow-lift transition hover:bg-olive-800",
              children: [
                "Become a Host",
                /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onBackToLogin,
              className: "flex items-center gap-2 rounded-full px-6 py-4 text-base font-medium text-ink-soft ring-1 ring-cream-300 transition hover:bg-white",
              children: [
                /* @__PURE__ */ jsx(LogIn, { className: "h-4 w-4" }),
                "Back to login"
              ]
            }
          )
        ]
      }
    )
  ] });
}
const PRESENTATION_CHAPTERS = [
  { id: "chapter-welcome", short: "Welcome" },
  { id: "chapter-host", short: "Host account" },
  { id: "chapter-environment", short: "Environment" },
  { id: "chapter-organise", short: "Organisation" },
  { id: "chapter-menu", short: "Menu" },
  { id: "chapter-extraction", short: "AI extraction" },
  { id: "chapter-customer", short: "Customer" },
  { id: "chapter-chat", short: "Visitor chat" },
  { id: "chapter-operations", short: "Orders" },
  { id: "chapter-closing", short: "Start here" }
];
function PresentationPage({ onBack, onBecomeHost }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", setProgress);
    return () => unsubscribe();
  }, [scrollYProgress]);
  const chapterProgress = useMemo(
    () => PRESENTATION_CHAPTERS.map((_, i) => (i + 1) / PRESENTATION_CHAPTERS.length),
    []
  );
  useEffect(() => {
    const active = chapterProgress.findIndex((threshold) => progress <= threshold + 1e-3);
    setActiveIndex(active === -1 ? PRESENTATION_CHAPTERS.length - 1 : active);
  }, [progress, chapterProgress]);
  function scrollToChapter(id) {
    var _a;
    (_a = document.getElementById(id)) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return /* @__PURE__ */ jsxs("div", { className: "bg-cream-100", children: [
    /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-50 flex items-center justify-between bg-cream-100/90 px-5 py-4 backdrop-blur sm:px-8", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onBack,
          className: "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-cream-300 transition hover:bg-white",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back"
          ]
        }
      ),
      /* @__PURE__ */ jsx(Logo, { className: "h-8" }),
      /* @__PURE__ */ jsx("span", { className: "hidden text-sm font-medium text-ink-muted sm:block", children: "How Virgo Portals works" })
    ] }),
    /* @__PURE__ */ jsx(
      ChapterNavigation,
      {
        chapters: PRESENTATION_CHAPTERS,
        activeIndex,
        progress,
        onSelect: scrollToChapter
      }
    ),
    /* @__PURE__ */ jsxs("main", { ref: containerRef, className: "relative", children: [
      /* @__PURE__ */ jsx(WelcomeChapter, {}),
      /* @__PURE__ */ jsx(HostChapter, {}),
      /* @__PURE__ */ jsx(EnvironmentChapter, {}),
      /* @__PURE__ */ jsx(OrganiseChapter, {}),
      /* @__PURE__ */ jsx(MenuChapter, {}),
      /* @__PURE__ */ jsx(ExtractionChapter, {}),
      /* @__PURE__ */ jsx(CustomerChapter, {}),
      /* @__PURE__ */ jsx(ChatChapter, {}),
      /* @__PURE__ */ jsx(OperationsChapter, {}),
      /* @__PURE__ */ jsx(ClosingChapter, { onBecomeHost, onBackToLogin: onBack })
    ] })
  ] });
}
const html = renderToString(React.createElement(PresentationPage, { onBack: () => {
}, onBecomeHost: () => {
} }));
const checks = {
  "no overflow-x-hidden suppression": !html.includes("overflow-x-hidden"),
  "no nowrap": !html.includes("whitespace-nowrap"),
  "no unscoped min-w-max scroll row": !html.includes("min-w-max"),
  "no fixed w-72/w-96 without sm prefix": !/class="[^"]*\bw-(72|96)\b[^"]*"/.test(html)
};
for (const [k, v] of Object.entries(checks)) console.log(v ? "PASS" : "FAIL", "-", k);
