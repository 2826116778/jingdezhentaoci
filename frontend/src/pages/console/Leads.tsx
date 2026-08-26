/** PHASE 1 · Leads 列表页（潜在海外客户）。严格真实 API + Empty State；绝不硬编码 items。 */
import React from 'react';
import { Users2 } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleLead } from '../../types';

const Leads: React.FC = () => (
  <ConsoleListPageView<ConsoleLead>
    testId="console-leads"
    pageTitle="Leads"
    pageSubtitle="Potential overseas buyers (hotels, distributors, retail chains, interior designers).
                 Phase 2 will connect LinkedIn / Google / Instagram crawlers to populate this list automatically."
    Icon={Users2}
    newCtaLabel="Add Lead"
    comingSoonHint="Manual lead creation + LinkedIn / Google / Instagram auto-discovery will ship in Phase 2."
    fetcher={(p) => Console.listLeads(p)}
  />
);
export default Leads;
