export interface StepOptions {
  output?: object;
}

export type AnyStep = Step<any, any>;
export class Step<
  const Name extends string,
  const Options extends StepOptions,
> {
  constructor(
    public name: Name,
    public options: Options
  ) {}
}

export type AnyTrace = Trace<[...AnyStep[]]>;
export class Trace<const Steps extends [] | [...AnyStep[]] = []> {
  constructor(public steps: Steps = [] as Steps) {}

  static with<const Input extends object>(
    output: Input
  ): Trace<[Step<'@', { output: Input }>]> {
    return new Trace([new Step('@', { output })]);
  }

  step<const Name extends string, const Options extends StepOptions>(
    name: Name,
    options: Options
  ): Trace<[...Steps, Step<Name, Options>]> {
    return new Trace([...this.steps, new Step(name, options)]);
  }
}

export interface Transition<From, To, Input, Output> {
  from: From;
  to: To;
  input: Input;
  output: Output;
}

export type StepsToTransition<
  Steps extends AnyTrace['steps'],
  Result = never,
> = Steps extends [infer From extends AnyStep, ...infer Rest]
  ? Rest extends [infer To extends AnyStep, ...any]
    ? StepsToTransition<
        Rest,
        | Result
        | Transition<
            From['name'],
            To['name'],
            From['options']['output'],
            To['options']['output']
          >
      >
    : Result
  : Result;

export type AnyProgram = Program<AnyTrace>;
export class Program<const Trace extends AnyTrace> {
  constructor(public traces: Trace[]) {}
}

export type ProgramToTransition<T extends AnyProgram> =
  T extends Program<infer Trace> ? StepsToTransition<Trace['steps']> : never;

type FromValue<Program extends AnyProgram> =
  | '*'
  | ProgramToTransition<Program>['from'];

type ToValue<Program extends AnyProgram, From> =
  | '*'
  | (ProgramToTransition<Program> extends Transition<
      From extends '*' ? any : From,
      infer To,
      any,
      any
    >
      ? To
      : never);

type FnOutput<Program extends AnyProgram, From, To> =
  ProgramToTransition<Program> extends Transition<
    From extends '*' ? any : From,
    To extends '*' ? any : To,
    any,
    infer Output
  >
    ? {
        next:
          | '@'
          | (ProgramToTransition<Program> extends Transition<
              To extends '*' ? any : To,
              infer Next,
              any,
              any
            >
              ? Next
              : never);
        output: Output;
      }
    : never;

type FnInput<Program extends AnyProgram, From, To> =
  ProgramToTransition<Program> extends Transition<
    From extends '*' ? any : From,
    To extends '*' ? any : To,
    infer Input,
    infer Output
  >
    ? Input & Output
    : never;

export class Implementation<const Program extends AnyProgram> {
  constructor(public program: Program) {}

  transition<
    const From extends FromValue<Program>,
    const To extends ToValue<Program, From>,
    const Fn extends (
      input: FnInput<Program, From, To>
    ) => FnOutput<Program, From, To>,
  >(from: From, to: To, fn: Fn) {}
}
