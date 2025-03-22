import { Outlet } from 'react-router';
import SideBar from '@/app/Components/SideBar';

const Page = () => {

  return (
    <div className="min-w-screen min-h-screen flex overflow-hidden">
      <SideBar />
      <div id="content" className="flex-1 h-screen overflow-y-auto ">
        <div className="w-vw min-h-full flex items-start justify-center">
          <div className="p-10 min-w-full max-w-vw">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
