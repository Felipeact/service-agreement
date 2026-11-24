import type { ReactNode } from "react";
import Link from "next/link";
import { ProductMark } from "@/components/ui/product-mark";
import { HOSTING_SHORT } from "@/components/site/content";
import { AmbientCanvas } from "@/components/motion/ambient-canvas";
import * as motion from "motion/react-client";
import { REVEAL, STAGGER, VIEWPORT } from "@/components/motion/variants";

/** Generated from docs/service_pacts_sign_in_animated_split_1/code.html by the mockup converter, then edited by hand where the page needs data or behaviour. */
export function Content({ form }: { form: ReactNode }) {
  return (
    <div className="mk-s1 h-full bg-slate-900 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
<svg aria-hidden="true" className="inline-defs-container" style={{ position: "absolute", width: "0", height: "0", overflow: "hidden" }}></svg>

























<svg aria-hidden="true" className="inline-defs-container" style={{ position: "absolute", width: "0", height: "0", overflow: "hidden" }}></svg>



























<motion.div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2" data-purpose="auth-split-container" initial="hidden" whileInView="show" viewport={VIEWPORT} variants={STAGGER}><motion.section className="relative w-full bg-[#070b14] text-white flex flex-col justify-between p-7 sm:p-10 lg:p-14 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/80" data-purpose="brand-sidebar" id="brand-panel" initial="hidden" animate="show" variants={REVEAL}><AmbientCanvas panelId="brand-panel" className="absolute inset-0 w-full h-full pointer-events-none opacity-65 z-0" /><div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/20 blur-[110px] animate-pulse-glow z-0"></div><div className="pointer-events-none absolute top-1/2 -right-24 w-96 h-96 rounded-full bg-cyan-500/15 blur-[120px] animate-pulse-glow z-0" style={{ animationDelay: "-2.5s" }}></div><div className="pointer-events-none absolute -bottom-20 left-1/3 w-80 h-80 rounded-full bg-indigo-600/20 blur-[100px] z-0"></div><header className="relative z-10 flex items-center justify-between"><Link href="/" aria-label="Service Pacts, home" className="flex min-h-11 items-center gap-3"><ProductMark className="size-9" /><span className="text-base font-bold tracking-tight text-white">Service Pacts</span></Link></header><div className="relative z-10 my-auto py-10 lg:py-12 flex flex-col items-start max-w-xl mx-auto lg:mx-0 w-full" data-purpose="hero-artwork-area"><div className="space-y-3 mb-10"><h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.12]">{" "}From service list to<br /><span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-cyan-300 to-indigo-300">signed agreement.</span></h1><p className="text-slate-400 text-sm sm:text-base max-w-md font-normal leading-relaxed">{" "}{"Turn the equipment list a customer sends into a priced service agreement, send it for review, and follow it to signature."}{" "}</p></div><div className="relative w-full flex items-center justify-center pt-2 pb-4 select-none" data-purpose="vector-illustration" id="illustration-stage"><div className="absolute -top-3 right-0 sm:right-4 z-20 animate-float bg-slate-900/90 border border-cyan-500/30 rounded-lg p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs text-slate-200"><div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400"><span className="material-symbols-outlined text-[17px]">precision_manufacturing</span></div><div><div className="font-semibold text-white tracking-tight flex items-center gap-1.5">{" "}439 Railway St{" "}<span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-sm">18 RTUs</span></div><div className="text-[11px] text-slate-400 flex items-center gap-1"><span className="material-symbols-outlined text-[13px] text-cyan-400">auto_awesome</span>{" "}Schedule AI Extracted{" "}</div></div></div><div className="absolute bottom-2 -left-2 sm:left-2 z-20 animate-float-delay bg-slate-900/90 border border-blue-500/30 rounded-lg p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs text-slate-200"><div className="w-7 h-7 rounded-md bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400"><span className="material-symbols-outlined text-[17px]">verified</span></div><div><div className="font-semibold text-white tracking-tight flex items-center gap-1.5">{" "}Maple Court Plaza{" "}<span className="text-[10px] font-mono text-cyan-300 font-bold">$18,900 CAD/yr</span></div><div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>{" "}{"Executed & Invoiced"}{" "}</div></div></div><svg className="w-full max-w-[430px] h-auto overflow-visible filter drop-shadow-2xl" fill="none" viewBox="0 0 460 260"><path d="M 68 116 A 170 145 0 0 1 378 116" fill="none" stroke="url(#arcGradient)" strokeDasharray="5 7" strokeLinecap="round" strokeWidth="2.2"></path><defs><linearGradient id="arcGradient" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8"></stop><stop offset="50%" stopColor="#3b82f6" stopOpacity="0.7"></stop><stop offset="100%" stopColor="#00d9f2" stopOpacity="0.9"></stop></linearGradient><linearGradient id="coolGradient" x1="0%" x2="0%" y1="100%" y2="0%"><stop offset="0%" stopColor="#2563eb"></stop><stop offset="100%" stopColor="#00d9f2"></stop></linearGradient></defs><g stroke="#f59e0b" strokeLinecap="round" strokeWidth="2" transform="translate(68, 116)"><circle cx="0" cy="0" fill="#f59e0b" fillOpacity="0.15" r="9"></circle><line x1="0" x2="0" y1="-16" y2="-12"></line><line x1="0" x2="0" y1="12" y2="16"></line><line x1="-16" x2="-12" y1="0" y2="0"></line><line x1="12" x2="16" y1="0" y2="0"></line><line x1="-11.5" x2="-8.5" y1="-11.5" y2="-8.5"></line><line x1="8.5" x2="11.5" y1="8.5" y2="11.5"></line><line x1="-11.5" x2="-8.5" y1="11.5" y2="8.5"></line><line x1="8.5" x2="11.5" y1="-8.5" y2="-11.5"></line></g><g stroke="#00d9f2" strokeLinecap="round" strokeWidth="2" transform="translate(378, 116)"><line x1="0" x2="0" y1="-14" y2="14"></line><line x1="-12.1" x2="12.1" y1="-7" y2="7"></line><line x1="-12.1" x2="12.1" y1="7" y2="-7"></line><path d="M -3 -10 L 0 -7 L 3 -10" fill="none"></path><path d="M -3 10 L 0 7 L 3 10" fill="none"></path><path d="M -10 -2 L -7 -4 L -9 -7" fill="none"></path><path d="M 10 2 L 7 4 L 9 7" fill="none"></path><path d="M -10 2 L -7 4 L -9 7" fill="none"></path><path d="M 10 -2 L 7 -4 L 9 -7" fill="none"></path></g><g stroke="url(#coolGradient)" strokeLinecap="round" strokeWidth="2.6"><path className="flow-wave-cyan" d="M 194 134 C 189 123 197 114 193 103 C 190 94 195 86 193 78" fill="none"></path><path className="flow-wave-cyan" d="M 214 134 C 209 123 217 114 213 103 C 210 94 215 86 213 78" fill="none" style={{ animationDelay: "-1s" }}></path><path className="flow-wave-cyan" d="M 234 134 C 229 123 237 114 233 103 C 230 94 235 86 233 78" fill="none" style={{ animationDelay: "-2s" }}></path></g><path d="M 184 140 C 190 135 238 135 244 140 Z" fill="#0b1626" stroke="#4b678f" strokeWidth="2"></path><path d="M 166 145 C 172 137 256 137 262 145 Z" fill="#0d1b30" stroke="#4b678f" strokeWidth="2"></path><rect fill="#0a1526" height="9" rx="2" stroke="#4b678f" strokeWidth="2" width="80" x="174" y="145"></rect><rect fill="#0a1526" height="66" rx="5" stroke="#3b82f6" strokeWidth="2" width="146" x="141" y="154"></rect><line stroke="#60a5fa" strokeLinecap="round" strokeWidth="2" x1="160" x2="228" y1="170" y2="170"></line><line stroke="#60a5fa" strokeLinecap="round" strokeWidth="2" x1="160" x2="228" y1="179" y2="179"></line><line stroke="#60a5fa" strokeLinecap="round" strokeWidth="2" x1="160" x2="228" y1="188" y2="188"></line><line stroke="#60a5fa" strokeLinecap="round" strokeWidth="2" x1="160" x2="228" y1="197" y2="197"></line><rect fill="#050e1b" height="38" rx="4" stroke="#00d9f2" strokeWidth="1.6" width="36" x="238" y="167"></rect><circle cx="251" cy="181" fill="none" r="5" stroke="#93c5fd" strokeWidth="1.4"></circle><line stroke="#00d9f2" strokeLinecap="round" strokeWidth="1.5" x1="251" x2="253.5" y1="181" y2="177.5"></line><circle cx="264" cy="179" fill="#00d9f2" r="2.4"></circle><circle cx="264" cy="189" fill="#10b981" r="2.2"></circle><line stroke="#475569" strokeLinecap="round" strokeWidth="1.6" x1="245" x2="267" y1="198" y2="198"></line><path d="M 132 220 L 296 220 A 3 3 0 0 1 299 223 L 299 231 A 4 4 0 0 1 295 235 L 133 235 A 4 4 0 0 1 129 231 L 129 223 A 3 3 0 0 1 132 220 Z" fill="#0d1b30" stroke="#4b678f" strokeWidth="2"></path><line stroke="#294060" strokeLinecap="round" strokeWidth="2.2" x1="152" x2="147" y1="235" y2="247"></line><line stroke="#294060" strokeLinecap="round" strokeWidth="2.2" x1="276" x2="281" y1="235" y2="247"></line><line stroke="#1e293b" strokeLinecap="round" strokeWidth="2" x1="72" x2="356" y1="247" y2="247"></line><line stroke="#0f172a" strokeLinecap="round" strokeWidth="1.6" x1="72" x2="356" y1="258" y2="258"></line></svg></div></div><footer className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 font-normal tracking-wide pt-4 border-t border-slate-800/60 gap-2"><div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span><span>{"Commercial HVAC · Refrigeration · Electrical & Controls"}</span></div></footer></motion.section><main className="relative w-full bg-[#f8fafc] flex flex-col justify-between items-center px-4 py-8 sm:px-8 sm:py-12 min-h-screen bg-dot-pattern" data-purpose="auth-form-container"><div className="pointer-events-none absolute top-10 right-10 w-80 h-80 bg-blue-100/60 rounded-full blur-3xl"></div><div className="pointer-events-none absolute bottom-12 left-10 w-72 h-72 bg-emerald-100/40 rounded-full blur-3xl"></div><div className="w-full max-w-[440px] flex items-center justify-between z-10"><Link className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-200/60" href="/"><span className="material-symbols-outlined text-[16px]">arrow_back</span><span>Back to Service Pacts</span></Link><div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono"></div></div><div className="w-full max-w-[440px] flex flex-col items-center my-auto z-10 py-6"><div className="w-full glass-auth-card rounded-2xl p-7 sm:p-9 card-enter relative overflow-hidden" data-purpose="sign-in-card"><div className="absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r from-blue-600 via-cyan-500 to-indigo-600"></div><div className="mb-5"><div className="flex items-center justify-between mb-1.5"><h2 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight leading-snug">{" "}Welcome back{" "}</h2><span className="px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Passwordless</span></div><p className="text-[13.5px] text-slate-600 font-normal leading-relaxed">{" "}{"We'll email you a secure, single-use link to sign in instantly."}{" "}</p></div>{form}</div><div className="mt-6 text-center text-[13px] text-slate-500 space-y-1.5" data-purpose="alternative-action"><div>{" "}New to Service Pacts?{" "}<Link className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition inline-flex items-center gap-0.5" href="/register">{" "}Create your workspace{" "}<span className="material-symbols-outlined text-[14px]">chevron_right</span></Link></div><div className="text-[12px] text-slate-600">{" "}Having trouble?{" "}<a className="underline hover:text-slate-700 transition" href="mailto:support@servicepacts.com">Contact contractor support</a></div></div></div><div className="w-full max-w-[440px] z-10 pt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-medium"><span className="flex items-center gap-1"><span className="text-xs">🍁</span>{" "}{HOSTING_SHORT}{" "}</span></div></main></motion.div>







    </div>
  );
}
