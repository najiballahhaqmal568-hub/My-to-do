import { expect, it } from 'vitest';
import { isNewer } from './version';

it('compares release versions', () => {
  expect(isNewer('v1.0.12', '1.0.11')).toBe(true);
  expect(isNewer('v1.1.0', '1.0.99')).toBe(true);
  expect(isNewer('v1.0.11', '1.0.11')).toBe(false);
  expect(isNewer('v1.0.9', '1.0.11')).toBe(false);
  expect(isNewer('nightly', '1.0.0')).toBe(false);
  expect(isNewer('v2.0.0', 'dev')).toBe(false);
});
