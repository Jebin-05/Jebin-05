// generate-graph.mjs
// Pulls the last 31 days of contribution counts for GH_USERNAME via the
// GitHub GraphQL API and renders them as an SVG bar graph.
import { writeFileSync } from 'fs';

const token = process.env.GH_TOKEN;
const username = process.env.GH_USERNAME;

if (!token || !username) {
  throw new Error('GH_TOKEN and GH_USERNAME env vars are required');
}

const query = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

const json = await res.json();

if (json.errors) {
  console.error(json.errors);
  throw new Error('GraphQL query failed');
}

const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
const allDays = weeks.flatMap((w) => w.contributionDays);

// Keep only the last 31 days
const last31 = allDays.slice(-31);

// ---- SVG rendering ----
const width = 720;
const height = 260;
const padding = 40;
const barGap = 4;
const chartWidth = width - padding * 2;
const chartHeight = height - padding * 2 - 20;
const barWidth = chartWidth / last31.length - barGap;
const maxCount = Math.max(...last31.map((d) => d.contributionCount), 1);

const bgColor = '#0D1117';
const barColor = '#8957E5';
const accentColor = '#1F6FEB';
const textColor = '#C9D1D9';
const axisColor = '#30363D';

const chartTop = padding + 20;

const bars = last31
  .map((d, i) => {
    const barHeight = (d.contributionCount / maxCount) * chartHeight;
    const x = padding + i * (barWidth + barGap);
    const y = chartTop + (chartHeight - barHeight);
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(
      2
    )}" height="${barHeight.toFixed(2)}" fill="${barColor}" rx="2" />`;
  })
  .join('\n  ');

// X-axis: day-of-month number under every bar
const xLabels = last31
  .map((d, i) => {
    const x = padding + i * (barWidth + barGap) + barWidth / 2;
    const y = chartTop + chartHeight + 12;
    const dayNum = new Date(d.date).getDate();
    return `<text x="${x.toFixed(2)}" y="${y}" font-family="Segoe UI, sans-serif" font-size="8" fill="${textColor}" text-anchor="middle">${dayNum}</text>`;
  })
  .join('\n  ');

// Y-axis: 0, mid, max tick numbers + axis lines
const yTickCount = 4;
const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
  const value = Math.round((maxCount / yTickCount) * i);
  const y = chartTop + chartHeight - (chartHeight / yTickCount) * i;
  return `<text x="${(padding - 8).toFixed(2)}" y="${(y + 3).toFixed(
    2
  )}" font-family="Segoe UI, sans-serif" font-size="9" fill="${textColor}" text-anchor="end">${value}</text>`;
}).join('\n  ');

const axisLine = `<line x1="${padding}" y1="${chartTop}" x2="${padding}" y2="${
  chartTop + chartHeight
}" stroke="${axisColor}" stroke-width="1" />
  <line x1="${padding}" y1="${chartTop + chartHeight}" x2="${
  padding + chartWidth
}" y2="${chartTop + chartHeight}" stroke="${axisColor}" stroke-width="1" />`;

const totalContributions = last31.reduce((sum, d) => sum + d.contributionCount, 0);

const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="12" fill="${bgColor}" />
  <text x="${padding}" y="30" font-family="Segoe UI, sans-serif" font-size="18" fill="${accentColor}">
    Jebin's Activity Graph
  </text>
  ${axisLine}
  ${yTicks}
  ${bars}
  ${xLabels}
</svg>`;

writeFileSync('activity-graph.svg', svg);
console.log(`Generated activity-graph.svg with ${last31.length} days, total contributions: ${totalContributions}`);
