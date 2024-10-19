import type { Promisable, Simplify, UnionToIntersection } from "type-fest";

/** Represents the options that can be attached to a step. */
export interface StepOptions {
  /** The desired output of the transition to this step. */
  output?: object;
  bypass?: boolean;
}

/** Represents any step in a trace. */
export type AnyStep = Step<any, any>;

/** Represents a single step in a trace. */
export class Step<const Name extends string, Options extends StepOptions> {
  tag = "step" as const;

  constructor(
    public name: Name,
    public options: Options,
  ) {}
}

export class Call {
  tag = "call" as const;
  constructor(public fn: () => Promisable<any>) {}
}

/** Represents a trace of any steps. */
export type AnyTrace = Trace<[...(AnyStep | Call)[]]>;

/** Represents a sequence of steps in a trace. */
export class Trace<const Steps extends [] | [...(AnyStep | Call)[]] = []> {
  tag = "trace" as const;

  constructor(
    public name: string,
    public steps: Steps = [] as Steps,
  ) {}

  static with<Input extends object>(
    name: string,
    output: Input,
  ): Trace<[Step<"@", { output: Input }>]> {
    return new Trace(name, [new Step("@", { output })]);
  }

  step<const Name extends string, Options extends StepOptions = {}>(
    name: Name,
    getOptions: () => Options = () => ({}) as Options,
  ): Trace<[...Steps, Step<Name, Options>]> {
    return new Trace(this.name, [...this.steps, new Step(name, getOptions())]);
  }

  call(fn: () => Promisable<any>): Trace<[...Steps, Call]> {
    return new Trace(this.name, [...this.steps, new Call(fn)]);
  }
}

/** Represents a transition from one state to another, with input and output types attached. */
export interface InferredTransition<From, To, Input, Output> {
  tag: "inferred transition";
  from: From;
  to: To;
  input: Input;
  output: Output;
}

/**
 * Distributes the list of individual steps into a union of step pairs.
 *
 * So, for example, a list of steps:
 *
 * - One
 * - Two
 * - Three
 *
 * Is transformed into a list of transitions:
 *
 * - From one to two
 * - From two to three
 */
export type TraceTransition<Steps extends AnyTrace["steps"], Result = never> =
  Steps extends [infer From extends AnyStep, ...infer Rest] ?
    Rest extends [infer To extends AnyStep, ...any] ?
      TraceTransition<
        Rest,
        | Result
        | InferredTransition<
            From["name"],
            To["name"],
            From["options"]["output"],
            To["options"]["output"]
          >
      >
    : Result
  : Result;

/** Represents any program. */
export type AnyProgram = Program<AnyTrace>;

/** Represents a program that consists of multiple traces. */
export class Program<const Trace extends AnyTrace> {
  tag = "program" as const;

  transitions: [string, string][] = [];
  states: string[] = [];

  constructor(public traces: Trace[]) {
    const uniqueStates = new Set<string>();
    const transitions = [];
    for (const trace of this.traces) {
      for (const [i, step] of Object.entries(trace.steps)) {
        if (step instanceof Call) continue;
        const next = trace.steps.slice(Number(i) + 1).find((step) => step instanceof Step)?.name;
        if (next) transitions.push([step.name, next]);
        if (step.name === "@") continue;
        uniqueStates.add(step.name);
      }
    }
    this.transitions = transitions as [string, string][];
    this.states = Array.from(uniqueStates);
  }

  /** Generates a state diagram from the traces in the program. */
  chart(options = { distinct: false }) {
    const result = ["stateDiagram-v2"];
    for (const [i, state] of Object.entries(this.states)) {
      result.push(`  ${Number(i) + 1}: ${state}`);
    }
    for (const [from, to] of this.transitions) {
      const fromIndex = this.states.findIndex((state) => state === from) + 1;
      const toIndex = this.states.findIndex((state) => state === to) + 1;
      result.push(`  ${fromIndex || "[*]"} --> ${toIndex}`);
    }
    if (options.distinct) {
      return Array.from(new Set(result)).join("\n");
    }
    return result.join("\n");
  }
}

/** T in category of (*) */
export type Any<T> = T extends "*" ? any : T;

/** Filters out the call steps from a trace. */
export type FilterSteps<Steps extends AnyTrace["steps"], Result extends [...AnyStep[]] = []> =
  Steps extends [infer Step, ...infer Rest extends AnyTrace["steps"]] ?
    Step extends AnyStep ?
      FilterSteps<Rest, [...Result, Step]>
    : FilterSteps<Rest, Result>
  : Result;

/** Converts a program to a union of transitions. */
export type InferTransitions<T extends AnyProgram> =
  T extends Program<infer Trace> ? TraceTransition<FilterSteps<Trace["steps"]>> : never;

/** Represents a union of state names that a program can transition from. */
export type FromState<Program extends AnyProgram> = InferTransitions<Program>["from"];

/** Represents a union of state names that a program can transition to. */
export type ToState<T, From extends string> =
  T extends InferredTransition<Any<From>, infer To, any, any> ? To : never;

/** Represents the output of a transition function. */
export type FnOutput<T, From, To> = readonly [
  next: "@" | (T extends InferredTransition<Any<To>, infer Next, any, any> ? Next : never),
  payload?: T extends InferredTransition<Any<From>, Any<To>, any, infer O> ? O : never,
];

