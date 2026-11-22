import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indianPhone, PhoneField, toLocalDigits } from './phone-field';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="p">Phone number</label>
      <PhoneField id="p" value={value} onValueChange={setValue} />
      <output data-testid="canonical">{indianPhone(value) ?? 'none'}</output>
    </>
  );
}

describe('toLocalDigits (FEAT-031)', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['91 9876543210', '9876543210'],
    ['098765-43210', '9876543210'],
    ['98a7b6', '9876'],
    ['98765432101234', '9876543210'],
    ['+91 (0) 98765 43210', '9876543210'],
    ['0091 98765 43210', '9876543210'],
    // V2 P2-1: a number that itself starts with 91, plus one stray key, keeps its first 10.
    ['91234567890', '9123456789'],
    ['9123456789', '9123456789'],
    ['', ''],
  ])('%j → %j', (raw, expected) => {
    expect(toLocalDigits(raw)).toBe(expected);
  });
});

describe('indianPhone', () => {
  it('is the canonical +91 form for a valid 10-digit mobile, null otherwise', () => {
    expect(indianPhone('9876543210')).toBe('+919876543210');
    expect(indianPhone('987654321')).toBeNull();
    expect(indianPhone('2223456789')).toBeNull();
  });
});

describe('PhoneField', () => {
  it('shows a fixed +91 that is not part of the value and not editable', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Phone number');
    const prefix = screen.getByTestId('phone-prefix');
    expect(prefix).toHaveTextContent('+91');
    expect(prefix).toHaveAttribute('aria-hidden', 'true');
    expect(prefix.className).toContain('pointer-events-none');
    expect(prefix.className).toContain('select-none');
    expect(prefix.closest('input')).toBeNull();
    expect(input).toHaveValue('');
    // Clearing the field cannot remove the country code.
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('phone-prefix')).toHaveTextContent('+91');
  });

  it('keeps digits only, at most 10, and asks the numeric keypad', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Phone number');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'tel-national');
    expect(input).not.toHaveAttribute('maxlength');
    fireEvent.change(input, { target: { value: '98x76' } });
    expect(input).toHaveValue('9876');
    fireEvent.change(input, { target: { value: '987654321099' } });
    expect(input).toHaveValue('9876543210');
    expect(screen.getByTestId('canonical')).toHaveTextContent('+919876543210');
  });

  it('an extra keystroke on a full 91-series number is dropped, not read as a prefix (V2 P2-1)', () => {
    render(<Harness initial="9123456789" />);
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '91234567895' } });
    expect(screen.getByLabelText('Phone number')).toHaveValue('9123456789');
  });

  it('a pasted +91 number lands whole', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+91 99999 00101' } });
    expect(screen.getByLabelText('Phone number')).toHaveValue('9999900101');
    expect(screen.getByTestId('canonical')).toHaveTextContent('+919999900101');
  });

  it('tells screen readers about the country code, alongside any hint', () => {
    render(<><label htmlFor="q">Phone number</label><PhoneField id="q" value="" onValueChange={() => undefined} aria-describedby="hint" /></>);
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-describedby', 'q-country hint');
    expect(screen.getByText('Country code +91')).toHaveClass('sr-only');
  });
});
