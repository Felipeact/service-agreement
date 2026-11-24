import type { ReactNode } from "react";
import * as motion from "motion/react-client";
import { ITEM, STAGGER, TAP, VIEWPORT } from "@/components/motion/variants";
import { MockupFooter, MockupHeader } from "@/components/site/mockup-chrome";

/** Generated from docs/service_pacts_register/code.html by the mockup converter, then edited by hand where the page needs data or behaviour. */
export function Content({ form }: { form: ReactNode }) {
  return (
    <div className="mk-rg min-h-screen flex flex-col font-sans antialiased text-slate-900 bg-[#f1f5f9]">



<MockupHeader />





<main className="relative grow w-full overflow-hidden"><div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl"></div><div className="pointer-events-none absolute top-1/4 -right-40 w-[30rem] h-[30rem] bg-indigo-400/15 rounded-full blur-3xl"></div><div className="pointer-events-none absolute bottom-10 left-1/3 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl"></div><div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-10 pb-24 w-full"><motion.div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start" initial="hidden" whileInView="show" viewport={VIEWPORT} variants={STAGGER}><motion.div className="lg:col-span-5 pt-2" variants={ITEM}><h1 className="text-4xl sm:text-5xl lg:text-[54px] leading-[1.08] font-extrabold text-slate-900 tracking-tight mb-5">Create your<br /><span className="bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">workspace.</span></h1><p className="text-[15px] leading-relaxed text-slate-600 mb-8 max-w-md">Tell us your trade and we set up your tailored workspace: commercial equipment templates, task checklists, and 12-month visit matrices — all ready to use and fully editable.</p><ol className="space-y-3.5 text-[14px] leading-snug text-slate-600 mb-10"><li className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div><span className="pt-0.5 text-slate-700 font-medium">Your details, trades, plan tier and team size.</span></li><li className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div><span className="pt-0.5 text-slate-700 font-medium">Your card, entered securely with Stripe.</span></li><li className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div><span className="pt-0.5 text-slate-700 font-medium">A sign-in link by email, and invitations for your team.</span></li></ol><div className="w-full max-w-md"><div className="bg-white rounded-2xl p-6 shadow-xl shadow-slate-200/60 border border-slate-200/90 mb-3 relative overflow-hidden backdrop-blur-xs"><div className="absolute top-0 right-0 w-28 h-28 bg-linear-to-bl from-blue-50 to-transparent rounded-bl-full pointer-events-none"></div><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3.5"><div className="w-11 h-11 rounded-xl bg-linear-to-tr from-slate-900 to-slate-800 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-md">BH</div><div><div className="flex items-center gap-1.5"><h4 className="font-bold text-[15px] text-slate-900 leading-tight">Blue Heron Mechanical Ltd.</h4><span className="material-symbols-outlined text-blue-600 text-[16px]">verified</span></div><p className="text-xs text-slate-500 mt-0.5">{"Commercial HVAC & Hydronics · Vancouver, BC"}</p></div></div><span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px] px-2.5 py-0.5 rounded-full">Ready for Signature</span></div><div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 mb-4"><div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Annual Service Agreement · Harbour Point Tower</div><div className="flex items-baseline justify-between"><div><span className="text-3xl font-extrabold tracking-tight text-slate-900">$14,280</span><span className="text-xs font-semibold text-slate-500 ml-1">CAD / yr</span></div><span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">Quarterly: $3,570</span></div></div><div className="flex items-center gap-2"><motion.button className="flex-1 inline-flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2.5 px-3 rounded-xl text-center transition shadow-xs cursor-pointer" type="button" whileTap={TAP}><span className="material-symbols-outlined text-[15px]">check</span><span>Accept</span></motion.button><motion.button className="flex-1 inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs py-2.5 px-3 rounded-xl border border-slate-300 text-center transition cursor-pointer" type="button" whileTap={TAP}><span className="material-symbols-outlined text-[15px]">edit_note</span><span>Request changes</span></motion.button><motion.button className="inline-flex items-center justify-center bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 font-medium text-xs py-2.5 px-4 rounded-xl border border-slate-300 text-center transition cursor-pointer" type="button" whileTap={TAP}><span>Refuse</span></motion.button></div></div><div className="flex items-center gap-2.5 text-xs text-slate-500 px-1"><span className="bg-slate-200/90 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">Sample Preview</span><span>A real Canadian contractor agreement layout. Yours will replace it.</span></div></div></motion.div><motion.div className="lg:col-span-7" variants={ITEM}><div className="bg-white rounded-3xl p-8 lg:p-10 shadow-xl shadow-slate-200/60 border border-slate-200/90 relative">{form}</div></motion.div></motion.div></div></main>





<MockupFooter />



    </div>
  );
}
