import { useRef, useState } from "react";
import {
  Delete,
  Divide,
  Equal,
  Minus,
  Percent,
  Plus,
  Radical,
  X,
  type LucideIcon,
} from "lucide-react";
import { calculate, DomainError, NETWORK_MESSAGE } from "../api/calculate";
import { KEY } from "../calculator/keys";
import {
  expressionLine,
  failNetwork,
  initialState,
  press,
  succeed,
  toError,
  type CalculatorState,
} from "../calculator/machine";

type Tone = "digit" | "op" | "equal" | "ghost";

interface KeyDef {
  label: string;
  icon?: LucideIcon;
  tone: Tone;
}

const rows: KeyDef[][] = [
  [
    { label: KEY.ac, tone: "ghost" },
    { label: KEY.clear, tone: "ghost" },
    { label: KEY.backspace, icon: Delete, tone: "ghost" },
    { label: KEY.div, icon: Divide, tone: "op" },
  ],
  [
    { label: KEY.sqrt, icon: Radical, tone: "ghost" },
    { label: KEY.exp, tone: "ghost" },
    { label: KEY.percent, icon: Percent, tone: "ghost" },
    { label: KEY.mul, icon: X, tone: "op" },
  ],
  [
    { label: "7", tone: "digit" },
    { label: "8", tone: "digit" },
    { label: "9", tone: "digit" },
    { label: KEY.sub, icon: Minus, tone: "op" },
  ],
  [
    { label: "4", tone: "digit" },
    { label: "5", tone: "digit" },
    { label: "6", tone: "digit" },
    { label: KEY.add, icon: Plus, tone: "op" },
  ],
  [
    { label: "1", tone: "digit" },
    { label: "2", tone: "digit" },
    { label: "3", tone: "digit" },
    { label: KEY.eq, icon: Equal, tone: "equal" },
  ],
  [
    { label: KEY.sign, tone: "digit" },
    { label: "0", tone: "digit" },
    { label: KEY.dot, tone: "digit" },
  ],
];

const toneClass: Record<Tone, string> = {
  digit: "bg-zinc-700 text-white hover:bg-zinc-600",
  ghost: "bg-zinc-600 text-zinc-100 hover:bg-zinc-500",
  op: "bg-amber-700 text-white hover:bg-amber-600",
  equal: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
};

export function Calculator() {
  const [state, setState] = useState<CalculatorState>(initialState);
  const stateRef = useRef(state);
  const requestId = useRef(0);

  function commit(next: CalculatorState) {
    stateRef.current = next;
    setState(next);
  }

  async function onPress(key: string) {
    if (key === KEY.ac) requestId.current += 1;

    const step = press(stateRef.current, key);
    if (step.type === "state") {
      commit(step.state);
      return;
    }

    const id = ++requestId.current;
    commit({ ...step.state, networkError: false });
    try {
      const result = await calculate(step.request);
      if (requestId.current !== id) return;
      commit(succeed(result, step.request, step.next, step.state.history));
    } catch (error) {
      if (requestId.current !== id) return;
      if (error instanceof DomainError) {
        commit(toError());
        return;
      }
      commit(failNetwork(step.state, step.request, step.next));
    }
  }

  const locked = state.phase === "error";

  return (
    <section className="w-full max-w-sm rounded-[2rem] bg-zinc-900 p-4 shadow-2xl ring-1 ring-white/10">
      <p className="px-2 pb-3 text-sm tracking-[0.3em] text-zinc-500">sezzle</p>
      <div className="mb-4 rounded-2xl bg-black/50 px-4 py-5">
        <p
          data-testid="pending-op"
          className="h-6 overflow-x-auto whitespace-nowrap text-right text-sm tracking-wide text-amber-400"
        >
          {expressionLine(state)}
        </p>
        <p
          data-testid="display"
          className={`truncate text-right text-5xl font-medium tracking-tight ${
            state.phase === "error" ? "text-red-400" : "text-white"
          }`}
        >
          {state.display}
        </p>
        <p className="mt-2 min-h-6 text-sm text-amber-300">{state.networkError ? NETWORK_MESSAGE : ""}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {rows.flat().map((key) => (
          <KeyButton
            key={key.label}
            def={key}
            disabled={locked && key.label !== KEY.ac}
            onPress={onPress}
          />
        ))}
      </div>
    </section>
  );
}

function KeyButton({
  def,
  disabled,
  onPress,
}: {
  def: KeyDef;
  disabled: boolean;
  onPress: (key: string) => void;
}) {
  const Icon = def.icon;
  return (
    <button
      type="button"
      aria-label={def.label}
      disabled={disabled}
      onClick={() => onPress(def.label)}
      className={`flex h-14 items-center justify-center rounded-2xl text-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${toneClass[def.tone]} ${
        def.label === "0" ? "col-span-2" : ""
      }`}
    >
      {Icon ? <Icon aria-hidden="true" className="size-5" /> : def.label}
    </button>
  );
}
