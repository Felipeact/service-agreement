import { MONTH_PRESETS, MONTH_SHORT, PRESET_LABELS, type MonthPreset } from "@/domain/agreement";
import { Button } from "@/components/ui/button";

const legend = "text-[13px] font-medium text-ink";
export const monthBox = "size-4 shrink-0 accent-action";
/** A checkbox and its label as one 44px target (34px on desktop); a checked one wears the action tint. */
export const monthChoice =
  "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-hairline bg-surface text-[13px] text-ink has-[:checked]:border-action has-[:checked]:bg-action-tint lg:min-h-[34px]";

const PRESETS = Object.keys(MONTH_PRESETS) as MonthPreset[];

type MonthGridProps = {
  /** The checkbox field name; the checked months are submitted under it. */
  name: string;
  legend: string;
  /** The checked months, 1 = January (lesson L-014: the owner of the control holds them). */
  checked: readonly number[];
  onToggle?: (month: number) => void;
  onPreset?: (preset: MonthPreset) => void;
  /** Quarterly, semi-annual and monthly buttons above the grid; on by default. */
  presets?: boolean;
  error?: string;
  errorId?: string;
};

/** Twelve month toggles with optional presets, used by the service line form. */
export function MonthGrid({ name, legend: label, checked, onToggle, onPreset, presets = true, error, errorId }: MonthGridProps) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? errorId : undefined}>
      <legend className={`${legend} mb-1.5`}>{label}</legend>
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button key={preset} onClick={() => onPreset?.(preset)}>
              {PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
        {MONTH_SHORT.map((short, index) => {
          const month = index + 1;
          return (
            // Below md a cell is about 44px wide, so the box sits above its month instead of beside it.
            <label key={short} className={`${monthChoice} flex-col justify-center gap-0.5 md:flex-row md:gap-1.5`}>
              <input
                type="checkbox"
                name={name}
                value={month}
                checked={checked.includes(month)}
                onChange={() => onToggle?.(month)}
                className={monthBox}
              />
              {short}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
