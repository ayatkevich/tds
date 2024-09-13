import type { Simplify, UnionToIntersection } from "type-fest";

/** Represents the options that can be attached to a step. */
export interface StepOptions {
  /** The desired output of the transition to this step. */
  output?: object;
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

/** Represents a trace of any steps. */
export type AnyTrace = Trace<[...AnyStep[]]>;

/** Represents a sequence of steps in a trace. */
export class Trace<const Steps extends [] | [...AnyStep[]] = []> {
  tag = "trace" as const;

  constructor(public steps: Steps = [] as Steps) {}

  static with<Input extends object>(output: Input): Trace<[Step<"@", { output: Input }>]> {
    return new Trace([new Step("@", { output })]);
  }

  step<const Name extends string, Options extends StepOptions>(
    name: Name,
    options: Options,
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
 * Distributes the list of individual steps into a union of transition pairs.
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
export type TraceTransition<Steps extends AnyTrace["steps"], Result = never> = Steps extends [
  infer From extends AnyStep,
  ...infer Rest,
]
  ? Rest extends [infer To extends AnyStep, ...any]
    ? TraceTransition<
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

/** Converts a program to a union of transition pairs. */
export type InferTransition<T extends AnyProgram> =
  T extends Program<infer Trace> ? TraceTransition<Trace["steps"]> : never;

/** Represents a union of state names that a program can transition from. */
export type FromState<Program extends AnyProgram> = "*" | InferTransition<Program>["from"];

/** Represents a union of state names that a program can transition to. */
export type ToState<Program extends AnyProgram, From extends string> =
  | "*"
  | (InferTransition<Program> extends {
      from: From extends "*" ? any : From;
      to: infer To;
    }
      ? To
      : never);

/** Represents the output of a transition function. */
export type FnOutput<Program extends AnyProgram, From, To> =
  InferTransition<Program> extends InferredTransition<
    From extends "*" ? any : From,
    To extends "*" ? any : To,
    any,
    infer Output
  >
    ? [
        (
          | "@"
          | (InferTransition<Program> extends InferredTransition<
              To extends "*" ? any : To,
              infer Next,
              any,
              any
            >
              ? Next
              : never)
        ),
        UnionToIntersection<Output>,
      ]
    : never;

/** Represents the input of a transition function. */
export type FnInput<Program extends AnyProgram, From, To> = [From, To] extends ["*", "*"]
  ? Simplify<
      UnionToIntersection<InferTransition<Program>["input"]> &
        UnionToIntersection<InferTransition<Program>["output"]>
    >
  : InferTransition<Program> extends InferredTransition<
        [From] extends ["*"] ? any : From,
        [To] extends ["*"] ? any : To,
        infer Input,
        any
      >
    ? UnionToIntersection<Input>
    : never;

export class Transition {
  tag = "transition" as const;
  constructor(
    public from: string,
    public to: string,
    public fn: (input: any) => any,
  ) {}
}

/** Represents an implementation of a program. */
export class Implementation<const Program extends AnyProgram> {
  tag = "implementation" as const;

  constructor(
    public program: Program = new Program([] as any) as Program,
    public transitions: Transition[] = [],
  ) {}

  transition<const From extends FromState<Program>, const To extends ToState<Program, From>>(
    from: From & string,
    to: To & string,
    fn: (input: FnInput<Program, From, To>) => FnOutput<Program, From, To>,
  ) {
    return new Implementation(this.program, this.transitions.concat(new Transition(from, to, fn)));
  }

  getTransition(from: string, to: string) {
    return this.transitions.find(
      (transition) =>
        (transition.from === "*" || transition.from === from) &&
        (transition.to === "*" || transition.to === to),
    );
  }

  async run<
    const From extends InferTransition<Program>["from"],
    const To extends InferTransition<Program>["to"],
  >(from: From & string, to: To & string, input: any) {
    while (to !== "@") {
      const transition = this.getTransition(from, to);
      if (!transition) throw new Error(`No transition from ${from} to ${to}`);
      var [next, output] = await transition.fn(input);
      [from, to] = [to, next];
      input = output;
    }
    return output;
  }

  async verify(program: Program = this.program) {
    if (!program) throw new Error("Verify requires a program to verify against");

    const report = [];

    for (const trace of program.traces) {
      let from = "@",
        to,
        input;
      for (const step of trace.steps) {
        if (from === "@" && step.name === "@") {
          input = step.options.output;
          continue;
        }

        to = step.name;
        const transition = this.getTransition(from, to);
        if (!transition) {
          report.push({
            kind: "fail",
            trace,
            step,
            message: `No transition from ${from} to ${to}`,
          } as const);
          break;
        }

        const [next, output] = await transition.fn(input);
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

        [from, to] = [to, next];
        input = output;

        report.push({ kind: "pass", trace, step } as const);
      }
    }
    return report;
  }

  async test(program: Program = this.program) {
    const report = await this.verify(program);
    if (!report.every((step) => step.kind === "pass")) throw new Error();
  }
}

function toStableJson(object: any) {
  const allKeys = new Set<string | number>();
  JSON.stringify(object, (key, value) => (allKeys.add(key), value));
  return JSON.stringify(object, Array.from(allKeys).sort());
}

function deepEqual(a: any, b: any) {
  return toStableJson(a) === toStableJson(b);
}
