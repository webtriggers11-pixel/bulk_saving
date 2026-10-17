import { describe, expect, it } from 'vitest';
import { glyphFor } from './ServicesPage';

describe('glyphFor (FEAT-014 categories)', () => {
  it('gives the new categories their own glyph rather than the generic one', () => {
    expect(glyphFor({ category: 'Vehicle', name: 'Car Wash' })).toBe('car');
    expect(glyphFor({ category: 'Bulk Staples', name: 'Basmati Rice — 25 kg' })).toBe('basket');
    expect(glyphFor({ category: 'Utilities', name: 'Water Tank Cleaning' })).toBe('water');
    expect(glyphFor({ category: 'Utilities', name: 'Inverter Battery Check' })).toBe('bolt');
  });

  it('lets the category win over a keyword in the name — "Car Wash" is not cleaning', () => {
    expect(glyphFor({ category: 'Vehicle', name: 'Car Interior Wash' })).toBe('car');
  });

  it('leaves the original categories as they were', () => {
    expect(glyphFor({ category: 'Appliances', name: 'AC Servicing' })).toBe('ac');
    expect(glyphFor({ category: 'Home Care', name: 'Pest Control' })).toBe('pest');
    expect(glyphFor({ category: 'Renovation', name: 'Painting' })).toBe('paint');
  });
});
