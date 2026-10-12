import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AppShell } from './components/layout/AppShell';
import { FindingDetailPage } from './pages/FindingDetail';
import { FindingsPage } from './pages/Findings';
import { GroupDetailPage } from './pages/groups/GroupDetail';
import { GroupsPage } from './pages/groups/Groups';
import { HomePage } from './pages/Home';
import { IdentitiesPage } from './pages/Identities';
import { NotFoundPage } from './pages/NotFound';
import { ScansPage } from './pages/Scans';
import { WorkspacePage } from './pages/workspace/Workspace';
import './index.css';


const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage />, handle: { title: 'Home' } },
      { path: 'collections', element: <WorkspacePage />, handle: { title: 'Request workspace' } },
      { path: 'collections/:requestId', element: <WorkspacePage />, handle: { title: 'Request workspace' } },
      { path: 'groups', element: <GroupsPage />, handle: { title: 'Groups' } },
      { path: 'groups/:groupName', element: <GroupDetailPage />, handle: { title: 'Group' } },
      { path: 'scans', element: <ScansPage />, handle: { title: 'Scans' } },
      { path: 'scans/:scanId', element: <ScansPage />, handle: { title: 'Scans' } },
      { path: 'findings', element: <FindingsPage />, handle: { title: 'Findings' } },
      { path: 'findings/:findingId', element: <FindingDetailPage />, handle: { title: 'Finding detail' } },
      { path: 'identities', element: <IdentitiesPage />, handle: { title: 'Identities and environments' } },
      { path: 'home', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Not found' } },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Tooltip.Provider delayDuration={250}>
      <RouterProvider router={router} />
    </Tooltip.Provider>
  </StrictMode>,
);
