import { InfoIcon, StarIcon, UserIcon } from "lucide-react";
import { CountUp } from "@/components/motion/count-up";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import { FRESH_UNDER_DAYS, type PipelineStats } from "@/lib/pipeline-stats";

const formatCount = (value: number) => String(value);
const dealsIn = (count: number) => `${count} ${count === 1 ? "agreement" : "agreements"}`;

/**
 * The four figures an estimator opens the Pipeline for (docs/DESIGN.md "Service Pact Summary Cards"): money in play, how
 * many deals are open and how fresh, what was signed this month, and what is being drafted. The figures come from
 * `pipelineStats`; nothing here computes.
 */
export function PipelineSummary({ stats }: { stats: PipelineStats }) {
  const unpriced = stats.openCents === 0 && stats.openCount > 0;
  return (
    <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:gap-4">
      <div data-summary="open">
        <StatCard
          label="Pipeline Value"
          icon={<InfoIcon />}
          value={unpriced ? "Unpriced" : <CountUp value={stats.openCents} format={formatCad} snap={100} />}
          unit={unpriced ? undefined : "CAD"}
          note={
            <>
              <span>{dealsIn(stats.openCount)} in motion</span>
              <span>{unpriced ? "priced once lines are added" : stats.unpricedCount > 0 ? `${stats.unpricedCount} unpriced` : "annualized"}</span>
            </>
          }
        />
      </div>
      <div data-summary="active">
        <StatCard
          label="Total Deals Active"
          icon={<InfoIcon />}
          value={<CountUp value={stats.openCount} format={formatCount} />}
          unit="total"
          note={
            <>
              <span>{stats.freshCount} aging under {FRESH_UNDER_DAYS} days</span>
              <span>{stats.followUpCount} need follow-up</span>
            </>
          }
        />
      </div>
      <div data-summary="won">
        <StatCard
          label="Deals Won (This Month)"
          icon={<StarIcon />}
          value={<CountUp value={stats.signedCents} format={formatCad} snap={100} />}
          note={
            <>
              <span>{dealsIn(stats.signedCount)} signed</span>
              <span>{stats.winRate === null ? "nothing closed yet" : `${stats.winRate}% win rate`}</span>
            </>
          }
        />
      </div>
      <div data-summary="progress">
        <StatCard
          label="Deals in Progress"
          icon={<UserIcon />}
          value={<CountUp value={stats.inProgress.count} format={formatCount} />}
          indicator={<StatusPill stage="in_progress" filled label="Active" />}
          note={
            <>
              <span>{stats.inProgress.averageVisits === null ? "No priced deals" : `${stats.inProgress.averageVisits} visits/yr average`}</span>
              <span>{stats.inProgress.siteCount} {stats.inProgress.siteCount === 1 ? "site" : "sites"}</span>
            </>
          }
        />
      </div>
    </div>
  );
}
