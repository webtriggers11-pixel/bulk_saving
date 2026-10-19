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
    ['+91 (0) 98765 43210', '+919876543210'],
    // `00` is the international prefix: this is a (short) +98… number, not a typo we can see.
    ['00987654321', '+987654321'],
  ])('%s → %s', (raw, expected) => {
    expect(normalisePhone(raw)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '+1', '123456789', '12345678901234567', '9999900201x', '+0123456789', '0987654321', '1234567890', '+91 12345 67890', '+91 0 12345 67890', '+', '00', '+91'])('refuses %j', (raw) => {
    expect(normalisePhone(raw)).toBeNull();
  });
});
