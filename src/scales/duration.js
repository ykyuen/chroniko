// Writing a duration in words, shared by the scales.

/**
 * A duration from its parts, largest unit first and ending at the smallest
 * unit to show, e.g. [['year', 2], ['month', 11], ['day', 3]] → "2 years,
 * 11 months": the first part that isn't zero, plus the next one if that isn't
 * zero either. If every part is zero, "less than" the smallest unit.
 */
export function durationWords(parts, m) {
  const first = parts.findIndex(([, n]) => n > 0);
  if (first < 0) return m.lessThan[parts.at(-1)[0]];
  const amount = ([name, n]) => {
    const forms = m.units[name];
    return (forms[m.plural.select(n)] ?? forms.other).replace('#', m.number.format(n));
  };
  const next = parts[first + 1];
  return next?.[1] > 0 ? `${amount(parts[first])}${m.unitJoin}${amount(next)}` : amount(parts[first]);
}
