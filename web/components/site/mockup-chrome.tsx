import Link from "next/link";
import { COPYRIGHT, HOSTING_SHORT } from "@/components/site/content";
import { PublicHeader, type PublicPage } from "@/components/site/public-header";
import { ProductMark } from "@/components/ui/product-mark";

/**
 * The public site's header and footer, exactly as the owner's mockups draw them (docs/service_pacts_404_not_found and the
 * other public mockups share this chrome). Pages without a mockup of their own (about, FAQ, contact, the legal pages) wear it
 * through `SiteShell`; the mockup pages carry the same markup inline.
 */
export function MockupHeader({ active }: { active?: PublicPage }) {
  return <PublicHeader active={active} />;
}

export function MockupFooter() {
  return (
    <footer className="bg-nf-navy-950 text-gray-400 text-xs py-14 border-t border-gray-800"><div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pb-10"><div className="md:col-span-5"><Link className="flex items-center gap-2 text-white" href="/"><ProductMark className="size-6" /><span className="font-bold text-white text-sm">Service Pacts</span></Link><p className="mt-3 text-[11px] text-gray-400 max-w-sm leading-relaxed">{" "}Purpose-built recurring service agreements and maintenance software for Canadian trade contractors — from equipment schedules to customer sign-off.{" "}</p><p className="mt-3 text-[10px] text-gray-400 flex items-center gap-1.5"><span>🍁</span><span>Built for Canada outside Quebec. All billing and pricing in Canadian Dollars (CAD).</span></p></div><div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 md:pl-12"><div><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 mb-3">Product</h4><ul className="space-y-2 text-[11px]"><li><Link className="hover:text-white transition-colors" href="/product">Product Overview</Link></li><li><Link className="hover:text-white transition-colors" href="/demo">Interactive Demo</Link></li><li><Link className="hover:text-white transition-colors" href="/pricing">{"Pricing & Plans"}</Link></li><li><Link className="hover:text-white transition-colors" href="/trades">Trade Coverage</Link></li></ul></div><div><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 mb-3">Commercial Trades</h4><ul className="space-y-2 text-[11px]"><li><Link className="hover:text-white transition-colors" href="/trades#hvac">Commercial HVAC</Link></li><li><Link className="hover:text-white transition-colors" href="/trades#plumbing">{"Plumbing & Hydronics"}</Link></li><li><Link className="hover:text-white transition-colors" href="/trades#electrical">{"Electrical & Controls"}</Link></li><li><Link className="hover:text-white transition-colors" href="/trades#refrigeration">Refrigeration</Link></li></ul></div><div><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 mb-3">{"Trust & Security"}</h4><ul className="space-y-2 text-[11px]"><li><Link className="hover:text-white transition-colors" href="/security">Security Overview</Link></li><li><Link className="hover:text-white transition-colors" href="/privacy">Privacy Policy</Link></li><li><Link className="hover:text-white transition-colors" href="/terms">Terms of Service</Link></li><li><Link className="hover:text-white transition-colors" href="/contact">Contact Support</Link></li></ul></div></div></div><div className="pt-8 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-gray-500"><div>{COPYRIGHT}</div><div className="flex items-center gap-4"><span>{HOSTING_SHORT}</span></div></div></div></footer>
  );
}
