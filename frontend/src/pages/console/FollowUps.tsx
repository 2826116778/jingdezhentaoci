import React from 'react';
import { MessageCircle } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleFollowUp } from '../../types';

const FollowUps: React.FC = () => (
  <ConsoleListPageView<ConsoleFollowUp>
    testId="console-followups"
    pageTitle="Follow-Ups"
    pageSubtitle="Communication log tied to each Lead / Customer / Inquiry / Quote / Order.
                 Phase 2 will add WhatsApp / Email / LinkedIn integrations."
    Icon={MessageCircle}
    newCtaLabel="Log Follow-Up"
    comingSoonHint="Manual + automated follow-up scheduling, WhatsApp & email integrations ship in Phase 2."
    fetcher={(p) => Console.listFollowUps(p)}
  />
);
export default FollowUps;
