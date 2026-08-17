'use client';

import type { AnalyticsResponse } from '@job-ai/types';
import { Card, CardBody } from '@job-ai/ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = {
  brand: 'var(--color-brand)',
  strong: 'var(--color-strong)',
  warn: 'var(--color-warn)',
  danger: 'var(--color-danger)',
  grid: 'var(--color-border)',
  text: 'var(--color-fg-muted)',
};

const axisProps = {
  stroke: COLORS.text,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-fg)' },
} as const;

export function AnalyticsCharts({ analytics }: { analytics: AnalyticsResponse }) {
  const weekly = analytics.weekly.map((w) => ({
    ...w,
    label: new Date(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Weekly activity</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-fg-subtle">Last 8 weeks.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--color-surface-muted)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="applications" name="Applied" isAnimationActive={false} fill={COLORS.brand} radius={[3, 3, 0, 0]} />
                <Bar dataKey="interviews" name="Interviews" isAnimationActive={false} fill={COLORS.strong} radius={[3, 3, 0, 0]} />
                <Bar dataKey="offers" name="Offers" isAnimationActive={false} fill={COLORS.warn} radius={[3, 3, 0, 0]} />
                <Bar dataKey="rejections" name="Rejections" isAnimationActive={false} fill={COLORS.danger} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Match score vs. outcome</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-fg-subtle">
            Share of applications in each score band that advanced past submission. Descriptive only —
            no causal claim.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.scoreVsOutcome} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="bucket" {...axisProps} />
                <YAxis unit="%" domain={[0, 100]} {...axisProps} />
                <Tooltip
                  {...tooltipStyle}
                  cursor={{ fill: 'var(--color-surface-muted)' }}
                  formatter={(value, _name, item) => {

                    const row = (item as { payload?: unknown }).payload as
                      | AnalyticsResponse['scoreVsOutcome'][number]
                      | undefined;
                    return row
                      ? [`${value}% (${row.advanced} of ${row.total})`, 'Advanced']
                      : [`${value}%`, 'Advanced'];
                  }}
                />
                <Bar dataKey="rate" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                  {analytics.scoreVsOutcome.map((row) => (
                    <Cell
                      key={row.bucket}

                      fill={row.total === 0 ? COLORS.grid : COLORS.brand}
                      fillOpacity={row.total < 3 ? 0.45 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
