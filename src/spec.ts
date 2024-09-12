import { Implementation, Program, ProgramToTransition, Trace } from './index';

describe('TDS – Test-Driven State', () => {
  test('trace', () => {
    const factorialProgram = new Program([
      Trace.with({ n: 0 }) //
        .step('calc', { output: { n: 1 } }),
      Trace.with({ n: 1 }) //
        .step('calc', { output: { n: 0, a: 1 } })
        .step('calc', { output: { n: 1 } }),
      Trace.with({ n: 5 }) //
        .step('calc', { output: { n: 4, a: 5 } })
        .step('calc', { output: { n: 3, a: 20 } })
        .step('calc', { output: { n: 2, a: 60 } })
        .step('calc', { output: { n: 1, a: 120 } })
        .step('calc', { output: { n: 0, a: 120 } })
        .step('calc', { output: { n: 120 } }),
    ]);

    type _1 = ProgramToTransition<typeof factorialProgram>;
    type _2 = _1['from'];

    const factorialImplementation = new Implementation(factorialProgram) //
      .transition('*', '*', ({ n, a = 1 }) =>
        n === 0 //
          ? { next: '@', output: { n: a } }
          : { next: 'calc', output: { n: n - 1, a: n * a } }
      );
  });
});
