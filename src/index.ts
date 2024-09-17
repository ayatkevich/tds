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
class Step<const Name extends string, Options extends StepOptions> {
  tag = "step" as const;

  constructor(
    public name: Name,
    public options: Options,
  ) {}
}

/** Represents a trace of any steps. */
export type AnyTrace = Trace<[...AnyStep[]]>;

/** Represents a sequence of steps in a trace. */
export class Trace<const Steps extends [] | [...AnyStep[]] = []> {
  tag = "trace" as const;

  constructor(public steps: Steps = [] as Steps) {}

  static with<Input extends object>(output: Input): Trace<[Step<"@", { output: Input }>]> {
    return new Trace([new Step("@", { output })]);
  }

  step<const Name extends string, Options extends StepOptions = {}>(
    name: Name,
    options: Options = {} as Options,
  ): Trace<[...Steps, Step<Name, Options>]> {
    return new Trace([...this.steps, new Step(name, options)]);
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

  constructor(public traces: Trace[]) {}
}

/** T in category of (*) */
export type Any<T> = T extends "*" ? any : T;

/** Converts a program to a union of transitions. */
export type InferTransitions<T extends AnyProgram> =
  T extends Program<infer Trace> ? TraceTransition<Trace["steps"]> : never;

/** Represents a union of state names that a program can transition from. */
export type FromState<Program extends AnyProgram> = InferTransitions<Program>["from"];

/** Represents a union of state names that a program can transition to. */
export type ToState<T, From extends string> =
  T extends InferredTransition<Any<From>, infer To, any, any> ? To : never;

/** Represents the output of a transition function. */
export type FnOutput<T, From, To> = [
  next: "@" | (T extends InferredTransition<Any<To>, infer Next, any, any> ? Next : never),
  payload?: T extends InferredTransition<Any<From>, Any<To>, any, infer O> ? O : never,
];

/** Represents the input of a transition function. */
export type FnInput<T, From, To> = Simplify<
  UnionToIntersection<T extends InferredTransition<Any<From>, Any<To>, infer I, any> ? I : never>
>;

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

  /** Finds a transition from one state to another. */
  findTransition(from: string, to: string) {
    return this.transitions.find(
      (transition) =>
        (transition.from === "*" || transition.from === from) &&
        (transition.to === "*" || transition.to === to),
    );
  }

  /** Runs a program from one state to another, with an initial input. */
  async run<
    const From extends InferTransitions<Program>["from"],
    const To extends ToState<InferTransitions<Program>, From>,
  >(from: From & string, to: To & string, input: any) {
    while (to !== "@") {
      const transition = this.findTransition(from, to);
      if (!transition) throw new Error(`No transition from ${from} to ${to}`);
      var [next, output] = await transition.fn(input, { from, to });
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
          var [next, output] = [trace.steps[Number(i) + 1]?.name ?? "@", step.options.output];
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
      this.transitions;
      const message = [];
      for (const trace of program.traces) {
        message.push(`Trace:`);
        for (const step of trace.steps) {
          const record = report.find((its) => its.trace === trace && its.step === step);
          if (step.name === "@") continue;
          if (!record) {
            message.push(`  ... ${step.name}`);
            continue;
          }
          message.push(`  ${record.kind === "pass" ? "✅" : "❌"} ${step.name}`);
          if (record.kind === "fail") message.push(`    ${record.message}`);
        }
      }

      const newLocal = message.join("\n");
      throw new Error(newLocal);
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
