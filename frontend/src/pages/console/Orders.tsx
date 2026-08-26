import React from 'react';
import { ShoppingCart } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleOrder } from '../../types';

const Orders: React.FC = () => (
  <ConsoleListPageView<ConsoleOrder>
    testId="console-orders"
    pageTitle="Orders"
    pageSubtitle="Business-console perspective on all orders (public store orders + future direct sales / dealer orders).
                 This view is decoupled from the shopper-facing /api/orders APIs."
    Icon={ShoppingCart}
    newCtaLabel="Create Order"
    comingSoonHint="Direct order creation, manual invoicing & dealer bulk pricing ship in Phase 2."
    fetcher={(p) => Console.listOrders(p)}
  />
);
export default Orders;
