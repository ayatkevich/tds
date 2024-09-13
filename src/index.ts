import type { UnionToIntersection } from 'type-fest';

/**
 * Represents the options that can be attached to a step.
 */
export interface StepOptions {
  /**
   * The desired output of the transition to this step.
   */
  output?: object;
}

/**
 * Represents any step in a trace.
 */
export type AnyStep = Step<any, any>;

/**
 * Represents a single step in a trace.
 */
export class Step<const Name extends string, Options extends StepOptions> {
  tag = 'step' as const;

  constructor(
    public name: Name,
    public options: Options
  ) {}
}

/**
 * Represents a trace of any steps.
 */
export type AnyTrace = Trace<[...AnyStep[]]>;

/**
 * Represents a sequence of steps in a trace.
 */
export class Trace<const Steps extends [] | [...AnyStep[]] = []> {
  tag = 'trace' as const;

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

/**
 * Represents a transition from one state to another, with input and output types attached.
 */
export interface InferredTransition<From, To, Input, Output> {
  tag: 'inferred transition';
  from: From;
  to: To;
  input: Input;
  output: Output;
}

/**
 * Distributes the list of individual steps into a union of transition pairs.
 *
 * So, for example, a list of steps:
 * - one
 * - two
 * - three
 *
 * is transformed into a list of transitions:
 * - from one to two
 * - from two to three
 */
export type TraceToTransition<
  Steps extends AnyTrace['steps'],
  Result = never,
> = Steps extends [infer From extends AnyStep, ...infer Rest]
  ? Rest extends [infer To extends AnyStep, ...any]
    ? TraceToTransition<
        Rest,
        | Result
        | InferredTransition<
            From['name'],
            To['name'],
            From['options']['output'],
            To['options']['output']
          >
      >
    : Result
  : Result;

/**
 * Represents any program.
 */
export type AnyProgram = Program<AnyTrace>;

/**
 * Represents a program that consists of multiple traces.
 */
export class Program<const Trace extends AnyTrace> {
  tag = 'program' as const;

  constructor(public traces: Trace[]) {}
}

/**
 * Converts a program to a union of transition pairs.
 */
export type ProgramToTransition<T extends AnyProgram> =
  T extends Program<infer Trace> ? TraceToTransition<Trace['steps']> : never;

/**
 * Represents a union of state names that a program can transition from.
 */
export type FromState<Program extends AnyProgram> =
  | '*'
  | ProgramToTransition<Program>['from'];

/**
 * Represents a union of state names that a program can transition to.
 */
export type ToState<Program extends AnyProgram, From extends string> =
  | '*'
  | (ProgramToTransition<Program> extends {
      from: From extends '*' ? any : From;
      to: infer To;
    }
      ? To
      : never);

/**
 * Represents the output of a transition function.
 */
export type FnOutput<Program extends AnyProgram, From, To> =
  ProgramToTransition<Program> extends InferredTransition<
    From extends '*' ? any : From,
    To extends '*' ? any : To,
    any,
    infer Output
  >
    ? [
        (
          | '@'
          | (ProgramToTransition<Program> extends InferredTransition<
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

/**
 * Represents the input of a transition function.
 */
export type FnInput<Program extends AnyProgram, From, To> = [From, To] extends [
  '*',
  '*',
]
  ? UnionToIntersection<ProgramToTransition<Program>['input']> &
      UnionToIntersection<ProgramToTransition<Program>['output']>
  : ProgramToTransition<Program> extends InferredTransition<
        From extends '*' ? any : From,
        To extends '*' ? any : To,
        infer Input,
        any
      >
    ? UnionToIntersection<Input>
    : never;

export class Transition {
  tag = 'transition' as const;
  constructor(
    public from: string,
    public to: string,
    public fn: (input: any) => any
  ) {}
}

/**
 * Represents an implementation of a program.
 */
export class Implementation<const Program extends AnyProgram> {
  tag = 'implementation' as const;

  constructor(
    public program: Program,
    public transitions: Transition[] = []
  ) {}

  transition<
    const From extends FromState<Program>,
    const To extends ToState<Program, From>,
  >(
    from: From,
    to: To,
    fn: (input: FnInput<Program, From, To>) => FnOutput<Program, From, To>
  ) {
    return new Implementation(
      this.program,
      this.transitions.concat(new Transition(from as string, to as string, fn))
    );
  }

  findTransition(from: string, to: string): Transition {
    const transition = this.transitions.find(
      (transition) =>
        (transition.from === '*' || transition.from === from) &&
        (transition.to === '*' || transition.to === to)
    );

    if (!transition) throw new Error(`No transition from ${from} to ${to}`);

    return transition;
  }

  async run<
    const From extends FromState<Program>,
    const To extends ToState<Program, From>,
    Input extends FnInput<Program, From, To>,
  >(from: From, to: To, input: Input) {
    const transition = this.findTransition(from as string, to as string);

    return await transition.fn(input);
  }
}
