import React from 'react';
import { ListTodo } from 'lucide-react';
import ConsoleListPageView from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import type { ConsoleTask } from '../../types';

const Tasks: React.FC = () => (
  <ConsoleListPageView<ConsoleTask>
    testId="console-tasks"
    pageTitle="Tasks"
    pageSubtitle="Sales & operational to-dos, assignable to team members with due dates and priorities.
                 Phase 2 will link tasks to Leads / Customers / Quotes / Orders."
    Icon={ListTodo}
    newCtaLabel="New Task"
    comingSoonHint="Task creation, assignment, due dates, reminders & recurring tasks ship in Phase 2."
    fetcher={(p) => Console.listTasks(p)}
  />
);
export default Tasks;