/** Represents the input of a transition function. */
export type FnInput<T, From, To> = Simplify<
  UnionToIntersection<T extends InferredTransition<Any<From>, Any<To>, infer I, any> ? I : never>
>;

/** Represents a transition from one state to another. */
class Transition {
  tag = "transition" as const;
  constructor(
    public from: string,
    public to: string,
    public fn: (input: any, transition: { from: string; to: string }) => any,
  ) {}
}

/** Represents an implementation of a program. */
export class Implementation<const Program extends AnyProgram> {
  tag = "implementation" as const;

  constructor(
    public program: Program = undefined as unknown as Program,
    public transitions: Transition[] = [],
  ) {}

  /** Adds a transition from one state to another, with a function that processes input. */
  transition<
    const From extends "*" | FromState<Program>,
    const To extends "*" | ToState<InferTransitions<Program>, From>,
  >(
    from: From & string,
    to: To & string,
    fn: (
      input: FnInput<InferTransitions<Program>, From, To>,
      transition: { from: string; to: string },
    ) => Promisable<FnOutput<InferTransitions<Program>, From, To>>,
  ) {
    return new Implementation(this.program, this.transitions.concat(new Transition(from, to, fn)));
  }

  /** Adds a state handler. Syntactic sugar for transition('*', to) */
  state<const To extends "*" | ToState<InferTransitions<Program>, "*">>(
    to: To & string,
    fn: (
      input: FnInput<InferTransitions<Program>, "*", To>,
      transition: { from: string; to: string },
    ) => Promisable<FnOutput<InferTransitions<Program>, "*", To>>,
  ) {
    return new Implementation(this.program, this.transitions.concat(new Transition("*", to, fn)));
  }

  /** Finds a transition from one state to another. */
  findTransition(from: string, to: string) {
    return this.transitions.find(
      (transition) =>
        (transition.from === "*" || transition.from === from) &&
        (transition.to === "*" || transition.to === to),
    );
  }

  /** Executes a program from one state to another, with an initial input. */
  async execute<
    const From extends "*" | FromState<Program>,
    const To extends "*" | ToState<InferTransitions<Program>, From>,
  >(from: From & string, to: To & string, input?: any) {
    const transition = this.findTransition(from, to);
    if (!transition) throw new Error(`No transition from ${from} to ${to}`);
    return await transition.fn(input, { from, to });
  }

  /** Runs a program from one state to another, with an initial input. */
  async run<
    const From extends InferTransitions<Program>["from"],
    const To extends ToState<InferTransitions<Program>, From>,
  >(from: From & string, to: To & string, input: any) {
    while (to !== "@") {
      var [next, output] = await this.execute(from, to, input);
      [from, to] = [to as From & string, next];
      input = output;
    }
    return output;
  }

  /** Verifies a program against its traces, returning a report of each step. */
  async verify(program: Program = this.program) {
    if (!program) throw new Error("Verify requires a program to verify against");

    const report = [];

    for (const trace of program.traces) {
      let from = "@",
        to,
        input;
      for (const [i, step] of Object.entries(trace.steps)) {
        if (step instanceof Call) {
          await step.fn();
          continue;
        }
        if (from === "@" && step.name === "@") {
          input = step.options.output;
          continue;
        }

        to = step.name;
        const transition = this.findTransition(from, to);
        if (!transition) {
          report.push({
            kind: "fail",
            trace,
            step,
            message: `No transition from ${from} to ${to}`,
          } as const);
          break;
        }

        if (!step.options.bypass) {
          var [next, output] = await transition.fn(input, { from, to });
          if (step.options.output && !deepEqual(output, step.options.output)) {
            report.push({
              kind: "fail",
              trace,
              step,
              message: `Expected output ${toStableJson(step.options.output)}, got ${toStableJson(
                output,
              )}`,
            } as const);
            break;
          }
        } else {
          var next =
            trace.steps.slice(Number(i) + 1).find((step) => step instanceof Step)?.name ?? "@";
          var output = step.options.output;
        }

        [from, to] = [to, next];
        input = output;

        report.push({ kind: "pass", trace, step } as const);
      }
    }
    return report;
  }

  /** Tests a program against its traces, throwing an error if any step fails. */
  async test(program: Program = this.program) {
    const report = await this.verify(program);
    if (!report.every((step) => step.kind === "pass")) {
      const message = [""];
      for (const trace of program.traces) {
        message.push(`Trace: ${trace.name}`);
        for (const step of trace.steps) {
          if (step instanceof Call) continue;
          const record = report.find((its) => its.trace === trace && its.step === step);
          if (step.name === "@") continue;
          if (!record) {
            message.push(`  ⬜ ${step.name}`);
            continue;
          }
          message.push(`  ${record.kind === "pass" ? "🟩" : "🟥"} ${step.name}`);
          if (record.kind === "fail") message.push(`    ${record.message}`);
        }
      }

      throw new Error(message.join("\n"));
    }
  }
}

/** Converts an object to a stable JSON string, by sorting the keys. */
function toStableJson(object: any) {
  const allKeys = new Set<string | number>();
  JSON.stringify(object, (key, value) => (allKeys.add(key), value));
  return JSON.stringify(object, Array.from(allKeys).sort());
}

/** Compares two values deeply, converting them to stable JSON strings. */
function deepEqual(a: any, b: any) {
  return toStableJson(a) === toStableJson(b);
}
