import { HeadingLevel } from 'docx';
import { describe, expect, it } from 'vitest';
import { headingStyle } from './render';

describe('headingStyle', () => {
  it('maps levels to Word headings, deeper levels sharing the sixth', () => {
    expect(headingStyle(1)).toBe(HeadingLevel.HEADING_1);
    expect(headingStyle(6)).toBe(HeadingLevel.HEADING_6);
    expect(headingStyle(9)).toBe(HeadingLevel.HEADING_6);
  });
});
