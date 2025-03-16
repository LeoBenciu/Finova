import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import { useSelector } from 'react-redux';

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const FileManagementPage = () => {
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name)
  return (
    <div>
      
      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default FileManagementPage
