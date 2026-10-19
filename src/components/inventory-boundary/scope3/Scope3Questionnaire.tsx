import { useState, useEffect } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { RingBullet } from '@/components/inventory-boundary/shared/RingBullet';

type QAnswer = 'yes' | 'no' | 'unsure' | null;

const QUESTIONS: { catNo: number; name: string; question: string; alwaysYes?: boolean }[] = [
  { catNo: 1,  name: 'Purchased Goods & Services',              question: 'Do you purchase goods or services from external suppliers?' },
  { catNo: 2,  name: 'Capital Goods',                           question: 'Do you purchase capital goods such as machinery, IT equipment, or buildings?' },
  { catNo: 3,  name: 'Fuel & Energy-Related Activities',        question: 'Does your organisation consume purchased fuels, electricity, or energy?', alwaysYes: true },
  { catNo: 4,  name: 'Upstream Transportation & Distribution',  question: 'Do you use third-party transportation or logistics services for incoming goods?' },
  { catNo: 5,  name: 'Waste Generated in Operations',           question: 'Do you generate waste that is treated or disposed of by external parties?' },
  { catNo: 6,  name: 'Business Travel',                         question: 'Do employees travel for business (flights, trains, hotels, taxis)?' },
  { catNo: 7,  name: 'Employee Commuting',                      question: 'Do employees commute between their homes and your facilities?' },
  { catNo: 8,  name: 'Upstream Leased Assets',                  question: 'Do you lease assets from another company (premises, equipment, vehicles not under your operational control)?' },
  { catNo: 9,  name: 'Downstream Transportation & Distribution',question: 'Do your products reach customers via third-party transportation after leaving your facility?' },
  { catNo: 10, name: 'Processing of Sold Products',             question: 'Do customers further process or transform your products into intermediate or final goods?' },
  { catNo: 11, name: 'Use of Sold Products',                    question: 'Do the products you sell generate emissions while customers use them?' },
  { catNo: 12, name: 'End-of-Life Treatment of Sold Products',  question: 'Do your products require disposal, recycling, or treatment at end-of-life?' },
  { catNo: 13, name: 'Downstream Leased Assets',                question: 'Do you lease assets out to other companies?' },
  { catNo: 14, name: 'Franchises',                              question: 'Do you operate under a franchise model or license your brand to others?' },
  { catNo: 15, name: 'Investments',                             question: 'Do you hold equity investments, project finance, or debt investments?' },
];

const ANSWER_OPTIONS: { value: QAnswer; label: string; bg: string; color: string }[] = [
  { value: 'yes',    label: 'Yes',    bg: '#E6F4EF', color: '#1E6F5C' },
  { value: 'unsure', label: 'Not sure', bg: '#FEF3C7', color: '#D97706' },
  { value: 'no',     label: 'No',     bg: '#F3F4F6', color: '#6B7280' },
];

export const Scope3Questionnaire: React.FC = () => {
  const [answers, setAnswers] = useState<QAnswer[]>(Array(15).fill(null));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authFetch('scope3-questionnaire.php')
      .then(r => r.json())
      .then((data: { questionnaire: QAnswer[] | null }) => {
        if (Array.isArray(data?.questionnaire) && data.questionnaire.length === 15) {
          setAnswers(data.questionnaire);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const patch = (idx: number, val: QAnswer) => {
    setAnswers(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch('scope3-questionnaire.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire: answers }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const answered = answers.filter(a => a !== null).length;
  const allDone  = answered === 15;

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Scope 3 — Category Questionnaire
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--slate)', maxWidth: '780px' }}>
          Answer each question to help your consultant determine which Scope 3 categories apply to your organisation. Your answers are saved and reviewed by the Deepwoods team, who will confirm the final boundary.
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        backgroundColor: 'var(--canopy-tint)',
        border: '1px solid #C4D6CB',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '32px',
        maxWidth: '820px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{ marginTop: '4px' }}>
          <RingBullet active={true} size={10} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '10px' }}>
            <strong>This is not a self-assessment.</strong> Your answers inform a discussion with your consultant — they will make the final relevance determination based on your responses and GHG Protocol guidance.
          </p>
          <p>
            <strong>No emissions data is collected here.</strong> Actual Scope 3 quantification happens later, once the boundary is confirmed. You are simply describing what your organisation does.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{
          flex: 1,
          maxWidth: '400px',
          height: '6px',
          background: 'var(--border)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(answered / 15) * 100}%`,
            background: 'var(--canopy)',
            borderRadius: '9999px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: '13px', color: 'var(--slate)', fontWeight: 500 }}>
          {answered} / 15 answered
        </span>
      </div>

      {/* Question rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {QUESTIONS.map((q, idx) => {
          const val = q.alwaysYes ? 'yes' : answers[idx];
          return (
            <div
              key={q.catNo}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${val ? '#C4D6CB' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              {/* Cat badge */}
              <div style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--canopy-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--canopy)',
              }}>
                {q.catNo}
              </div>

              {/* Question text */}
              <div style={{ flex: 1, minWidth: '240px' }}>
                <p style={{ fontSize: '12px', color: 'var(--slate)', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cat {q.catNo} — {q.name}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: '1.5' }}>
                  {q.question}
                </p>
                {q.alwaysYes && (
                  <p style={{ fontSize: '12px', color: 'var(--canopy)', marginTop: '4px', fontWeight: 600 }}>
                    Always applicable — pre-selected
                  </p>
                )}
              </div>

              {/* Answer buttons */}
              {!q.alwaysYes && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                  {ANSWER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch(idx, opt.value)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: val === opt.value ? `1.5px solid ${opt.color}` : '1.5px solid var(--border)',
                        background: val === opt.value ? opt.bg : 'var(--surface)',
                        color: val === opt.value ? opt.color : 'var(--slate)',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {q.alwaysYes && (
                <div style={{
                  flexShrink: 0,
                  alignSelf: 'center',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: '#E6F4EF',
                  color: '#1E6F5C',
                  border: '1.5px solid #1E6F5C',
                }}>
                  Yes
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        maxWidth: '820px',
      }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !loaded}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            background: allDone ? 'var(--canopy)' : '#64748B',
            color: '#fff',
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {saving ? (
            <><Clock size={14} /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={14} /> Saved</>
          ) : (
            'Save answers'
          )}
        </button>

        {!allDone && (
          <p style={{ fontSize: '13px', color: 'var(--slate)' }}>
            {15 - answered} question{15 - answered !== 1 ? 's' : ''} remaining — save any time to preserve your progress.
          </p>
        )}
        {allDone && saved && (
          <p style={{ fontSize: '13px', color: 'var(--canopy)', fontWeight: 600 }}>
            All 15 categories answered and saved. Your consultant will review and confirm the boundary.
          </p>
        )}
        {allDone && !saved && (
          <p style={{ fontSize: '13px', color: 'var(--slate)' }}>
            All answered — save to submit your responses.
          </p>
        )}
      </div>
    </div>
  );
};
