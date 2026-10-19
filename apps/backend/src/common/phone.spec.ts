import { normalisePhone } from '@bulk/shared';

/** BUG-019: one canonical form, India by default. */
describe('normalisePhone', () => {
  it.each([
    ['9999900201', '+919999900201'],
    ['+919999900201', '+919999900201'],
    ['+91 99999 00201', '+919999900201'],
    ['099999-00201', '+919999900201'],
    ['919999900201', '+919999900201'],
    ['(0) 99999 00201', '+919999900201'],
    ['0091 9999900201', '+919999900201'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('%s → %s', (raw, expected) => {
    expect(normalisePhone(raw)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '+1', '123456789', '12345678901234567', '9999900201x'])('refuses %j', (raw) => {
    expect(normalisePhone(raw)).toBeNull();
  });
});
