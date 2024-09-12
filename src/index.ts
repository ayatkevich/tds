import type { UnionToIntersection } from 'type-fest';
export interface StepOptions {
  output?: object;
}

export type AnyStep = Step<any, any>;
export class Step<const Name extends string, Options extends StepOptions> {
  constructor(
    public name: Name,
    public options: Options
  ) {}
}

export type AnyTrace = Trace<[...AnyStep[]]>;
export class Trace<const Steps extends [] | [...AnyStep[]] = []> {
  constructor(public steps: Steps = [] as Steps) {}

  static with<Input extends object>(
    output: Input
  ): Trace<[Step<'@', { output: Input }>]> {
    return new Trace([new Step('@', { output })]);
  }

  step<const Name extends string, Options extends StepOptions>(
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

export type FromState<Program extends AnyProgram> =
  | '*'
  | ProgramToTransition<Program>['from'];

export type ToState<Program extends AnyProgram, From> =
  | '*'
  | (ProgramToTransition<Program> extends Transition<
      From extends '*' ? any : From,
      infer To,
      any,
      any
    >
      ? To
      : never);

export type FnOutput<Program extends AnyProgram, From, To> =
  ProgramToTransition<Program> extends Transition<
    From extends '*' ? any : From,
    To extends '*' ? any : To,
    any,
    infer Output
  >
    ? [
        (
          | '@'
          | (ProgramToTransition<Program> extends Transition<
              To extends '*' ? any : To,
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

export type FnInput<Program extends AnyProgram, From, To> = [From, To] extends [
  '*',
  '*',
]
  ? UnionToIntersection<ProgramToTransition<Program>['input']> &
      UnionToIntersection<ProgramToTransition<Program>['output']>
  : ProgramToTransition<Program> extends Transition<
        From extends '*' ? any : From,
        To extends '*' ? any : To,
        infer Input,
        any
      >
    ? UnionToIntersection<Input>
    : never;

export class Implementation<const Program extends AnyProgram> {
  constructor(public program: Program) {}

  transition<
    const From extends FromState<Program>,
    const To extends ToState<Program, From>,
  >(
    from: From,
    to: To,
    fn: (input: FnInput<Program, From, To>) => FnOutput<Program, From, To>
  ) {}
}
