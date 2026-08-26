import React from 'react';
import { UserCheck } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleCustomer } from '../../types';

const Customers: React.FC = () => (
  <ConsoleListPageView<ConsoleCustomer>
    testId="console-customers"
    pageTitle="Customers"
    pageSubtitle="Converted & long-term customers — companies that have placed at least one paid order,
                 or signed a dealership agreement. Phase 2 will add Customer 360° profiles."
    Icon={UserCheck}
    newCtaLabel="Add Customer"
    comingSoonHint="Customer creation, 360° profiles, tags & company hierarchy will ship in Phase 2."
    fetcher={(p) => Console.listCustomers(p)}
  />
);
export default Customers;
