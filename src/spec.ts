import { Implementation, Program, Trace } from './index';

describe('TDS – Test-Driven State', () => {
  test('trace', () => {
    const factorialProgram = new Program([
      /**
       * A factorial program can be represented as a union of three such traces:
       */

      Trace.with({ n: 0 }) // reads as: for n = 0, the output is n = 1
        .step('calc', { output: { n: 1 } }),

      Trace.with({ n: 1 }) // reads as: for n = 1, the output is n = 1 after one step
        .step('calc', { output: { n: 0, a: 1 } })
        .step('calc', { output: { n: 1 } }),

      Trace.with({ n: 5 }) // reads as: for n = 5, the output is n = 120 after five steps
        .step('calc', { output: { n: 4, a: 5 } })
        .step('calc', { output: { n: 3, a: 20 } })
        .step('calc', { output: { n: 2, a: 60 } })
        .step('calc', { output: { n: 1, a: 120 } })
        .step('calc', { output: { n: 0, a: 120 } })
        .step('calc', { output: { n: 120 } }),
    ]);

    const factorialImplementation = new Implementation(factorialProgram)
      // reads as: from any state to any state
      .transition('*', '*', ({ n, a = 1 }) =>
        n === 0 //
          ? ['@', { n: a }]
          : ['calc', { n: n - 1, a: n * a }]
      );
  });
});
