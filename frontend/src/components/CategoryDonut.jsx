import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { categoryColor, categoryLabel, formatCurrency } from "../utils/format";

/**
 * "Spending by category" - a donut rather than a bar list because the
 * question this answers ("what share of my spending went where") is
 * fundamentally a part-of-a-whole question, and a donut communicates
 * that at a glance in a way a list of numbers doesn't. The total sits
 * in the center (via an absolutely-positioned overlay, not an SVG
 * label - simpler to keep legible at any size) so the headline number
 * is visible without reading a single slice.
 */
function CategoryDonut({ items }) {
  const total = items.reduce((sum, item) => sum + Number(item.total), 0);
  const sorted = [...items].sort((a, b) => Number(b.total) - Number(a.total));

  return (
    <div className="donut-layout">
      <div className="donut-chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={sorted}
              dataKey="total"
              nameKey="category"
              innerRadius={66}
              outerRadius={96}
              paddingAngle={sorted.length > 1 ? 2 : 0}
              stroke="none"
            >
              {sorted.map((item) => (
                <Cell key={item.category} fill={categoryColor(item.category)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatCurrency(value), categoryLabel(name)]}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-md)",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-center__label">Total spent</span>
          <span className="donut-center__value">{formatCurrency(total)}</span>
        </div>
      </div>

      <ul className="donut-legend">
        {sorted.map((item) => {
          const pct = total > 0 ? (Number(item.total) / total) * 100 : 0;
          return (
            <li key={item.category}>
              <span
                className="donut-legend__swatch"
                style={{ background: categoryColor(item.category) }}
                aria-hidden="true"
              />
              <span className="donut-legend__name">{categoryLabel(item.category)}</span>
              <span className="donut-legend__pct">{pct.toFixed(0)}%</span>
              <span className="donut-legend__amount">{formatCurrency(item.total)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CategoryDonut;
