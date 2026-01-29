import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function UserLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <Outlet />
      <BottomNav />
    </div>
  );
}
