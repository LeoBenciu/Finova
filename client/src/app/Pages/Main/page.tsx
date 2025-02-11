import { Outlet } from 'react-router';
import SideBar from '@/app/Components/SideBar';

const Page = () => {
  return (
    <div className="min-w-screen min-h-screen flex overflow-hidden">
      <SideBar />
      <div id="content" className="flex-1 h-screen overflow-y-auto ">
        <div className="w-full">
          <div className="mx-auto p-10 max-w-[1210px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
