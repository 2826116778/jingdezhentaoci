import React from 'react';
import { MessageSquare } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleInquiry } from '../../types';

const Inquiries: React.FC = () => (
  <ConsoleListPageView<ConsoleInquiry>
    testId="console-inquiries"
    pageTitle="Inquiries"
    pageSubtitle="All inbound B2B/B2C inquiries aggregated across Contact form, OEM request, Product detail page and future sales channels.
                 This is the business workbench view (decoupled from /api/admin/inquiries)."
    Icon={MessageSquare}
    newCtaLabel="Manual Inquiry"
    comingSoonHint="Manual creation, auto assignment, reply templates & AI classification ship in Phase 2."
    fetcher={(p) => Console.listInquiries(p)}
  />
);
export default Inquiries;
