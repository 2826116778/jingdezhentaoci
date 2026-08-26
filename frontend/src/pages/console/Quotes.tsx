import React from 'react';
import { FileText } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleQuote } from '../../types';

const Quotes: React.FC = () => (
  <ConsoleListPageView<ConsoleQuote>
    testId="console-quotes"
    pageTitle="Quotes"
    pageSubtitle="Draft and sent quotation proposals tied to customers & inquiries.
                 Phase 2 will add a quote builder with product picker, PDF export, and e-signatures."
    Icon={FileText}
    newCtaLabel="Create Quote"
    comingSoonHint="Quote builder, PDF export, versioning, expiry reminders & e-signatures ship in Phase 2."
    fetcher={(p) => Console.listQuotes(p)}
  />
);
export default Quotes;
