import { Factorial } from './examples/factorial';
import { Implementation } from './index';

describe('TDS – Test-Driven State', () => {
  test('factorial example', async () => {
    const factorial = new Implementation<typeof Factorial>()
      // reads as: from any state to any state
      .transition('*', '*', ({ n, a = 1 }) =>
        n === 0 //
          ? ['@', { n: a }]
          : ['calc', { n: n - 1, a: n * a }]
      );

    expect(await factorial.run('@', 'calc', { n: 0 })).toEqual({ n: 1 });
    expect(await factorial.run('@', 'calc', { n: 1 })).toEqual({ n: 1 });
    expect(await factorial.run('@', 'calc', { n: 5 })).toEqual({ n: 120 });
  });
});
