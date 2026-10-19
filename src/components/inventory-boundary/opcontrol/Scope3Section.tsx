import { useState, useEffect } from 'react';
import { Lock, CheckCircle2, Clock } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { RingBullet } from '@/components/inventory-boundary/shared/RingBullet';

const CAT_NAMES = [
  'Purchased Goods & Services',
  'Capital Goods',
  'Fuel & Energy-Related Activities',
  'Upstream Transportation & Distribution',
  'Waste Generated in Operations',
  'Business Travel',
  'Employee Commuting',
  'Upstream Leased Assets',
  'Downstream Transportation & Distribution',
  'Processing of Sold Products',
  'Use of Sold Products',
  'End-of-Life Treatment of Sold Products',
  'Downstream Leased Assets',
  'Franchises',
  'Investments',
];

type ScreeningVal = 'relevant' | 'not_relevant' | 'unsure' | null;

const BADGE: Record<NonNullable<ScreeningVal>, { label: string; bg: string; color: string }> = {
  relevant:     { label: 'In scope',          bg: '#E6F4EF', color: '#1E6F5C' },
  unsure:       { label: 'Under review',       bg: '#FEF3C7', color: '#D97706' },
  not_relevant: { label: 'Not applicable',    bg: '#F3F4F6', color: '#6B7280' },
};

export const Scope3Section: React.FC = () => {
  const [screening, setScreening] = useState<ScreeningVal[] | null>(null);
  const [notes,     setNotes]     = useState<(string | null)[] | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    authFetch('scope3-screening.php')
      .then(r => r.json())
      .then((data: { screening: ScreeningVal[] | null; notes: (string|null)[] | null }) => {
        if (Array.isArray(data?.screening) && data.screening.length === 15) {
          setScreening(data.screening);
        }
        if (Array.isArray(data?.notes)) {
          setNotes(data.notes);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Pending state ─────────────────────────────────────────────────────────

  // Always show all 15 categories. If admin has not yet screened, default every
  // category to 'relevant' so the client can see the full scope.
  const effectiveScreening: ScreeningVal[] = screening
    ?? Array(15).fill('relevant' as ScreeningVal);

  const isScreened = screening !== null;

  if (loading) {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
          Scope 3 Categories Screening
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--slate)', fontSize: '14px', paddingTop: '12px' }}>
          <Clock size={14} /> Loading…
        </div>
      </div>
    );
  }

  const inScope     = effectiveScreening.filter(v => v === 'relevant').length;
  const notAppl     = effectiveScreening.filter(v => v === 'not_relevant').length;
  const underReview = effectiveScreening.filter(v => v === 'unsure').length;

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
        Scope 3 Categories Screening
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--slate)', marginBottom: '20px' }}>
        SBTi and ISO 14064-1 require every Scope 3 category to be screened, with rationale for exclusions.
        {isScreened ? ' The boundary below has been confirmed by your Deepwoods consultant.' : ' All 15 categories are shown below — your consultant will confirm the final boundary after reviewing your questionnaire.'}
      </p>

      {/* Status banner */}
      {isScreened ? (
        <div style={{
          backgroundColor: '#E6F4EF',
          border: '1px solid #A8D5BD',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          maxWidth: '720px',
        }}>
          <CheckCircle2 size={18} style={{ color: '#1E6F5C', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: '32px', fontSize: '13px' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: '#1E6F5C', display: 'block' }}>{inScope}</span>
              <span style={{ color: '#2D6A4F' }}>In scope</span>
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: '#D97706', display: 'block' }}>{underReview}</span>
              <span style={{ color: '#78350F' }}>Under review</span>
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: '#6B7280', display: 'block' }}>{notAppl}</span>
              <span style={{ color: '#374151' }}>Not applicable</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          maxWidth: '720px',
        }}>
          <Clock size={16} style={{ color: '#D97706', flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: '#78350F' }}>
            <strong>Pending consultant confirmation.</strong> All 15 categories are visible for you to review. Your Deepwoods consultant will finalise which apply to your organisation after reviewing your Scope 3 questionnaire.
          </p>
        </div>
      )}

      {/* Category table */}
      <div style={{
        backgroundColor: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{
              backgroundColor: 'var(--paper)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--slate)',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              <th style={{ padding: '12px 16px', width: '50px' }}>#</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px', width: '180px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Consultant Notes</th>
            </tr>
          </thead>
          <tbody>
            {CAT_NAMES.map((name, i) => {
              const val  = effectiveScreening[i] ?? null;
              const note = notes?.[i] ?? '';
              const cfg  = val ? BADGE[val] : null;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--slate)' }}>{i + 1}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ink)' }}>{name}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {cfg ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: cfg.bg,
                        color: cfg.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--slate)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--slate)', fontSize: '13px', lineHeight: '1.5' }}>
                    {note || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Lock size={12} />
        {isScreened
          ? 'This boundary was confirmed by your Deepwoods consultant. Contact your team if you believe a category needs to be changed.'
          : 'Categories and statuses are set by your Deepwoods consultant. Contact your team with any questions.'}
      </p>
    </div>
  );
};
