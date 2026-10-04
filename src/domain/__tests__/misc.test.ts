import { tr } from '../../strings';
import { formatClock, hoursMinutes } from '../clock';
import { EXAM_KINDS, EXAM_SECTIONS } from '../net';
import { EXAM_TYPES } from '../profile';
import { defaultSubject, SUBJECTS_BY_EXAM } from '../subjects';

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65_999)).toBe('1:05');
    expect(formatClock(3_600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('splits into hours and minutes', () => {
    expect(hoursMinutes(2 * 3_600_000 + 5 * 60_000 + 59_000)).toEqual({ hours: 2, minutes: 5 });
  });
});

describe('subjects', () => {
  it('pre-selects the last used subject when it belongs to the exam', () => {
    expect(defaultSubject('YKS', 'fizik')).toBe('fizik');
    expect(defaultSubject('LGS', 'geometri')).toBe('turkce');
    expect(defaultSubject('KPSS', null)).toBe('turkce');
  });

  it('every subject and exam section has a Turkish label', () => {
    const ids = new Set<string>();
    for (const t of EXAM_TYPES) SUBJECTS_BY_EXAM[t].forEach((id) => ids.add(id));
    for (const k of EXAM_KINDS) EXAM_SECTIONS[k].forEach((s) => ids.add(s.id));
    for (const id of ids) expect(tr.subject(id)).not.toBe(id);
  });
});
