import { describe, expect, it } from 'vitest';

import { formatUsdEstimate } from './format';

describe('display-only USD estimates', () => {
  it.each([
    ['0', '$0.00'],
    ['0.000000001', '< $0.01'],
    ['0.00999999', '< $0.01'],
    ['0.01', '$0.01'],
    ['1.005', '$1.01'],
    ['820.5772896414', '$820.58'],
    ['9007199254740993.095', '$9,007,199,254,740,993.10'],
  ])('formats %s without converting money to number', (value, expected) => {
    expect(formatUsdEstimate(value)).toBe(expected);
  });
});
