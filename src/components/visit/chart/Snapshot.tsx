"use client";

import type { ReactNode } from "react";
import type { ChartView } from "@/lib/engine/encounter";
import { find, parseTeam, splitList } from "./derive";
import type { PatientBits } from "./Storyboard";
import { Bar, LINK, ROW, TD, TH } from "./ui";

const SHOWN = /^(reason for visit|problem list|medications|allergies|last vitals|immunizations|care team|code status)/i;

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="px-3 py-2 text-sm italic text-[#5d6b7c]">{empty}</p>;
  return (
    <ol className="divide-y divide-[#e3e9ef]">
      {items.map((x, i) => (
        <li key={i} className={`px-3 py-1.5 text-sm text-[#1a1a1a] ${i % 2 ? "bg-[#f5f8fb]" : ""}`}>
          {x}
        </li>
      ))}
    </ol>
  );
}

/** The one-page summary report: dense bordered sections with header bars. */
export default function Snapshot({ chart, bits, onGo }: { chart: ChartView; bits: PatientBits; onGo: (tab: "review" | "results") => void }) {
  const meds = splitList(find(chart, /^medications/i));
  const medList = chart.artifacts
    .filter((a) => a.type === "medication_list" && a.table && a.table.rows.length)
    .sort((a, b) => a.turn - b.turn)
    .pop();
  const imm = splitList(find(chart, /immuniz/i));
  const team = splitList(find(chart, /^care team/i));
  const extras = chart.atStart.filter((x) => !SHOWN.test(x.label));

  const vitals = bits.vitals;
  const sections: ReactNode[] = [
    <Bar key="prob" title="Problem list" right={<span className="text-xs text-[#44556b]">{bits.problems.length} active</span>}>
      <List items={bits.problems} empty="No problems on file." />
    </Bar>,
    <Bar key="med" title="Medications" right={medList ? <button onClick={() => onGo("review")} className={`text-xs ${LINK}`}>Open full list</button> : undefined}>
      {medList?.table ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {medList.table.columns.slice(0, 4).map((c, i) => (
                  <th key={i} className={TH}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medList.table.rows.map((r, i) => (
                <tr key={i} className={ROW}>
                  {r.cells.slice(0, 4).map((c, j) => (
                    <td key={j} className={`${TD} ${j === 0 ? "font-semibold text-[#10253f]" : "text-[#1a1a1a]"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <List items={meds} empty="No medications on file." />
      )}
    </Bar>,
    <Bar key="alg" title="Allergies" tone={bits.allergic ? "red" : "blue"}>
      <p className={`px-3 py-2 text-sm ${bits.allergic ? "font-semibold text-[#b00000]" : "text-[#1a1a1a]"}`}>{bits.allergyText || "Not on file."}</p>
    </Bar>,
    <Bar key="vit" title="Vitals" right={vitals?.context ? <span className="text-xs text-[#44556b]">{vitals.context}</span> : undefined}>
      {vitals ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {vitals.pairs.map((x, i) => (
                <th key={i} className={`${TH} text-center`}>
                  {x.k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {vitals.pairs.map((x, i) => (
                <td key={i} className="border-b border-[#e3e9ef] px-2 py-1.5 text-center font-semibold text-[#1a1a1a]">
                  {x.v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="px-3 py-2 text-sm text-[#1a1a1a]">{bits.vitalsRaw || <span className="italic text-[#5d6b7c]">None recorded.</span>}</p>
      )}
    </Bar>,
    <Bar key="imm" title="Immunizations">
      <List items={imm} empty="No immunization history on file." />
    </Bar>,
    <Bar key="team" title="Care team">
      {team.length ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Role</th>
            </tr>
          </thead>
          <tbody>
            {team.map((t, i) => {
              const { who, role } = parseTeam(t);
              return (
                <tr key={i} className={ROW}>
                  <td className={`${TD} font-semibold text-[#10253f]`}>{who}</td>
                  <td className={`${TD} text-[#1a1a1a]`}>{role}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-3 py-2 text-sm italic text-[#5d6b7c]">No care team on file.</p>
      )}
    </Bar>,
  ];
  if (bits.code || extras.length)
    sections.push(
      <Bar key="oth" title="Other">
        <dl className="grid grid-cols-[auto_1fr] text-sm">
          {[...(bits.code ? [{ label: "Code status", value: bits.code }] : []), ...extras].map((x, i) => (
            <div key={i} className={`col-span-2 grid grid-cols-subgrid ${i % 2 ? "bg-[#f5f8fb]" : ""}`}>
              <dt className="px-3 py-1.5 font-semibold text-[#44556b]">{x.label}</dt>
              <dd className="px-3 py-1.5 text-[#1a1a1a]">{x.value}</dd>
            </div>
          ))}
        </dl>
      </Bar>,
    );

  return (
    <div className="@container space-y-2 p-2">
      <Bar title="Current visit" tone="grey">
        <div className="space-y-0.5 px-3 py-2 text-sm">
          <div>
            <span className="font-semibold text-[#44556b]">Reason: </span>
            <span className="text-[#1a1a1a]">{chart.chiefComplaint}</span>
          </div>
          <div className="text-[#44556b]">{chart.setting}</div>
        </div>
      </Bar>
      <div className="grid items-start gap-2 @2xl:grid-cols-2">
        <div className="space-y-2">{[sections[0], sections[2], sections[4], sections[5]]}</div>
        <div className="space-y-2">{[sections[1], sections[3], ...sections.slice(6)]}</div>
      </div>
      <p className="px-1 text-xs text-[#5d6b7c]">What you learn on the call is filed under This Visit. Results appear after you place an order.</p>
    </div>
  );
}
