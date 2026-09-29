interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

const buttonClass =
  "w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 disabled:hover:bg-muted disabled:hover:text-foreground";

const Stepper = ({ label, value, min, max, step = 1, onChange }: StepperProps) => (
  <div className="flex items-center gap-2" role="group" aria-label={label}>
    <button
      type="button"
      aria-label={`Decrease ${label.toLowerCase()}`}
      disabled={value <= min}
      onClick={() => onChange(Math.max(min, value - step))}
      className={buttonClass}
    >
      −
    </button>
    <span className="w-10 text-center font-medium text-foreground" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      aria-label={`Increase ${label.toLowerCase()}`}
      disabled={value >= max}
      onClick={() => onChange(Math.min(max, value + step))}
      className={buttonClass}
    >
      +
    </button>
  </div>
);

export default Stepper;
